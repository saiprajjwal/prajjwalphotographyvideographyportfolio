import { useRef, Suspense, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useVelocity } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, MeshTransmissionMaterial, Sparkles, Image, Float } from '@react-three/drei';
import * as THREE from 'three';
import { InstagramIcon, YoutubeIcon, TiktokIcon, PinterestIcon } from '../components/Icons';
import Magnetic from '../components/Magnetic';
import CircularCarousel from '../components/CircularCarousel';
import { EASE } from '../utils/motion';
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

// Ease used for the entry settle — same expo-out as the rest of the site
// (--ease-out / EASE.out in utils/motion.js), hand-applied here since this
// runs inside useFrame rather than framer-motion.
function easeOutExpo(x) {
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

// The Massive Glass Monolith (Reacts to scroll as a single majestic piece)
//
// `ready` marks the moment the canvas becomes visible (see canvasReady in
// Home()). Before that the glass sits at its most unsettled pose — rotated
// off-axis, pulled back, slightly smaller — so the instant it fades in, the
// first thing a visitor sees is it actively arriving, not already at rest.
function GlassMonolith({ scrollYProgress, ready }) {
  const meshRef = useRef();
  const { viewport } = useThree();
  const entryStart = useRef(null);
  // Skip the dramatic off-axis arrival for reduced-motion users — they get
  // the glass at its resting pose immediately instead of a 2s settle.
  const reduceMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ).current;

  useEffect(() => {
    if (ready) entryStart.current = reduceMotion ? -Infinity : performance.now();
  }, [ready, reduceMotion]);

  // If the viewport is narrow (mobile phone), scale the glass down
  const isMobile = viewport.width < 6;
  const glassWidth = isMobile ? 2.8 : 4.5;
  const glassHeight = isMobile ? 4.5 : 6.5;
  const glassDepth = isMobile ? 0.5 : 0.8;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const offset = scrollYProgress.get(); // 0 to 1

    // 0 the instant `ready` flips, eases to 1 over ~2s — the entry settle.
    // Held at 0 (fully unsettled) until then, since the canvas is invisible
    // anyway and there's no reason to burn the arrival while unseen.
    const entrySettle = entryStart.current
      ? easeOutExpo(Math.min((performance.now() - entryStart.current) / 2000, 1))
      : 0;
    const entryRemaining = 1 - entrySettle;

    // Smooth continuous majestic rotation
    const baseRotY = t * 0.15;
    const baseRotX = Math.sin(t * 0.5) * 0.1;

    // Highly responsive mouse parallax
    const mouseX = (state.mouse.x * Math.PI) / 4;
    const mouseY = (state.mouse.y * Math.PI) / 4;

    // SCROLL INTERACTION: Dramatic spin and tilt
    const scrollSpinY = offset * Math.PI * 2; // Full 360 spin on scroll
    const scrollTiltX = offset * Math.PI * 0.5; // Tilt heavily

    // Entry offset: arrives from an off-axis spin/tilt that unwinds to 0
    const entrySpinY = entryRemaining * -Math.PI * 0.65;
    const entryTiltX = entryRemaining * Math.PI * 0.22;

    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, baseRotY + mouseX + scrollSpinY + entrySpinY, 0.1);
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, baseRotX - mouseY + scrollTiltX + entryTiltX, 0.1);

    // Restore the smooth, slow progression of the monolith, plus a touch of
    // extra depth on entry — it settles forward into its resting position.
    const targetZ = 2 + (offset * 10) + entryRemaining * 1.6;
    meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, targetZ, 0.1);

    // Arrives very slightly undersized and grows into full scale
    const entryScale = 0.9 + entrySettle * 0.1;
    meshRef.current.scale.setScalar(entryScale);

    // Fade out slowly so it feels cinematic
    if (meshRef.current.material) {
      // Fade out between 35% and 65% scroll
      const opacity = 1 - THREE.MathUtils.clamp((offset - 0.35) / (0.65 - 0.35), 0, 1);
      meshRef.current.material.transparent = true;
      meshRef.current.material.opacity = opacity;
      meshRef.current.visible = opacity > 0;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0} floatIntensity={0.5}>
      <mesh ref={meshRef} position={[0, 0, 2]} scale={1}>
        <boxGeometry args={[glassWidth, glassHeight, glassDepth]} />
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
  const reduceMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ).current;

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
            <GlassMonolith scrollYProgress={scrollYProgress} ready={canvasReady} />
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
            {/* The name resolves in the same ~2s window the glass takes to
                settle (see GlassMonolith's entrySettle) — starting heavily
                blurred and oversized, as if being seen through the glass
                before it clears, rather than just fading in beside it.
                Reduced-motion users get a plain, quick fade instead. */}
            <motion.h1
              className="hero-title"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.16, filter: 'blur(24px)' }}
              animate={
                canvasReady
                  ? (reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, filter: 'blur(0px)' })
                  : (reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.16, filter: 'blur(24px)' })
              }
              transition={{ duration: reduceMotion ? 0.4 : 2, ease: EASE.out }}
            >
              Prajjwal Pandey
            </motion.h1>
            <motion.p
              className="hero-subtitle"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
              animate={canvasReady ? { opacity: 1, y: 0 } : { opacity: 0, y: reduceMotion ? 0 : 14 }}
              transition={{ duration: reduceMotion ? 0.3 : 0.9, ease: EASE.out, delay: canvasReady ? (reduceMotion ? 0.15 : 0.9) : 0 }}
            >
              Photographer | Storyteller
            </motion.p>
            <motion.div
              style={{ marginTop: '2.5rem' }}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 14 }}
              animate={canvasReady ? { opacity: 1, y: 0 } : { opacity: 0, y: reduceMotion ? 0 : 14 }}
              transition={{ duration: reduceMotion ? 0.3 : 0.9, ease: EASE.out, delay: canvasReady ? (reduceMotion ? 0.25 : 1.05) : 0 }}
            >
              <Link to="/portfolio" className="btn-glass">
                My Work
              </Link>
            </motion.div>
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
            <Link to="/portfolio" className="btn-monolith mt-8">
              Enter Gallery
            </Link>
            
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
