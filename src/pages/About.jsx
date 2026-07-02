import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import AmbientGlassBackground from '../components/AmbientGlassBackground';
import portfolioData from '../data/portfolio.json';
import './About.css';

export default function About() {
  const [aboutData, setAboutData] = useState(portfolioData.about);

  useEffect(() => {
    fetch('/api/about')
      .then(res => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then(data => {
        if (data && data.name) {
          setAboutData(data);
        }
      })
      .catch(() => {
        // Fallback to local json is already the default state
      });
  }, []);

  useEffect(() => {
    sessionStorage.setItem('last_visited_page', 'About');
  }, []);

  const { name, headshot, bio, gear } = aboutData;

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
            <div className="about-left-column">
              <motion.div 
                className="about-image-container"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <img src={headshot} alt={name} className="about-image" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem' }}
              >
                <Link to="/portfolio" className="about-my-work-btn">
                  PHOTOS
                </Link>
                <Link to="/films" className="about-my-work-btn">
                  VIDEOS
                </Link>
              </motion.div>

            </div>
            
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
