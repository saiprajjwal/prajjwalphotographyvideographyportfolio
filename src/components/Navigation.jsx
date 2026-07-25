import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, ArrowUpRight } from 'lucide-react';
import { setSoundEnabled, getSoundEnabled, playFocusTick, playShutterClick } from '../utils/audio';
import { InstagramIcon, YoutubeIcon, TiktokIcon, PinterestIcon } from './Icons';
import { lenisInstance } from '../utils/lenisInstance';
import portfolioData from '../data/portfolio.json';
import Magnetic from './Magnetic';
import './Navigation.css';

// Desktop keeps the flat inline link row. The full-screen glass menu below
// is for mobile — where a flat row never fit anyway — and for the Editor's
// minimal capsule, which always used a toggle rather than inline links.
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

  // The overlay is a full commitment, same as Portfolio's category reveal —
  // lock the page behind it so scroll doesn't leak through the glass.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      lenisInstance.current?.stop();
    } else {
      document.body.style.overflow = '';
      lenisInstance.current?.start();
    }
    return () => {
      document.body.style.overflow = '';
      lenisInstance.current?.start();
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
  ];

  const cta = { path: '/contact', label: 'Inquire', highlight: true };

  const { social, email } = portfolioData.about;

  const isEditor = location.pathname === '/editor';
  // Journal has a /journal/:slug detail route — the entry stays lit while
  // reading a story, not just on the index.
  const isLinkActive = (path) =>
    location.pathname === path || (path === '/journal' && location.pathname.startsWith('/journal/'));

  const closeAndClick = () => {
    setIsOpen(false);
    playShutterClick();
  };

  return (
    <>
      <header className={`nav-header ${isEditor ? 'is-editor-page' : ''}`} ref={navRef}>
        <div className="container nav-container">
          {!isEditor && (
            <Link
              to="/"
              className="nav-logo"
              onClick={closeAndClick}
              onMouseEnter={playFocusTick}
            >
              Prajjwal Pandey
            </Link>
          )}

          {/* Flat inline links, desktop only — the full-screen menu below is
              for mobile (and the Editor's minimal capsule), not desktop. */}
          {!isEditor && (
            <nav className="nav-links desktop-only">
              {links.map((link) => (
                <Magnetic key={link.path} tolerance={25}>
                  <Link
                    to={link.path}
                    className={`nav-link ${isLinkActive(link.path) ? 'active' : ''}`}
                    onClick={closeAndClick}
                    onMouseEnter={playFocusTick}
                  >
                    {link.label}
                  </Link>
                </Magnetic>
              ))}
              <Magnetic tolerance={25}>
                <Link
                  to={cta.path}
                  className={`nav-link nav-cta ${isLinkActive(cta.path) ? 'active' : ''}`}
                  onClick={closeAndClick}
                  onMouseEnter={playFocusTick}
                >
                  {cta.label}
                </Link>
              </Magnetic>
            </nav>
          )}

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

            <Magnetic tolerance={20}>
              <button
                className={`nav-menu-btn ${isOpen ? 'open' : ''}`}
                onClick={() => { setIsOpen(!isOpen); playShutterClick(); }}
                onMouseEnter={playFocusTick}
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isOpen}
              >
                <span className="nav-menu-btn__label">{isOpen ? 'Close' : 'Menu'}</span>
                <span className="nav-toggle" aria-hidden="true">
                  <span className="hamburger-line top"></span>
                  <span className="hamburger-line middle"></span>
                  <span className="hamburger-line bottom"></span>
                </span>
              </button>
            </Magnetic>
          </div>
        </div>
      </header>

      {/* Full-screen cinematic menu */}
      <nav className={`nav-overlay ${isOpen ? 'open' : ''}`} ref={overlayRef} aria-hidden={!isOpen}>
        <div className="nav-overlay-inner">
          <div className="nav-overlay-links">
            {links.map((link, index) => (
              <Link
                key={link.path}
                to={link.path}
                className={`nav-overlay-link ${isLinkActive(link.path) ? 'active' : ''}`}
                style={{ transitionDelay: `${index * 0.045}s` }}
                onClick={closeAndClick}
                onMouseEnter={playFocusTick}
                tabIndex={isOpen ? 0 : -1}
              >
                <span className="nav-overlay-link__no">{String(index + 1).padStart(2, '0')}</span>
                <span className="nav-overlay-link__label">{link.label}</span>
                <ArrowUpRight className="nav-overlay-link__arrow" size={22} strokeWidth={1.6} aria-hidden="true" />
              </Link>
            ))}
            <Link
              to={cta.path}
              className={`nav-overlay-link nav-overlay-link--cta ${isLinkActive(cta.path) ? 'active' : ''}`}
              style={{ transitionDelay: `${links.length * 0.045}s` }}
              onClick={closeAndClick}
              onMouseEnter={playFocusTick}
              tabIndex={isOpen ? 0 : -1}
            >
              <span className="nav-overlay-link__no">{String(links.length + 1).padStart(2, '0')}</span>
              <span className="nav-overlay-link__label">{cta.label}</span>
              <ArrowUpRight className="nav-overlay-link__arrow" size={22} strokeWidth={1.6} aria-hidden="true" />
            </Link>
          </div>

          <div className="nav-overlay-footer">
            <a href={`mailto:${email}`} className="nav-overlay-email" tabIndex={isOpen ? 0 : -1}>
              {email}
            </a>
            <div className="nav-overlay-social">
              {[
                { href: social?.instagram, label: 'Instagram', Icon: InstagramIcon },
                { href: social?.youtube, label: 'YouTube', Icon: YoutubeIcon },
                { href: social?.tiktok, label: 'TikTok', Icon: TiktokIcon },
                { href: social?.pinterest, label: 'Pinterest', Icon: PinterestIcon },
              ].filter((s) => s.href).map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  tabIndex={isOpen ? 0 : -1}
                  onMouseEnter={playFocusTick}
                >
                  <Icon size={17} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
