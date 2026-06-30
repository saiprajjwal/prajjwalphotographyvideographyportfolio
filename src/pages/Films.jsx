import { motion } from 'framer-motion';
import VideoCard from '../components/VideoCard';
import portfolioData from '../data/portfolio.json';
import './Films.css';

export default function Films() {
  const videos = portfolioData.videos;

  return (
    <motion.main 
      className="page-wrapper section-padding"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <div className="container">
        <header className="page-header">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
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
              transition={{ delay: 0.2 + (index * 0.1), duration: 0.5 }}
            >
              <VideoCard video={video} />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.main>
  );
}
