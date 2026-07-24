import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { setSoundEnabled, getSoundEnabled, playFocusTick, playShutterClick } from '../utils/audio';
import Magnetic from './Magnetic';
import './Navigation.css';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(getSoundEnabled());
  const location = useLocation();
  const navRef = useRef(null);
  const overlayRef = useRef(null);

  // Close menu on click outside or ESC key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isOpen && 
        navRef.current && 
        !navRef.current.contains(event.target) &&
        overlayRef.current &&
        !overlayRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscKey = (event) => {
      if (isOpen && event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen]);

  const toggleSound = () => {
    const nextVal = !soundOn;
    setSoundOn(nextVal);
    setSoundEnabled(nextVal);
    if (nextVal) {
      // Play a small delayed click to confirm sound activation
      setTimeout(playShutterClick, 50);
    }
  };

  const links = [
    { path: '/', label: 'Home' },
    { path: '/portfolio', label: 'Portfolio' },
    { path: '/journal', label: 'Journal' },
    { path: '/films', label: 'Films' },
    { path: '/editor', label: 'Editor' },
    { path: '/store', label: 'Store' },
    { path: '/about', label: 'About' },
    { path: '/contact', label: 'Contact' },
  ];

  const isEditor = location.pathname === '/editor';
  // Journal has a /journal/:slug detail route — the nav item should stay lit
  // while reading an entry, not just on the index.
  const isLinkActive = (path) =>
    location.pathname === path || (path === '/journal' && location.pathname.startsWith('/journal/'));

  return (
    <>
      <header className={`nav-header ${isEditor ? 'is-editor-page' : ''}`} ref={navRef}>
        <div className="container nav-container">
          {!isEditor && (
            <Link 
              to="/" 
              className="nav-logo" 
              onClick={() => {
                setIsOpen(false);
                playShutterClick();
              }}
              onMouseEnter={playFocusTick}
            >
              Prajjwal Pandey
            </Link>
          )}

          {/* Desktop Links */}
          {!isEditor && (
            <nav className="nav-links desktop-only">
              {links.map((link) => (
                <Magnetic key={link.path} tolerance={25}>
                  <Link
                    to={link.path}
                    className={`nav-link ${isLinkActive(link.path) ? 'active' : ''}`}
                    onClick={() => {
                      setIsOpen(false);
                      playShutterClick();
                    }}
                    onMouseEnter={playFocusTick}
                  >
                    {link.label}
                  </Link>
                </Magnetic>
              ))}
            </nav>
          )}

          {/* Right side controls (Sound & Hamburger) */}
          <div className="nav-controls">
            <Magnetic tolerance={20}>
              <button 
                className="sound-toggle-btn"
                onClick={toggleSound}
                aria-label="Toggle sound effects"
                onMouseEnter={playFocusTick}
              >
                {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
            </Magnetic>

            <button 
              className={`nav-toggle ${isOpen ? 'open' : ''}`} 
              onClick={() => {
                setIsOpen(!isOpen);
                playShutterClick();
              }}
              onMouseEnter={playFocusTick}
              aria-label="Toggle menu"
            >
              <span className="hamburger-line top"></span>
              <span className="hamburger-line middle"></span>
              <span className="hamburger-line bottom"></span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Full-Screen Overlay */}
      <nav className={`mobile-overlay ${isOpen ? 'open' : ''}`} ref={overlayRef}>
        <div className="mobile-overlay-links">
          {links.map((link, index) => (
            <Link
              key={link.path}
              to={link.path}
              className={`mobile-nav-link ${isLinkActive(link.path) ? 'active' : ''}`}
              style={{ transitionDelay: `${index * 0.05}s` }}
              onClick={() => {
                setIsOpen(false);
                playShutterClick();
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
