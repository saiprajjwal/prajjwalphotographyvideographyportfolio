import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useScroll, useVelocity, useSpring } from 'framer-motion';

const CLOTH_VERT = `
  uniform float uVelocity;
  uniform float uOffset; // -1 to 1 based on position relative to center of screen
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Dist to center (0 at center, 1 at edges)
    float dist = abs(uv.x - 0.5) * 2.0;
    // Arch: 1 at center, 0 at edges
    float arch = 1.0 - pow(dist, 2.0);

    // The velocity driven bend
    // We bend the image in Z and Y depending on scroll velocity.
    float bendY = arch * uVelocity * 0.05;
    
    // The reference image has a static arch shape where the top curves.
    // Let's add a static cylinder-like arch to Y and Z.
    // When the image is near the top of the screen (uOffset > 0), the top edge bends back.
    pos.y += arch * 0.15 + bendY;
    pos.z += arch * 0.2 + arch * abs(uVelocity) * 0.05;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const CLOTH_FRAG = `
  uniform sampler2D uTexture;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(uTexture, vUv);
    gl_FragColor = vec4(tex.rgb, tex.a * uOpacity);
  }
`;

function ClothImage({ url, index, total, scrollYProgress }) {
  const meshRef = useRef(null);
  const materialRef = useRef(null);
  const [texture, setTexture] = useState(null);
  const { viewport } = useThree();

  // Load texture
  useEffect(() => {
    let active = true;
    new THREE.TextureLoader().load(url, (tex) => {
      if (!active) return;
      tex.colorSpace = THREE.NoColorSpace;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      setTexture(tex);
    });
    return () => { active = false; };
  }, [url]);

  // Framer Motion scroll hooks
  const rawVelocity = useVelocity(scrollYProgress);
  const smoothVelocity = useSpring(rawVelocity, { damping: 50, stiffness: 400 });

  useFrame(() => {
    if (!meshRef.current || !texture) return;

    // Size the plane to fit the viewport width, maintaining aspect ratio
    // Assuming landscape or portrait, let's fit to viewport width mostly,
    // or set a max height.
    const imgAspect = texture.image.width / texture.image.height;
    
    // Fit width, but cap height at 80% of viewport
    let w = viewport.width * 0.8;
    let h = w / imgAspect;
    if (h > viewport.height * 0.8) {
      h = viewport.height * 0.8;
      w = h * imgAspect;
    }
    
    meshRef.current.scale.set(w, h, 1);

    // Position this image
    // In three.js, world coordinates: 1 unit is roughly viewport height at distance
    // Let's use viewport.height as our metric.
    const gap = viewport.height * 1.3;
    const startY = -index * gap;
    
    // Calculate total scroll height so 0..1 scrollYProgress maps to scrolling all items
    const totalScroll = (total - 1) * gap;
    const currentScroll = scrollYProgress.get() * totalScroll;
    
    const worldY = startY + currentScroll;
    meshRef.current.position.y = worldY;

    // Pass uniforms
    if (materialRef.current) {
      materialRef.current.uniforms.uVelocity.value = smoothVelocity.get() * 20.0; // scale velocity for effect
      materialRef.current.uniforms.uTexture.value = texture;
      
      // Calculate offset from center of screen (-1 to 1)
      const offset = Math.max(-1, Math.min(1, worldY / (viewport.height * 0.5)));
      materialRef.current.uniforms.uOffset.value = offset;
      
      // Fade out if it's very far
      const opacity = 1.0 - Math.min(1.0, Math.pow(Math.abs(offset) * 0.8, 4.0));
      materialRef.current.uniforms.uOpacity.value = opacity;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[1, 1, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={CLOTH_VERT}
        fragmentShader={CLOTH_FRAG}
        uniforms={{
          uTexture: { value: null },
          uVelocity: { value: 0 },
          uOffset: { value: 0 },
          uOpacity: { value: 1 }
        }}
        transparent={true}
      />
    </mesh>
  );
}

export default function PhotoViewerScene({ photos, scrollYProgress }) {
  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 4.5], fov: 45 }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: -1 }}
    >
      <ambientLight intensity={1} />
      {photos.map((p, i) => (
        <ClothImage 
          key={p.id} 
          url={p.src} 
          index={i} 
          total={photos.length} 
          scrollYProgress={scrollYProgress} 
        />
      ))}
    </Canvas>
  );
}
