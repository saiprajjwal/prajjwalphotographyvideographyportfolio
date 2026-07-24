import { useRef, Suspense, useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useVelocity } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, MeshTransmissionMaterial, Sparkles, Image, Float } from '@react-three/drei';
import * as THREE from 'three';
import { InstagramIcon, YoutubeIcon, TiktokIcon, PinterestIcon } from '../components/Icons';
import Magnetic from '../components/Magnetic';
import CircularCarousel from '../components/CircularCarousel';
import Footer from '../components/Footer';
import '../components/Footer.css';
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
function GlassMonolith({ scrollYProgress, isShattering }) {
  const meshRef = useRef();
  const { viewport } = useThree();

  // If the viewport is narrow (mobile phone), scale the glass down
  const isMobile = viewport.width < 6;
  const glassWidth = isMobile ? 2.8 : 4.5;
  const glassHeight = isMobile ? 4.5 : 6.5;
  const glassDepth = isMobile ? 0.5 : 0.8;

  const { geometry, shardData, origPositions } = useMemo(() => {
    // Subdivide the box into many pieces
    const box = new THREE.BoxGeometry(glassWidth, glassHeight, glassDepth, 8, 10, 2);
    const nonIndexed = box.toNonIndexed();
    
    const count = nonIndexed.attributes.position.count;
    const numTriangles = count / 3;
    
    const shardData = [];
    const pos = nonIndexed.attributes.position.array;
    const origPositions = new Float32Array(pos);
    
    for (let i = 0; i < numTriangles; i++) {
      const i9 = i * 9;
      const center = new THREE.Vector3(
        (pos[i9] + pos[i9+3] + pos[i9+6]) / 3,
        (pos[i9+1] + pos[i9+4] + pos[i9+7]) / 3,
        (pos[i9+2] + pos[i9+5] + pos[i9+8]) / 3
      );
      
      // Explosion velocity: push outward from center
      const velocity = center.clone().normalize().multiplyScalar(Math.random() * 6 + 2);
      // Add general forward/upward motion toward camera (z is forward)
      velocity.z += Math.random() * 8 + 4; 
      velocity.y += Math.random() * 6 - 3;
      
      // Rotation axis and speed
      const rotAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const rotSpeed = Math.random() * 10 + 2;
      
      shardData.push({ center, velocity, rotAxis, rotSpeed });
    }
    
    return { geometry: nonIndexed, shardData, origPositions };
  }, [glassWidth, glassHeight, glassDepth]);

  const shatterTime = useRef(0);
  const v3 = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const offset = scrollYProgress.get(); // 0 to 1

    if (isShattering) {
      shatterTime.current += delta;
      const st = shatterTime.current;
      const positions = geometry.attributes.position.array;
      
      for (let i = 0; i < shardData.length; i++) {
        const shard = shardData[i];
        const i9 = i * 9;
        
        // Calculate displacement
        const dispX = shard.velocity.x * st;
        const dispY = shard.velocity.y * st - (4.9 * st * st); // Gravity
        const dispZ = shard.velocity.z * st;
        
        q.setFromAxisAngle(shard.rotAxis, shard.rotSpeed * st);
        
        for (let v = 0; v < 3; v++) {
          const iv = i9 + v * 3;
          v3.set(
            origPositions[iv] - shard.center.x,
            origPositions[iv+1] - shard.center.y,
            origPositions[iv+2] - shard.center.z
          );
          
          v3.applyQuaternion(q);
          
          positions[iv] = v3.x + shard.center.x + dispX;
          positions[iv+1] = v3.y + shard.center.y + dispY;
          positions[iv+2] = v3.z + shard.center.z + dispZ;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.computeVertexNormals();
      
      // Keep it centered but let the shards expand
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, 0, 0.05);
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, 0, 0.05);
      
    } else {
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

      // Restore the smooth, slow progression of the monolith
      const targetZ = 2 + (offset * 10);
      meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, targetZ, 0.1);

      // Fade out slowly so it feels cinematic
      if (meshRef.current.material) {
        // Fade out between 35% and 65% scroll
        const opacity = 1 - THREE.MathUtils.clamp((offset - 0.35) / (0.65 - 0.35), 0, 1);
        meshRef.current.material.transparent = true;
        meshRef.current.material.opacity = opacity;
        meshRef.current.visible = opacity > 0;
      }
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={isShattering ? 0 : 0} floatIntensity={isShattering ? 0 : 0.5}>
      <mesh ref={meshRef} position={[0, 0, 2]} scale={1} geometry={geometry}>
        <MeshTransmissionMaterial
          transparent={true}
          backside={true}
          samples={isMobile ? 4 : 8}
          resolution={isMobile ? 256 : 512}
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
  const [isShattering, setIsShattering] = useState(false);
  const navigate = useNavigate();

  const handleEnterGallery = (e) => {
    e.preventDefault();
    setIsShattering(true);
    setTimeout(() => {
      navigate('/portfolio');
    }, 1500); // 1.5s shatter duration before navigating
  };

  const socialLinks = [
    { name: 'Instagram', url: 'https://www.instagram.com/saiprajjwal', icon: <InstagramIcon /> },
    { name: 'YouTube', url: 'https://www.youtube.com/@Prajjwalpandey9', icon: <YoutubeIcon /> },
    { name: 'TikTok', url: 'https://www.tiktok.com/@prajjwalp', icon: <TiktokIcon /> },
    { name: 'Pinterest', url: 'https://au.pinterest.com/saiprajjwal/', icon: <PinterestIcon /> }
  ];

  // Native window scroll tracker
  const { scrollYProgress } = useScroll();

  // Fly-through effect on the hero text as you scroll. Multi-point ranges pin
  // the values flat outside the active band so the hero can't re-appear later
  // (useTransform was extrapolating and bringing it back at full scroll).
  const heroTextOpacity = useTransform(scrollYProgress, [0, 0.12, 0.16, 1], [1, 0, 0, 0]);
  const heroTextScale = useTransform(scrollYProgress, [0, 0.16, 1], [1, 6, 6]);
  const heroTextBlur = useTransform(scrollYProgress, [0, 0.16], ['blur(0px)', 'blur(20px)']);
  const heroPointer = useTransform(scrollYProgress, (v) => (v < 0.16 ? 'auto' : 'none'));

  // "The Vision is Clear" CTA — overlaps the end of the monolith fade for a seamless reveal
  const enterOpacity = useTransform(scrollYProgress, [0, 0.55, 0.62, 0.72, 0.78, 1], [0, 0, 1, 1, 0, 0]);
  const enterScale   = useTransform(scrollYProgress, [0.55, 0.62, 0.72, 0.78], [0.85, 1, 1, 1.06]);
  const enterPointer = useTransform(scrollYProgress, (v) => (v > 0.55 && v < 0.78 ? 'auto' : 'none'));

  // Carousel — fades in smoothly AFTER the CTA fades out
  const carouselOpacity = useTransform(scrollYProgress, [0, 0.78, 0.85, 0.95, 1], [0, 0, 1, 1, 0]);
  const carouselScale  = useTransform(scrollYProgress, [0.78, 0.85, 0.95, 1], [0.95, 1, 1, 1.02]);
  const carouselPointer = useTransform(scrollYProgress, (v) => (v > 0.78 ? 'auto' : 'none'));

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
          gl={{ alpha: true, antialias: false }}
          dpr={[1, 1.5]}
          camera={{ position: [0, 0, 10], fov: 45 }}
        >
          <Suspense fallback={null}>
            <ambientLight intensity={0.2} />
            <spotLight position={[10, 10, 10]} intensity={4} color="#ffffff" penumbra={1} angle={0.5} />
            <spotLight position={[-10, -10, -10]} intensity={2} color="#3b82f6" penumbra={1} angle={0.5} />
            <Environment files="/hdri/studio_small_03_256.hdr" />
            <Sparkles count={800} scale={20} size={1.5} speed={0.4} opacity={0.3} color="#ffffff" />
            <BackgroundGallery scrollYProgress={scrollYProgress} />
            <GlassMonolith scrollYProgress={scrollYProgress} isShattering={isShattering} />
            <CanvasLoader onLoad={() => setCanvasReady(true)} />
          </Suspense>
        </Canvas>
      </div>
    

      {/* 550vh Scroll Container — 3D overlays are fixed; this just creates the scroll room */}
      <div className="home-scroll-content" style={{ height: '550vh', position: 'relative' }}>

        {/* Initial Hero Text - Flies forward and blurs on scroll */}
        <motion.div
          className="monolith-content-overlay"
          style={{
            opacity: heroTextOpacity,
            scale: heroTextScale,
            filter: heroTextBlur,
            pointerEvents: heroPointer
          }}
        >
          <div className="monolith-text-container">
            <h1 className="hero-title">Prajjwal Pandey</h1>
            <p className="hero-subtitle">Photographer | Storyteller</p>
            <div style={{ marginTop: '2.5rem' }}>
              <Link to="/portfolio" className="btn-glass">
                My Work
              </Link>
            </div>
          </div>

          <div className="scroll-indicator">
            <span>Scroll</span>
            <div className="scroll-line"></div>
          </div>
        </motion.div>
        {/* Final CTA text — fixed overlay, mid scroll */}
        <motion.div className="monolith-content-overlay" style={{ opacity: enterOpacity, scale: enterScale, pointerEvents: enterPointer }}>
          <div className="monolith-text-container">
            <h2 className="section-heading">The Vision is Clear.</h2>
            <a href="/portfolio" onClick={handleEnterGallery} className="btn-monolith mt-8">
              Enter Gallery
            </a>
            
            <div className="social-icons-glass" style={{ marginTop: '3rem' }}>
              {socialLinks.map((link) => (
                <Magnetic key={link.name} tolerance={30}>
                  <a 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="social-glass-btn"
                    aria-label={link.name}
                  >
                    {link.icon}
                  </a>
                </Magnetic>
              ))}
            </div>
          </div>
        </motion.div>

        {/* 3D Circular Carousel — fixed overlay, appears after CTA fades */}
        <motion.div
          className="monolith-content-overlay"
          style={{
            opacity: carouselOpacity,
            scale: carouselScale,
            pointerEvents: carouselPointer,
          }}
        >
          <CircularCarousel />
        </motion.div>

        {/* Footer — absolute, lives at the very bottom of the scroll flow */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', zIndex: 10 }}>
          <Footer />
        </div>

      </div>
    </motion.div>
  );
}
