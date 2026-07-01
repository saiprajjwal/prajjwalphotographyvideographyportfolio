import { useRef, Suspense, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, MeshTransmissionMaterial, Sparkles, Image, Float } from '@react-three/drei';
import * as THREE from 'three';
import './Home.css';

// Helper component that mounts only AFTER all Suspense resources inside the Canvas have loaded
function CanvasLoader({ onLoad }) {
  useEffect(() => {
    // Set canvasReady to true with a slight frame delay to ensure R3F has fully painted the first frame
    const handle = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onLoad();
      });
    });
    return () => cancelAnimationFrame(handle);
  }, [onLoad]);
  return null;
}

// The Massive Glass Monolith (Reacts to scroll as a single majestic piece)
function GlassMonolith({ scrollYProgress }) {
  const meshRef = useRef();
  const { viewport } = useThree();

  // If the viewport is narrow (mobile phone), scale the glass down
  const isMobile = viewport.width < 6;
  const glassWidth = isMobile ? 2.8 : 4.5;
  const glassHeight = isMobile ? 4.5 : 6.5;
  const glassDepth = isMobile ? 0.5 : 0.8;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const offset = scrollYProgress.get(); // 0 to 1

    // Smooth continuous majestic rotation
    const baseRotY = t * 0.15;
    const baseRotX = Math.sin(t * 0.5) * 0.1;

    // Highly responsive mouse parallax
    const mouseX = (state.mouse.x * Math.PI) / 4;
    const mouseY = (state.mouse.y * Math.PI) / 4;

    // SCROLL INTERACTION: Dramatic spin and tilt
    const scrollSpinY = offset * Math.PI * 2; // Full 360 spin on scroll
    const scrollTiltX = offset * Math.PI * 0.5; // Tilt heavily

    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, baseRotY + mouseX + scrollSpinY, 0.1);
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, baseRotX - mouseY + scrollTiltX, 0.1);

    // Push the monolith closer to the camera on scroll until it engulfs the view
    // Camera is at Z=10, push it up to Z=12
    const targetZ = 2 + (offset * 10);
    meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, targetZ, 0.1);

    // Fade out the monolith directly from scroll progress (not the lerped/lagging
    // z-position) so the reveal tracks the scrollbar 1:1 regardless of scroll speed.
    if (meshRef.current.material) {
      const opacity = 1 - THREE.MathUtils.clamp((offset - 0.55) / (0.78 - 0.55), 0, 1);
      meshRef.current.material.transparent = true;
      meshRef.current.material.opacity = opacity;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0} floatIntensity={0.5}>
      <mesh ref={meshRef} position={[0, 0, 2]}>
        <boxGeometry args={[glassWidth, glassHeight, glassDepth]} />
        <MeshTransmissionMaterial
          transparent={true}
          backside={true}
          samples={isMobile ? 4 : 16}
          resolution={isMobile ? 256 : 1024}
          transmission={1}
          roughness={0.0}
          thickness={1.5}
          ior={1.4}
          chromaticAberration={0.06}
          anisotropy={0.3}
          distortion={0.1}
          distortionScale={0.5}
          temporalDistortion={0.1}
          clearcoat={1}
          attenuationDistance={2}
          attenuationColor="#ffffff"
        />
      </mesh>
    </Float>
  );
}

// Background Gallery that gets refracted by the glass
function BackgroundGallery({ scrollYProgress }) {
  const groupRef = useRef();

  useFrame((state) => {
    // Parallax effect on mouse move
    const targetX = -(state.mouse.x * 2);
    const targetY = -(state.mouse.y * 2);

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetX, 0.05);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, 0.05);

    // Animate scale to zoom in as the glass lifts away
    if (scrollYProgress) {
      const scrollVal = scrollYProgress.get();
      const targetScale = 1 + (scrollVal * 0.15);
      groupRef.current.scale.set(targetScale, targetScale, targetScale);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, -6]}>
      {/* Massive Background Copy to fill wide screens with color instead of black */}
      <Image
        url="/Home/heroimage.png"
        transparent
        scale={[40, 50]}
        position={[0, 0, -5]}
        opacity={0.3}
        toneMapped={false}
      />

      {/* Single Center Hero Image properly scaled to its portrait aspect ratio */}
      <Image
        url="/Home/heroimage.png"
        transparent
        scale={[10.6, 13.25]}
        position={[0, 0, 0]}
        toneMapped={false}
      />
    </group>
  );
}

export default function Home() {
  const [canvasReady, setCanvasReady] = useState(false);

  // Native window scroll tracker
  const { scrollYProgress } = useScroll();

  // Fade out ONLY the hero text as you scroll
  const heroTextOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroTextY = useTransform(scrollYProgress, [0, 0.2], [0, -50]);

  // Bring in the "Enter" text at the end of the scroll
  const enterOpacity = useTransform(scrollYProgress, [0.7, 1], [0, 1]);

  return (
    <motion.div
      className="home-wrapper-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      {/* Immediate fallback background image so the user never sees a black screen while Canvas compiles */}
      <div
        className="home-fallback-bg"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
          backgroundImage: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.05) 0%, rgba(0, 0, 0, 0) 70%), url("/Home/heroimage.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: canvasReady ? 0 : 1,
          transition: 'opacity 1s ease-out',
          pointerEvents: 'none'
        }}
      />

      {/* 3D canvas — fades in once GPU shader compiles */}
      <div
        className="monolith-canvas-fixed"
        style={{
          opacity: canvasReady ? 1 : 0,
          transition: 'opacity 1s ease-out',
          zIndex: 1
        }}
      >
        <Canvas
          gl={{ alpha: true }}
          camera={{ position: [0, 0, 10], fov: 45 }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.2} />
            <spotLight position={[10, 10, 10]} intensity={4} color="#ffffff" penumbra={1} angle={0.5} />
            <spotLight position={[-10, -10, -10]} intensity={2} color="#3b82f6" penumbra={1} angle={0.5} />
            <Environment preset="studio" />
            <Sparkles count={800} scale={20} size={1.5} speed={0.4} opacity={0.3} color="#ffffff" />
            <BackgroundGallery scrollYProgress={scrollYProgress} />
            <GlassMonolith scrollYProgress={scrollYProgress} />
            <CanvasLoader onLoad={() => setCanvasReady(true)} />
          </Suspense>
        </Canvas>
      </div>

      {/* 300vh Scroll Container to create the scrollbar without actual HTML content below */}
      <div className="home-scroll-content" style={{ height: '300vh' }}>

        {/* Initial Hero Text - Fades out on scroll */}
        <motion.div className="monolith-content-overlay" style={{ opacity: heroTextOpacity, y: heroTextY }}>
          <div className="monolith-text-container">
            <h1 className="hero-title">Prajjwal Pandey</h1>
            <p className="hero-subtitle">Photographer | Storyteller</p>
            <div style={{ marginTop: '2.5rem' }}>
              <Link to="/portfolio" className="btn-glass">
                My Work
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Final Text at bottom of scroll */}
        <motion.div className="monolith-content-overlay" style={{ opacity: enterOpacity }}>
          <div className="monolith-text-container">
            <h2 className="section-heading">The Vision is Clear.</h2>
            <Link to="/portfolio" className="btn-monolith mt-8">
              Enter Gallery
            </Link>
          </div>
        </motion.div>

      </div>
    </motion.div>
  );
}
