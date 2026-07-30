const fs = require('fs');
let code = fs.readFileSync('src/components/PhotoViewer.css', 'utf8');

const oldCss = `/* ── Grid (contact-sheet) ── */
.pv-scroll--grid .pv-inner {
  max-width: 1400px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding-left: clamp(8px, 2vw, 24px);
  padding-right: clamp(8px, 2vw, 24px);
}

.pv-grid-item {
  overflow: hidden;
  border-radius: 6px;
  aspect-ratio: 3 / 4;
  background: rgba(255, 255, 255, 0.03);
}

.pv-grid-item img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}`;

const newCss = `/* ── Grid (Masonry contact-sheet) ── */
.pv-scroll--grid .pv-inner {
  max-width: 1400px;
  column-count: 2;
  column-gap: 10px;
  padding-left: clamp(8px, 2vw, 24px);
  padding-right: clamp(8px, 2vw, 24px);
}

@media (min-width: 1024px) {
  .pv-scroll--grid .pv-inner {
    column-count: 3;
  }
}

.pv-grid-item {
  break-inside: avoid;
  margin-bottom: 10px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.03);
}

.pv-grid-item img {
  display: block;
  width: 100%;
  height: auto; /* Preserve original aspect ratio */
  object-fit: cover;
}`;

code = code.replace(oldCss, newCss);
fs.writeFileSync('src/components/PhotoViewer.css', code);
console.log('Grid CSS updated');
