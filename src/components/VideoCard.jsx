import { Play } from 'lucide-react';
import { motion } from 'framer-motion';
import './VideoCard.css';

export default function VideoCard({ video, onPlay }) {
  // High-res thumbnail
  const thumbnailUrl = `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`;
  
  return (
    <div className="video-card">
      <motion.div 
        className="video-thumbnail-container"
        layoutId={`video-container-${video.id}`}
        onClick={onPlay}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onPlay(); }}
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
      </motion.div>
      <h3 className="video-title">{video.title}</h3>
    </div>
  );
}
