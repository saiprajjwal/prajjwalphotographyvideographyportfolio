import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DUR, EASE } from '../utils/motion';
import { photosForEntry, heroForEntry, paragraphsOf } from '../utils/journal';
import { playFocusTick, playShutterClick } from '../utils/audio';
import './JournalTeaser.css';

const roman = (n) => {
  const table = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  let v = n;
  for (const [val, sym] of table) {
    while (v >= val) { out += sym; v -= val; }
  }
  return out || 'I';
};

// Home has no discovery path to the Journal at all — this closes that gap
// with a small cinematic strip of the newest entries, styled for Home's dark
// world rather than reusing Journal's own white editorial page.
export default function JournalTeaser({ entries, photos }) {
  if (!entries || entries.length === 0) return null;

  const featured = entries.slice(0, 3);

  return (
    <section className="journal-teaser">
      <div className="container journal-teaser-inner">
        <motion.div
          className="journal-teaser-head"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: DUR.slow, ease: EASE.out }}
        >
          <span className="journal-teaser-kicker">From the Journal</span>
          <div className="journal-teaser-heading-row">
            <h2>Stories behind the frames</h2>
            <Link
              to="/journal"
              className="journal-teaser-viewall"
              onMouseEnter={playFocusTick}
              onClick={playShutterClick}
            >
              View the Journal <span aria-hidden="true">→</span>
            </Link>
          </div>
        </motion.div>

        <div className="journal-teaser-row">
          {featured.map((entry, i) => {
            const entryPhotos = photosForEntry(entry, photos);
            const hero = heroForEntry(entry, entryPhotos);
            const dek = entry.pullQuote || paragraphsOf(entry.body)[0] || entry.category;

            return (
              <motion.div
                key={entry.id}
                className="journal-teaser-card-wrap"
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: DUR.slow, ease: EASE.out, delay: i * 0.1 }}
              >
                <Link
                  to={`/journal/${entry.id}`}
                  className="journal-teaser-card"
                  onMouseEnter={playFocusTick}
                  onClick={playShutterClick}
                >
                  <span className="journal-teaser-frame">{roman(i + 1)}</span>
                  <div className="journal-teaser-media">
                    {hero ? (
                      <img src={hero.src} alt="" loading="lazy" />
                    ) : (
                      <span className="journal-teaser-media-empty" />
                    )}
                    <span className="journal-teaser-scrim" />
                  </div>
                  <div className="journal-teaser-meta">
                    <h3>{entry.title}</h3>
                    <p>{dek}</p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
