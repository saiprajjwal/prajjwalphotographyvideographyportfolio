import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import './Navigation.css';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

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
        <Link to="/" className="nav-logo" onClick={() => setIsOpen(false)}>
          Prajjwal Pandey
        </Link>

        {/* Custom Animated Hamburger */}
        <button 
          className={`nav-toggle ${isOpen ? 'open' : ''}`} 
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle menu"
        >
          <span className="hamburger-line top"></span>
          <span className="hamburger-line middle"></span>
          <span className="hamburger-line bottom"></span>
        </button>

        {/* Desktop & Mobile Links */}
        <nav className={`nav-links ${isOpen ? 'open' : ''}`}>
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
