import React from 'react';
import { InstagramIcon, YoutubeIcon, TiktokIcon, PinterestIcon } from './Icons';
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
      url: 'https://au.pinterest.com/saiprajjwal/?invite_code=af7db456a81d4cf89c2e563fd6486c43&sender=334111003514027156',
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
              <a 
                key={link.name} 
                href={link.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="social-glass-btn"
                aria-label={link.name}
              >
                {link.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
