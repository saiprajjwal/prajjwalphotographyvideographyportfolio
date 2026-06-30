import { motion } from 'framer-motion';
import AmbientGlassBackground from '../components/AmbientGlassBackground';
import portfolioData from '../data/portfolio.json';
import './About.css';

export default function About() {
  const { name, bio, gear } = portfolioData.about;
  const headshot = portfolioData.photos.find(p => p.category === 'Portraits')?.src || portfolioData.photos[0]?.src;

  return (
    <motion.div 
      className="about-wrapper-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      <AmbientGlassBackground />

      <main className="page-wrapper section-padding about-content-overlay">
        <div className="container">
          <div className="about-grid">
            <motion.div 
              className="about-image-container"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <img src={headshot} alt={name} className="about-image" />
            </motion.div>
            
            <div className="about-content">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                About {name.split(' ')[0]}
              </motion.h1>
              <motion.p 
                className="bio-text glass-panel-padded"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {bio}
              </motion.p>
              
              <motion.div 
                className="gear-section glass-panel-padded"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <h2>Gear & Skills</h2>
                <ul className="gear-list">
                  {gear.map((item, index) => (
                    <motion.li 
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + (index * 0.1) }}
                    >
                      {item}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
      </main>
    </motion.div>
  );
}
