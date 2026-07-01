import { useState, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, MeshTransmissionMaterial, Sparkles, Float } from '@react-three/drei';
import * as THREE from 'three';
import Lightbox from '../components/Lightbox';
import portfolioData from '../data/portfolio.json';
import './Portfolio.css';

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
          samples={16}
          resolution={1024}
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

export default function Portfolio() {
  const [filter, setFilter] = useState('All');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [canvasReady, setCanvasReady] = useState(false);

  const categories = portfolioData.categories;
  
  const filteredPhotos = filter === 'All' 
    ? portfolioData.photos 
    : portfolioData.photos.filter(photo => photo.category === filter);

  const openLightbox = (index) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const nextPhoto = () => setLightboxIndex((prev) => (prev + 1) % filteredPhotos.length);
  const prevPhoto = () => setLightboxIndex((prev) => (prev - 1 + filteredPhotos.length) % filteredPhotos.length);

  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const pctX = (x / rect.width) - 0.5;
    const pctY = (y / rect.height) - 0.5;

    // Pan the image inside its crop window to follow mouse movement
    const moveX = pctX * 16; // up to 8px horizontal translation
    const moveY = pctY * 16; // up to 8px vertical translation

    const img = card.querySelector('.portfolio-image');
    if (img) {
      img.style.transform = `scale(1.08) translate(${moveX}px, ${moveY}px)`;
    }
  };

  const handleMouseLeave = (e) => {
    const img = e.currentTarget.querySelector('.portfolio-image');
    if (img) {
      img.style.transform = ''; // Return smoothly via CSS transition
    }
  };

  return (
    <motion.div 
      className="portfolio-wrapper-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      {/* 3D Background Canvas */}
      <div 
        className="portfolio-canvas-fixed"
        style={{
          opacity: canvasReady ? 1 : 0,
          transition: 'opacity 1s ease-out',
        }}
      >
        <Canvas
          gl={{ alpha: true }}
          camera={{ position: [0, 0, 10], fov: 45 }}
          style={{ pointerEvents: 'none' }}
          onCreated={() => {
            requestAnimationFrame(() => requestAnimationFrame(() => setCanvasReady(true)));
          }}
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

      {/* Main Content Overlay */}
      <main className="page-wrapper section-padding portfolio-content-overlay">
        <div className="container">
          <header className="page-header">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              Portfolio
            </motion.h1>
            
            <motion.div 
              className="filter-nav"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {categories.map(cat => (
                <button 
                  key={cat}
                  className={`filter-btn ${filter === cat ? 'active' : ''}`}
                  onClick={() => setFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </motion.div>
          </header>

          <motion.div layout className="masonry-grid">
            <AnimatePresence mode="popLayout">
              {filteredPhotos.map((photo, index) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ 
                    duration: 0.5, 
                    ease: [0.16, 1, 0.3, 1],
                    layout: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } 
                  }}
                  key={photo.id} 
                  className="masonry-item"
                  onClick={() => openLightbox(index)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                >
                  <img 
                    src={photo.src} 
                    alt={photo.alt} 
                    loading="lazy"
                    className="portfolio-image"
                  />
                  <div className="image-overlay">
                    <span className="image-category">{photo.category}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>

        <Lightbox 
          photos={filteredPhotos}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onNext={nextPhoto}
          onPrev={prevPhoto}
        />
      </main>
    </motion.div>
  );
}
