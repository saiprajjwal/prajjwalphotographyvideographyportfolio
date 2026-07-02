import { useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, MeshTransmissionMaterial, Sparkles, Float } from '@react-three/drei';
import * as THREE from 'three';

// A subtle, slow-spinning glass monolith for the portfolio background
function AmbientGlass() {
  const meshRef = useRef();
  const { viewport } = useThree();

  const isMobile = viewport.width < 6;
  const glassWidth = isMobile ? 3 : 6;
  const glassHeight = isMobile ? 5 : 8;

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Very slow, ambient rotation
    meshRef.current.rotation.y = t * 0.05;
    meshRef.current.rotation.x = Math.sin(t * 0.2) * 0.1;

    // Subtle mouse parallax
    const mouseX = (state.mouse.x * Math.PI) / 8;
    const mouseY = (state.mouse.y * Math.PI) / 8;

    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, (t * 0.05) + mouseX, 0.05);
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, (Math.sin(t * 0.2) * 0.1) - mouseY, 0.05);
  });

  return (
    <Float speed={1} rotationIntensity={0} floatIntensity={0.5}>
      <mesh ref={meshRef} position={[0, 0, -2]}>
        <boxGeometry args={[glassWidth, glassHeight, 0.5]} />
        <MeshTransmissionMaterial
          backside={true}
          samples={isMobile ? 4 : 8}
          resolution={isMobile ? 256 : 512}
          transmission={1}
          roughness={0.1}
          thickness={1.5}
          ior={1.3}
          chromaticAberration={0.05}
          anisotropy={0.2}
          distortion={0.2}
          distortionScale={0.5}
          temporalDistortion={0.05}
          clearcoat={1}
          attenuationDistance={2}
          attenuationColor="#ffffff"
        />
      </mesh>
    </Float>
  );
}

// Lazily-loaded 3D scene: keeps three.js/@react-three/drei out of the Portfolio route's
// critical chunk so the grid and filters can paint first.
export default function PortfolioScene({ onReady }) {
  return (
    <Canvas
      gl={{ alpha: true }}
      camera={{ position: [0, 0, 10], fov: 45 }}
      style={{ pointerEvents: 'none' }}
      onCreated={() => {
        requestAnimationFrame(() => requestAnimationFrame(onReady));
      }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.2} />
        <spotLight position={[10, 10, 10]} intensity={4} color="#ffffff" penumbra={1} angle={0.5} />
        <spotLight position={[-10, -10, -10]} intensity={2} color="#3b82f6" penumbra={1} angle={0.5} />
        <Environment files="/hdri/studio_small_03_1k.hdr" />
        <Sparkles count={400} scale={20} size={1.2} speed={0.2} opacity={0.2} color="#ffffff" />
        <AmbientGlass />
      </Suspense>
    </Canvas>
  );
}
