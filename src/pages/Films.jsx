import { lazy, Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import VideoCard from '../components/VideoCard';
import VideoLightbox from '../components/VideoLightbox';
import portfolioData from '../data/portfolio.json';
import './Films.css';

// Loaded on demand: keeps three.js/@react-three/drei out of this route's critical chunk.
const FilmsScene = lazy(() => import('./FilmsScene'));

export default function Films() {
  const [canvasReady, setCanvasReady] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const videos = portfolioData.videos;

  return (
    <motion.div
      className="films-wrapper-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      {/* 3D Background Canvas */}
      <div
        className="films-canvas-fixed"
        style={{ opacity: canvasReady ? 1 : 0, transition: 'opacity 1s ease-out' }}
      >
        <Suspense fallback={null}>
          <FilmsScene onReady={() => setCanvasReady(true)} />
        </Suspense>
      </div>

      <main className="page-wrapper section-padding films-content-overlay">
        <div className="container">
          <header className="page-header">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              Films
            </motion.h1>
          </header>

          <div className="video-grid">
            {videos.map((video, index) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + (index * 0.1), duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <VideoCard video={video} onPlay={() => setActiveVideo(video)} />
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      {/* Cinematic Fullscreen Lightbox Modal */}
      {activeVideo && (
        <VideoLightbox
          video={activeVideo}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </motion.div>
  );
}
