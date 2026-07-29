import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useVelocity, useSpring } from 'framer-motion';

const CLOTH_VERT = `
  uniform float uVelocity;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Arch shape: 1 at the center, 0 at the edges
    float dist = abs(uv.x - 0.5) * 2.0;
    float arch = 1.0 - pow(dist, 2.0);

    // Bend the top and bottom edges based on scroll velocity.
    // uVelocity is measured in pixels per second. 
    // We scale it down so a fast swipe bends the image by up to ~100-200 pixels.
    // The negative sign ensures that if you scroll down (velocity positive), 
    // the center lags behind (bends up), creating the pulling effect.
    pos.y += arch * uVelocity * -0.05;
    
    // Add a slight Z pop based on velocity (optional, but looks nice for cloth)
    pos.z += arch * abs(uVelocity) * 0.02;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const CLOTH_FRAG = `
  uniform sampler2D uTexture;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(uTexture, vUv);
    // Render the texture
    gl_FragColor = vec4(tex.rgb, tex.a * uOpacity);
  }
`;

function DOMSyncedImage({ photo, scrollY }) {
  const meshRef = useRef(null);
  const materialRef = useRef(null);
  const [texture, setTexture] = useState(null);

  // Derive smoothed velocity from framer-motion scroll
  const rawVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(rawVelocity, { damping: 50, stiffness: 400 });

  // Load texture
  useEffect(() => {
    let active = true;
    new THREE.TextureLoader().load(photo.src, (tex) => {
      if (!active) return;
      // Use NoColorSpace to prevent washed-out colours on raw ShaderMaterials
      tex.colorSpace = THREE.NoColorSpace;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      setTexture(tex);
    });
    return () => { active = false; };
  }, [photo.src]);

  useFrame(() => {
    if (!meshRef.current || !materialRef.current || !texture) return;

    // Find the invisible DOM image element
    const el = document.getElementById(`pv-img-${photo.id}`);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    
    // Check if it's visible on screen (with a little bleed area)
    const isVisible = rect.top < window.innerHeight + 500 && rect.bottom > -500;
    
    if (!isVisible) {
      meshRef.current.visible = false;
      return;
    }
    
    meshRef.current.visible = true;

    // Match scale to DOM pixel dimensions
    meshRef.current.scale.set(rect.width, rect.height, 1);

    // Map DOM position (origin top-left, y goes down) 
    // to WebGL Orthographic (origin center, y goes up)
    const px = rect.left + rect.width / 2 - window.innerWidth / 2;
    const py = -(rect.top + rect.height / 2 - window.innerHeight / 2);
    
    meshRef.current.position.set(px, py, 0);

    // Update shader uniforms
    materialRef.current.uniforms.uTexture.value = texture;
    // We pass the scroll velocity (pixels/sec) to the shader
    materialRef.current.uniforms.uVelocity.value = smoothVelocity.get();
  });

  return (
    <mesh ref={meshRef} visible={false}>
      {/* 64 segments give smooth vertex displacement for the parabola */}
      <planeGeometry args={[1, 1, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={CLOTH_VERT}
        fragmentShader={CLOTH_FRAG}
        uniforms={{
          uTexture: { value: null },
          uVelocity: { value: 0 },
          uOpacity: { value: 1 }
        }}
        transparent={true}
      />
    </mesh>
  );
}

export default function PhotoViewerScene({ photos, scrollY }) {
  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 4005 }}
    >
      {/* 
        OrthographicCamera means 1 WebGL unit = 1 Screen Pixel.
        This allows us to perfectly sync the 3D planes with the DOM. 
      */}
      <OrthographicCamera 
        makeDefault 
        position={[0, 0, 1000]} 
        zoom={1} 
        near={0.1} 
        far={2000} 
      />
      
      {photos.map((p) => (
        <DOMSyncedImage key={p.id} photo={p} scrollY={scrollY} />
      ))}
    </Canvas>
  );
}
