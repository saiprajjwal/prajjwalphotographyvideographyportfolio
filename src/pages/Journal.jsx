import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EASE, DUR } from '../utils/motion';
import { photosForEntry, heroForEntry, paragraphsOf } from '../utils/journal';
import './Journal.css';

// Roman numerals for the frame count, echoing a contact sheet's roll number —
// matches the same device used in the concept mockup and the Portfolio page's
// editorial voice.
const roman = (n) => {
  const table = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  let v = n;
  for (const [val, sym] of table) {
    while (v >= val) { out += sym; v -= val; }
  }
  return out || 'I';
};

export default function Journal() {
  const [photos, setPhotos] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/photos')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setPhotos(data.photos || []);
        setEntries(data.journal || []);
      })
      .catch(() => {
        setPhotos([]);
        setEntries([]);
      })
      .finally(() => setLoaded(true));
  }, []);

  return (
    <motion.div
      className="journal-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
    >
      <div className="container">
        <header className="journal-masthead">
          <span className="journal-kicker">Prajjwal Pandey</span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.slow, ease: EASE.out }}
          >
            The Journal
          </motion.h1>
          <p className="journal-sub">
            Short notes from the shoots already living on the{' '}
            <Link to="/portfolio" className="journal-inline-link">Portfolio</Link> page —
            one story per album, not a separate photo shoot.
          </p>
        </header>

        {loaded && entries.length === 0 && (
          <p className="journal-empty">The Journal is just getting started — check back soon.</p>
        )}

        <div className="journal-roll">
          {entries.map((entry, i) => {
            const entryPhotos = photosForEntry(entry, photos);
            const hero = heroForEntry(entry, entryPhotos);
            const dek = entry.pullQuote || paragraphsOf(entry.body)[0] || entry.category;

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: DUR.base, ease: EASE.out, delay: Math.min(i, 6) * 0.05 }}
              >
                <Link to={`/journal/${entry.id}`} className="journal-frame">
                  <span className="journal-frame-no mono">{roman(i + 1)}&nbsp;/&nbsp;{String(i + 1).padStart(3, '0')}</span>
                  <span className="journal-frame-swatch">
                    {hero ? (
                      <img src={hero.src} alt="" loading="lazy" />
                    ) : (
                      <span className="journal-frame-swatch-empty" />
                    )}
                  </span>
                  <span className="journal-frame-meta">
                    <h3>{entry.title}</h3>
                    <p>{dek}</p>
                  </span>
                  <span className="journal-frame-arrow" aria-hidden="true">→</span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
