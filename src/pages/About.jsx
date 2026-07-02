import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import AmbientGlassBackground from '../components/AmbientGlassBackground';
import portfolioData from '../data/portfolio.json';
import './About.css';

export default function About() {
  const [aboutData, setAboutData] = useState(portfolioData.about);
  const [activeGearFilter, setActiveGearFilter] = useState('All');

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
      .catch(() => {});
  }, []);

  const { name, headshot, bio, gear } = aboutData;

  // Extract unique categories from gear data
  const gearCategories = useMemo(() => {
    if (!gear || gear.length === 0 || typeof gear[0] === 'string') return ['All'];
    const cats = new Set(gear.map(item => item.category));
    return ['All', ...Array.from(cats)];
  }, [gear]);

  const filteredGear = useMemo(() => {
    if (!gear || gear.length === 0) return [];
    // Fallback if gear is still just strings (e.g., from old data)
    if (typeof gear[0] === 'string') return gear.map((name, i) => ({ id: i, name }));
    
    if (activeGearFilter === 'All') return gear;
    return gear.filter(item => item.category === activeGearFilter);
  }, [gear, activeGearFilter]);

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
                className="gear-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="gear-header-row">
                  <h2 className="gear-heading">Creative <span className="text-cyan">Toolkit.</span></h2>
                  
                  {gearCategories.length > 1 && (
                    <div className="gear-filters">
                      {gearCategories.map(cat => (
                        <button 
                          key={cat}
                          className={`gear-filter-btn ${activeGearFilter === cat ? 'active' : ''}`}
                          onClick={() => setActiveGearFilter(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <motion.div layout className="gear-grid">
                  <AnimatePresence>
                    {filteredGear.map((item, index) => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.3 }}
                        className="gear-card"
                        key={item.id || index}
                      >
                        {item.image && (
                          <div className="gear-card-image-wrap">
                            <span className="gear-badge">{item.category}</span>
                            <img src={item.image} alt={item.name} loading="lazy" />
                          </div>
                        )}
                        <div className="gear-card-content">
                          <h3 className="gear-name">{item.name}</h3>
                          {item.usedFor && <p className="gear-used-for">{item.usedFor}</p>}
                          {item.description && <p className="gear-desc">{item.description}</p>}
                          {item.link && (
                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="gear-link">
                              VIEW PRODUCT <ArrowUpRight size={16} />
                            </a>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                style={{ marginTop: '2.5rem' }}
              >
                <Link to="/portfolio" className="btn-glass">
                  See My Work
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </main>
    </motion.div>
  );
}
