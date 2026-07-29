import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useReducedMotion, useSpring, useVelocity } from 'framer-motion';

const CLOTH_VERT = `
  uniform float uCurl;    // signed curl depth at the top-center, in pixels
  uniform float uHeight;  // plane height in pixels (mesh is scaled by this)
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // The reference behaves like a sheet held at its two top corners: the
    // centre of the leading edge has the most travel and the corners barely
    // move. sin() gives a softer, more cloth-like shoulder than a parabola.
    float across = pow(sin(uv.x * 3.14159265), 1.35);

    // Only the upper 18% participates. The fifth-order curve has zero slope at
    // both ends, so the fold joins the completely rigid lower 82% invisibly.
    float topBand = clamp((uv.y - 0.82) / 0.18, 0.0, 1.0);
    float topFold = topBand * topBand * topBand
      * (topBand * (topBand * 6.0 - 15.0) + 10.0);

    // uCurl is signed from scroll direction. Position is normalized before the
    // DOM-sized mesh scale is applied, keeping the fold depth in screen pixels.
    pos.y += across * topFold * (uCurl / max(uHeight, 1.0));

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

function DOMSyncedImage({ photo, velocity, reduceMotion }) {
  const meshRef = useRef(null);
  const materialRef = useRef(null);
  const [texture, setTexture] = useState(null);

  // Load texture
  useEffect(() => {
    let active = true;
    let loadedTexture;

    new THREE.TextureLoader().load(photo.src, (tex) => {
      loadedTexture = tex;
      if (!active) {
        tex.dispose();
        return;
      }
      // Use NoColorSpace to prevent washed-out colours on raw ShaderMaterials
      tex.colorSpace = THREE.NoColorSpace;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
      setTexture(tex);
    });

    return () => {
      active = false;
      loadedTexture?.dispose();
    };
  }, [photo.src]);

  useFrame(() => {
    if (!meshRef.current || !materialRef.current || !texture) return;

    // Find the invisible DOM image element
    const el = document.getElementById(`pv-img-${photo.id}`);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    
    // Check if it's visible on screen (generous bleed so a mid-scroll drape
    // never pops out at the edges)
    const isVisible = rect.top < window.innerHeight + 900 && rect.bottom > -900;
    
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
    materialRef.current.uniforms.uHeight.value = rect.height;

    // DOM content travels opposite scroll direction, so the cloth's leading
    // edge lags with the opposite sign. A brisk wheel gesture produces roughly
    // 50–70px of travel; flings are capped before they become a whole-image
    // "wiggle". The shared spring returns every image to a true rectangle.
    const scrollVelocity = reduceMotion ? 0 : velocity.get();
    const clamped = THREE.MathUtils.clamp(scrollVelocity, -1800, 1800);
    materialRef.current.uniforms.uCurl.value = -clamped * 0.038;
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
          uCurl: { value: 0 },
          uHeight: { value: 1 },
          uOpacity: { value: 1 }
        }}
        transparent={true}
      />
    </mesh>
  );
}

export default function PhotoViewerScene({ photos, scrollY }) {
  const rawVelocity = useVelocity(scrollY);
  // A quick attack preserves wheel/finger intent; the slightly softer release
  // gives the reference's short cloth-settle without leaving residual motion.
  const velocity = useSpring(rawVelocity, {
    stiffness: 520,
    damping: 46,
    mass: 0.32,
  });
  const reduceMotion = useReducedMotion();

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
        <DOMSyncedImage
          key={p.id}
          photo={p}
          velocity={velocity}
          reduceMotion={reduceMotion}
        />
      ))}
    </Canvas>
  );
}
