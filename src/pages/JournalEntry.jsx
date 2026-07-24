import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EASE, DUR } from '../utils/motion';
import { photosForEntry, heroForEntry, paragraphsOf } from '../utils/journal';
import { playFocusTick, playShutterClick } from '../utils/audio';
import './Journal.css';

export default function JournalEntry() {
  const { slug } = useParams();
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

  const entry = entries.find((e) => e.id === slug);

  if (loaded && !entry) {
    return (
      <div className="journal-page">
        <div className="container journal-notfound">
          <p>This entry doesn't exist, or hasn't been written yet.</p>
          <Link to="/journal" className="journal-inline-link">&larr; Back to the Journal</Link>
        </div>
      </div>
    );
  }

  if (!entry) {
    // Still loading — avoid a flash of the not-found state
    return <div className="journal-page" />;
  }

  const entryPhotos = photosForEntry(entry, photos);
  const hero = heroForEntry(entry, entryPhotos);
  const gallery = entryPhotos.filter((p) => p.id !== hero?.id).slice(0, 6);
  const paragraphs = paragraphsOf(entry.body);

  return (
    <motion.div
      className="journal-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
    >
      <div className="container">
        <Link
          to="/journal"
          className="journal-back"
          onMouseEnter={playFocusTick}
          onClick={playShutterClick}
        >
          &larr; The Journal
        </Link>

        <article className="journal-entry">
          <div className="journal-entry-hero">
            {hero ? (
              // Slow, continuous settle — same Ken Burns feel as the Portfolio
              // category reveal, so the reading page still feels like part of
              // the same site rather than a static blog embed. Plain CSS
              // (below), not framer-motion: this component mounts directly off
              // a route change inside App.jsx's AnimatePresence, and a nested
              // motion.img in that position never reliably picked up its
              // `initial` value — a CSS animation has no such ambiguity.
              <img className="journal-entry-hero-img" src={hero.src} alt={hero.alt} />
            ) : (
              <span className="journal-frame-swatch-empty" />
            )}
            <motion.div
              className="journal-entry-hero-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: DUR.slow, ease: EASE.out }}
            />
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.slower, ease: EASE.out, delay: 0.1 }}
            >
              {entry.title}
            </motion.h1>
          </div>

          <div className="journal-entry-body">
            {entry.pullQuote && <p className="journal-pull">&ldquo;{entry.pullQuote}&rdquo;</p>}

            {paragraphs.map((p, i) => (
              <p className="journal-copy" key={i}>{p}</p>
            ))}

            {gallery.length > 0 && (
              <div className="journal-contact">
                <span className="journal-contact-label mono">Contact sheet — same roll</span>
                <div className="journal-contact-grid">
                  {gallery.map((photo) => (
                    <span className="journal-contact-cell" key={photo.id}>
                      <img src={photo.src} alt={photo.alt} loading="lazy" />
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="journal-entry-footer">
              <span className="journal-byline">Atlanta, Georgia — {entryPhotos.length} photo{entryPhotos.length === 1 ? '' : 's'} in the full album</span>
              <Link
                to={`/portfolio?category=${encodeURIComponent(entry.category)}`}
                className="journal-cta"
                onMouseEnter={playFocusTick}
                onClick={playShutterClick}
              >
                View the full {entry.session || entry.category} album <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </article>
      </div>
    </motion.div>
  );
}
