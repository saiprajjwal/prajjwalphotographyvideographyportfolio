import React from 'react';
import { Play } from 'lucide-react';
import './InstagramReel.css';

export default function InstagramReel({ shortcode, onOpen }) {
  return (
    <div className="video-card instagram-reel-card">
      <div className="instagram-reel-container">
        <div className="instagram-reel-glass-wrapper">
          <iframe
            src={`https://www.instagram.com/reel/${shortcode}/embed/`}
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            allowTransparency="true"
            allow="encrypted-media"
            className="instagram-reel-iframe"
          ></iframe>
        </div>
        {/* Shield sits over the iframe: it lets the card be drag-scrolled and
            turns a click into "open the story viewer" instead of hitting the embed. */}
        <div className="instagram-overlay-click-shield" onClick={onOpen}>
          <div className="play-button">
            <Play size={24} fill="currentColor" />
          </div>
        </div>
      </div>
    </div>
  );
}
