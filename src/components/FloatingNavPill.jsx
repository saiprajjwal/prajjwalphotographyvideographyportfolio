import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './FloatingNavPill.css';

// The refraction map behind the liquid-glass look. Chromium applies this via
// backdrop-filter; other engines simply fall back to the blur/tint layers.
function GlassFilterDefs() {
  return (
    <svg className="lg-defs" aria-hidden="true" focusable="false">
      <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
        <feTurbulence type="fractalNoise" baseFrequency="0.0015 0.006" numOctaves="1" seed="24" result="turbulence" />
        <feComponentTransfer in="turbulence" result="mapped">
          <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
          <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
          <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
        </feComponentTransfer>
        <feGaussianBlur in="turbulence" stdDeviation="8" result="softMap" />
        <feSpecularLighting in="softMap" surfaceScale="5" specularConstant="1" specularExponent="100" lightingColor="white" result="specLight">
          <fePointLight x="-200" y="-200" z="200" />
        </feSpecularLighting>
        <feComposite in="specLight" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="litImage" />
        <feDisplacementMap in="SourceGraphic" in2="softMap" scale="120" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

// Arc ⇄ flat glyph. The path morphs via its own transition, so the icon
// animates in step with the band behind it.
function ModeGlyph({ flat }) {
  return (
    <svg className="lg-orb__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <motion.path
        d={flat ? 'M4 12 H20' : 'M4 15 Q12 6 20 15'}
        animate={{ d: flat ? 'M4 12 H20' : 'M4 15 Q12 6 20 15' }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy={flat ? 8 : 9.6} r="1.5" fill="currentColor" />
    </svg>
  );
}

export default function FloatingNavPill({
  categories = [],
  activeCategory = '',
  onSelectCategory,
  activePhotoSrc = '',
  flatMode = false,
  onToggleMode,
}) {
  const currentIndex = categories.indexOf(activeCategory);

  // After a mode switch the bar shows the mode name for a beat, then hands
  // the space back to the category — same beat as the reference.
  const [modeFlash, setModeFlash] = useState(null);
  const flashTimer = useRef(null);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const step = (dir) => (e) => {
    e.stopPropagation();
    if (categories.length === 0) return;
    const next = (currentIndex + dir + categories.length) % categories.length;
    onSelectCategory(categories[next]);
  };

  const handleMode = () => {
    const nextFlat = !flatMode;
    onToggleMode?.(nextFlat);
    setModeFlash(nextFlat ? 'Flat' : 'Arc');
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setModeFlash(null), 1500);
  };

  const label = modeFlash ?? activeCategory;

  return (
    <motion.div
      className="lg-dock"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <GlassFilterDefs />

      {/* Main glass bar: thumbnail · label · stepper */}
      <div className="lg-bar">
        <span className="lg-effect lg-effect--distort" aria-hidden="true" />
        <span className="lg-effect lg-effect--shine" aria-hidden="true" />

        <div className="lg-bar__content">
          <div className="lg-thumb">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory + activePhotoSrc}
                className="lg-thumb__img"
                initial={{ opacity: 0, scale: 1.15 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  backgroundImage: activePhotoSrc
                    ? `url("${activePhotoSrc}")`
                    : 'linear-gradient(135deg, #c9c9d2, #8f8f9c)',
                }}
              />
            </AnimatePresence>
          </div>

          <div className="lg-label">
            <span className="lg-label__eyebrow">{modeFlash ? 'Mode' : 'Category'}</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={label}
                className="lg-label__text"
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -7 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                {label}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className="lg-stepper">
            <button type="button" className="lg-stepper__btn" onClick={step(-1)} aria-label="Previous category">
              <ChevronLeft size={15} strokeWidth={2.2} />
            </button>
            <span className="lg-stepper__divider" aria-hidden="true" />
            <button type="button" className="lg-stepper__btn" onClick={step(1)} aria-label="Next category">
              <ChevronRight size={15} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>

      {/* Detached glass circle: swap the band between arc and flat */}
      <button
        type="button"
        className="lg-orb"
        onClick={handleMode}
        aria-pressed={flatMode}
        aria-label={`Switch to ${flatMode ? 'arc' : 'flat'} layout`}
        title={`Switch to ${flatMode ? 'arc' : 'flat'} layout`}
      >
        <span className="lg-effect lg-effect--distort" aria-hidden="true" />
        <span className="lg-effect lg-effect--shine" aria-hidden="true" />
        <ModeGlyph flat={flatMode} />
      </button>
    </motion.div>
  );
}
