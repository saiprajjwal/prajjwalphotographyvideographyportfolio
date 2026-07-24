import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import { lenisInstance } from './utils/lenisInstance';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import Preloader from './components/Preloader';
import FilmGrain from './components/FilmGrain';
import { EASE, DUR } from './utils/motion';
import './App.css';

// Lazy load route pages to enable code splitting
const Home = lazy(() => import('./pages/Home'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Journal = lazy(() => import('./pages/Journal'));
const JournalEntry = lazy(() => import('./pages/JournalEntry'));
const Films = lazy(() => import('./pages/Films'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Admin = lazy(() => import('./pages/Admin'));
const Editor = lazy(() => import('./pages/Editor'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Store = lazy(() => import('./pages/Store'));

// Lens Shutter Transition Wrapper
function PageTransition({ children }) {
  // A lazy route has resolved and its content is mounting — tell the static
  // boot splash (index.html) it can hand off. rAF waits one frame so the
  // route's own first paint is on screen before the splash fades. Idempotent
  // on the listener side, so firing again on each route change is harmless.
  useEffect(() => {
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event('app-ready')));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <motion.div
      initial={{ clipPath: 'circle(0% at 50% 50%)', opacity: 0 }}
      animate={{ clipPath: 'circle(150% at 50% 50%)', opacity: 1 }}
      exit={{ clipPath: 'circle(0% at 50% 50%)', opacity: 0 }}
      transition={{ duration: DUR.slow, ease: EASE.inOut }} // shared shutter easing
      style={{ width: '100%', minHeight: '100vh', position: 'relative' }}
    >
      {children}
    </motion.div>
  );
}

function App() {
  const location = useLocation();
  const [ripples, setRipples] = useState([]);
  // Shows once per session; append ?intro to any URL to replay it on demand.
  const [showIntro, setShowIntro] = useState(() =>
    !sessionStorage.getItem('site-intro-done') || new URLSearchParams(window.location.search).has('intro')
  );

  const isEditorRoute = location.pathname === '/editor';
  // Full-screen routes hide the marketing nav/footer for an app-like canvas.
  const isChromelessRoute = location.pathname === '/admin';

  // Reset scroll on refresh/load and disable browser auto-scroll memory
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, []);

  // Reset scroll to top when page location changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Lenis inertia scrolling for the whole site. Skipped for reduced-motion
  // users and on the editor (a tool that wants native, immediate scrolling).
  // Framer's useScroll keeps working because Lenis drives the real window scroll.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || isEditorRoute) return;
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    });
    lenisInstance.current = lenis;
    let raf;
    const loop = (time) => { lenis.raf(time); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); lenisInstance.current = null; };
  }, [isEditorRoute]);

  // Block right-click ("Save image as", "Open image in new tab", "Copy image")
  // on photos/videos specifically, without disabling right-click elsewhere on the site
  useEffect(() => {
    const handleContextMenu = (e) => {
      if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  const handleGlobalClick = (e) => {
    const newRipple = {
      id: Date.now() + Math.random(),
      x: e.clientX,
      y: e.clientY
    };
    
    setRipples((prev) => [...prev, newRipple]);

    // Clean up once the 0.65s animation completes
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 650);
  };

  // The landing is a self-contained immersive scroll ending in its own CTA;
  // the global footer would collide with that reveal.
  const isLanding = location.pathname === '/';

  return (
    <div onClick={handleGlobalClick} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AnimatePresence>
        {showIntro && (
          <Preloader
            key="preloader"
            onDone={() => { sessionStorage.setItem('site-intro-done', '1'); setShowIntro(false); }}
          />
        )}
      </AnimatePresence>
      {!isChromelessRoute && <Navigation />}
      <AnimatePresence mode="wait" initial={false}>
        <Suspense fallback={
          <div style={{
            minHeight: '100vh',
            background: '#030303',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.4)',
            fontFamily: 'var(--font-sans)',
            letterSpacing: '0.15em',
            fontSize: '0.9rem',
            textTransform: 'uppercase'
          }}>
            Loading...
          </div>
        }>
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PageTransition><Home /></PageTransition>} />
            <Route path="/portfolio" element={<PageTransition><Portfolio /></PageTransition>} />
            <Route path="/journal" element={<PageTransition><Journal /></PageTransition>} />
            <Route path="/journal/:slug" element={<PageTransition><JournalEntry /></PageTransition>} />
            <Route path="/films" element={<PageTransition><Films /></PageTransition>} />
            <Route path="/about" element={<PageTransition><About /></PageTransition>} />
            <Route path="/contact" element={<PageTransition><Contact /></PageTransition>} />
            <Route path="/admin" element={<PageTransition><Admin /></PageTransition>} />
            <Route path="/editor" element={<PageTransition><Editor /></PageTransition>} />
            <Route path="/store" element={<PageTransition><Store /></PageTransition>} />
            <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Routes>
        </Suspense>
      </AnimatePresence>
      {!isChromelessRoute && !isLanding && <Footer />}

      {/* Dynamic expanding glass ripples */}
      {ripples.map((ripple) => (
        <span 
          key={ripple.id}
          className="click-ripple"
          style={{ left: ripple.x, top: ripple.y }}
        />
      ))}

      {/* Tier 2: Cinematic overlays */}
      <FilmGrain />
    </div>
  );
}

export default App;
