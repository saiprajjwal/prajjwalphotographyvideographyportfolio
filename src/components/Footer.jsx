import React from 'react';
import { InstagramIcon, YoutubeIcon, TiktokIcon, PinterestIcon } from './Icons';
import Magnetic from './Magnetic';
import './Footer.css';

export default function Footer() {
  const socialLinks = [
    {
      name: 'Instagram',
      url: 'https://www.instagram.com/saiprajjwal',
      icon: <InstagramIcon />
    },
    {
      name: 'YouTube',
      url: 'https://www.youtube.com/@Prajjwalpandey9',
      icon: <YoutubeIcon />
    },
    {
      name: 'TikTok',
      url: 'https://www.tiktok.com/@prajjwalp',
      icon: <TiktokIcon />
    },
    {
      name: 'Pinterest',
      url: 'https://au.pinterest.com/saiprajjwal/',
      icon: <PinterestIcon />
    }
  ];

  return (
    <footer className="glass-footer">
      <div className="footer-container">
        <div className="footer-content">
          <p className="copyright">
            © {new Date().getFullYear()} Prajjwal Pandey. All rights reserved.
          </p>
          <div className="social-icons-glass">
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
      </div>
    </footer>
  );
}
