import { useState } from 'react';
import { Play } from 'lucide-react';
import './VideoCard.css';

export default function VideoCard({ video }) {
  const [isPlaying, setIsPlaying] = useState(false);
  
  // High-res thumbnail
  const thumbnailUrl = `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`;
  // Fallback to hqdefault if maxres doesn't exist, though for most modern videos maxres is fine
  
  return (
    <div className="video-card">
      {!isPlaying ? (
        <div 
          className="video-thumbnail-container"
          onClick={() => setIsPlaying(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') setIsPlaying(true); }}
        >
          <img 
            src={thumbnailUrl} 
            alt={video.title} 
            className="video-thumbnail fade-in"
            loading="lazy"
          />
          <div className="play-button-overlay">
            <div className="play-button">
              <Play size={32} fill="currentColor" />
            </div>
          </div>
        </div>
      ) : (
        <div className="video-iframe-container fade-in">
          <iframe
            src={`https://www.youtube.com/embed/${video.id}?autoplay=1`}
            title={video.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      )}
      <h3 className="video-title">{video.title}</h3>
    </div>
  );
}
