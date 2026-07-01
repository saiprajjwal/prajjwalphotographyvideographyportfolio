import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { setSoundEnabled, getSoundEnabled, playFocusTick, playShutterClick } from '../utils/audio';
import Magnetic from './Magnetic';
import './Navigation.css';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(getSoundEnabled());
  const location = useLocation();

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
    { path: '/films', label: 'Films' },
    { path: '/about', label: 'About' },
    { path: '/contact', label: 'Contact' },
  ];

  return (
    <header className="nav-header">
      <div className="container nav-container">
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

        {/* Desktop & Mobile Links */}
        <nav className={`nav-links ${isOpen ? 'open' : ''}`}>
          {links.map((link) => (
            <Magnetic key={link.path} tolerance={25}>
              <Link
                to={link.path}
                className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
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
  );
}
