import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import './App.css';

// Lazy load route pages to enable code splitting
const Home = lazy(() => import('./pages/Home'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Films = lazy(() => import('./pages/Films'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Admin = lazy(() => import('./pages/Admin'));

function App() {
  const location = useLocation();
  const [ripples, setRipples] = useState([]);

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

  return (
    <div onClick={handleGlobalClick} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation />
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
            <Route path="/" element={<Home />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/films" element={<Films />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </Suspense>
      </AnimatePresence>
      <Footer />

      {/* Dynamic expanding glass ripples */}
      {ripples.map((ripple) => (
        <span 
          key={ripple.id}
          className="click-ripple"
          style={{ left: ripple.x, top: ripple.y }}
        />
      ))}
    </div>
  );
}

export default App;
