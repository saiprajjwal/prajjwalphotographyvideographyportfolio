import { useState, useRef, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, MeshTransmissionMaterial, Sparkles, Float } from '@react-three/drei';
import * as THREE from 'three';
import VideoCard from '../components/VideoCard';
import VideoLightbox from '../components/VideoLightbox';
import portfolioData from '../data/portfolio.json';
import './Films.css';

// A subtle, slow-spinning glass monolith for the background
function AmbientGlass() {
  const meshRef = useRef();
  const { viewport } = useThree();
  
  const isMobile = viewport.width < 6;
  const glassWidth = isMobile ? 3 : 6;
  const glassHeight = isMobile ? 5 : 8;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    meshRef.current.rotation.y = t * 0.05; 
    meshRef.current.rotation.x = Math.sin(t * 0.2) * 0.1;

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
          samples={isMobile ? 4 : 16} 
          resolution={isMobile ? 256 : 1024} 
          transmission={1} 
          roughness={0.1}
          thickness={1.5} ior={1.3} chromaticAberration={0.05} anisotropy={0.2}
          distortion={0.2} distortionScale={0.5} temporalDistortion={0.05}
          clearcoat={1} attenuationDistance={2} attenuationColor="#ffffff"
        />
      </mesh>
    </Float>
  );
}

export default function Films() {
  const [canvasReady, setCanvasReady] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const videos = portfolioData.videos;

  return (
    <motion.div 
      className="films-wrapper-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      {/* 3D Background Canvas */}
      <div 
        className="films-canvas-fixed"
        style={{ opacity: canvasReady ? 1 : 0, transition: 'opacity 1s ease-out' }}
      >
        <Canvas 
          gl={{ alpha: true }}
          camera={{ position: [0, 0, 10], fov: 45 }} 
          style={{ pointerEvents: 'none' }} 
          onCreated={() => requestAnimationFrame(() => requestAnimationFrame(() => setCanvasReady(true)))}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.2} />
            <spotLight position={[10, 10, 10]} intensity={4} color="#ffffff" penumbra={1} angle={0.5} />
            <spotLight position={[-10, -10, -10]} intensity={2} color="#3b82f6" penumbra={1} angle={0.5} />
            <Environment preset="studio" />
            <Sparkles count={400} scale={20} size={1.2} speed={0.2} opacity={0.2} color="#ffffff" />
            <AmbientGlass />
          </Suspense>
        </Canvas>
      </div>

      <main className="page-wrapper section-padding films-content-overlay">
        <div className="container">
          <header className="page-header">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              Films
            </motion.h1>
          </header>

          <div className="video-grid">
            {videos.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + (index * 0.1), duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <VideoCard video={video} onPlay={() => setActiveVideo(video)} />
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      {/* Cinematic Fullscreen Lightbox Modal */}
      {activeVideo && (
        <VideoLightbox 
          video={activeVideo} 
          onClose={() => setActiveVideo(null)} 
        />
      )}
    </motion.div>
  );
}
