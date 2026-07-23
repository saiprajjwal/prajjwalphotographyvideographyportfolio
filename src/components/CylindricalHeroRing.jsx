import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import PortfolioHeroScene from './PortfolioHeroScene';
import './CylindricalHeroRing.css';

const TITLE = 'PORTFOLIO';

// The displacement filter that makes the display word run like liquid.
// feTurbulence supplies a slowly drifting noise field; JS drives the
// feDisplacementMap's scale from 0 (crisp) up to full flow on hover.
function LiquidFilterDefs() {
  return (
    <svg className="liquid-defs" aria-hidden="true" focusable="false">
      <filter id="liquid-title" x="-12%" y="-30%" width="124%" height="160%" colorInterpolationFilters="sRGB">
        {/* Low frequency + a single octave keeps the noise field smooth, so
            the glyphs undulate like liquid rather than tearing into noise */}
        <feTurbulence type="fractalNoise" baseFrequency="0.004 0.008" numOctaves="1" seed="7" result="noise">
          <animate
            attributeName="baseFrequency"
            dur="16s"
            values="0.004 0.008; 0.009 0.004; 0.003 0.010; 0.004 0.008"
            repeatCount="indefinite"
          />
        </feTurbulence>
        {/* Sliding the noise field with the pointer makes the surface look
            like it's being pushed, rather than just vibrating in place */}
        <feOffset id="liquid-title-offset" in="noise" dx="0" dy="0" result="shifted" />
        <feDisplacementMap
          id="liquid-title-map"
          in="SourceGraphic"
          in2="shifted"
          scale="0"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}

export default function CylindricalHeroRing({
  categories = [],
  activeCategory = '',
  onSelectCategory,
  photos = [],
  photosLoaded = true,
  flatMode = false,
  onOpenCategory,
}) {
  const activeIndex = categories.indexOf(activeCategory);

  const stageRef = useRef(null);
  const titleRef = useRef(null);
  const chipRef = useRef(null);
  const [bandHover, setBandHover] = useState(false);

  const handleCategoryChange = (idx) => {
    const cat = categories[idx];
    if (cat && cat !== activeCategory) {
      onSelectCategory(cat);
    }
  };

  // ── Liquid title ────────────────────────────────────────────
  // Two layers combine into the effect: a turbulence displacement over the
  // whole word for the molten surface, and a per-letter swell under the
  // pointer so the liquid actually reacts to where the mouse is.
  useEffect(() => {
    const stage = stageRef.current;
    const title = titleRef.current;
    const map = document.getElementById('liquid-title-map');
    const offset = document.getElementById('liquid-title-offset');
    if (!stage || !title || !map || !offset) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const letters = Array.from(title.querySelectorAll('.aikawa-title-letter'));

    let raf = 0;
    let strength = 0;      // eased global strength, 0..1
    let goal = 0;
    let pointerX = 0;
    let smoothX = 0;       // trails the pointer, drives the noise slide
    let lastX = 0;
    let velocity = 0;
    let inside = false;

    const onMove = (e) => {
      const r = title.getBoundingClientRect();
      // Distance from the word's box, clamped to a falloff radius
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
      const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
      goal = Math.max(0, 1 - Math.hypot(dx, dy) / 240);
      pointerX = e.clientX;
      if (!inside) { smoothX = pointerX; lastX = pointerX; inside = true; }
    };

    const onLeave = () => { goal = 0; inside = false; };

    const tick = () => {
      strength += (goal - strength) * 0.09;
      if (strength < 0.001) strength = 0;

      smoothX += (pointerX - smoothX) * 0.14;
      velocity += ((smoothX - lastX) - velocity) * 0.2;
      lastX = smoothX;

      if (strength > 0) {
        title.style.filter = 'url(#liquid-title)';
        map.setAttribute('scale', (strength * 30).toFixed(2));
        // Push the noise field along with the pointer, and lean it into the
        // direction of travel so fast moves drag the surface further
        offset.setAttribute('dx', (smoothX * -0.05 + velocity * 2.2).toFixed(2));
        offset.setAttribute('dy', (velocity * 0.9).toFixed(2));

        const r = title.getBoundingClientRect();
        // Falloff radius of roughly two letters
        const radius = Math.max(120, r.width / 5);
        for (const el of letters) {
          const b = el.getBoundingClientRect();
          const d = (b.left + b.width / 2 - smoothX) / radius;
          const swell = Math.exp(-d * d) * strength;
          el.style.transform =
            `translateY(${(-swell * 26).toFixed(2)}px) scale(${(1 + swell * 0.09).toFixed(4)})`;
        }
      } else {
        title.style.filter = '';
        map.setAttribute('scale', '0');
        for (const el of letters) el.style.transform = '';
      }

      raf = requestAnimationFrame(tick);
    };

    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  // ── "VIEW" chip trails the pointer while the band is hovered ──
  const handleHoverChange = useCallback((on, x, y) => {
    setBandHover(on);
    const chip = chipRef.current;
    if (chip && on && x != null) {
      const r = chip.parentElement.getBoundingClientRect();
      chip.style.transform = `translate3d(${x - r.left}px, ${y - r.top}px, 0) translate(-50%, -50%)`;
    }
  }, []);

  const handleTap = useCallback((originRect) => {
    if (activeCategory) onOpenCategory?.(activeCategory, originRect);
  }, [activeCategory, onOpenCategory]);

  return (
    <div className="aikawa-hero-stage-wrapper" ref={stageRef}>
      <LiquidFilterDefs />

      {/* Massive editorial display word. Split per glyph so the swell can be
          localised under the pointer instead of wobbling the whole word. */}
      <div className="aikawa-backdrop-title" ref={titleRef} aria-hidden="true">
        {TITLE.split('').map((ch, i) => (
          <span className="aikawa-title-letter" key={`${ch}-${i}`}>{ch}</span>
        ))}
      </div>

      {/* 3D canvas: curved photo band + reflection. The Suspense fallback
          below covers the load, so the container itself is simply visible —
          an earlier `ready` flag was removed but a reference lingered, which
          threw on render and blanked the whole Portfolio route. */}
      <div className="aikawa-canvas-container">
        <Suspense
          fallback={
            <div className="aikawa-canvas-loading">
              <div className="aikawa-loading-spinner" />
            </div>
          }
        >
          <PortfolioHeroScene
            categories={categories}
            activeIndex={activeIndex >= 0 ? activeIndex : 0}
            photos={photos}
            photosLoaded={photosLoaded}
            flatMode={flatMode}
            onCategoryChange={handleCategoryChange}
            onHoverChange={handleHoverChange}
            onTap={handleTap}
          />
        </Suspense>

        <span
          ref={chipRef}
          className={`aikawa-view-chip ${bandHover ? 'is-visible' : ''}`}
          aria-hidden="true"
        >
          View
        </span>
      </div>
    </div>
  );
}
