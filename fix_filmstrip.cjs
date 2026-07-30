const fs = require('fs');
let code = fs.readFileSync('src/components/PhotoViewer.css', 'utf8');

const oldCss = `/* ── Grid (Masonry contact-sheet) ── */
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

.pv-grid-item img, .pv-grid-img {
  display: block;
  width: 100%;
  height: auto; /* Preserve original aspect ratio */
  object-fit: cover;
  opacity: 0; /* Invisible so WebGL can draw over it */
}`;

const newCss = `/* ── Grid (Filmstrip Accordion) ── */
.pv-scroll--grid {
  overflow: hidden;
}

.pv-scroll--grid .pv-inner {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  padding: 0 4vw;
  gap: 2px;
}

.pv-grid-item {
  flex: 1; /* All items share space equally */
  height: 60vh;
  background: rgba(255, 255, 255, 0.03);
  overflow: hidden;
  border-radius: 0;
  transition: flex 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: crosshair;
}

.pv-grid-item:hover {
  flex: 6; /* Expand on hover */
}

.pv-grid-item img, .pv-grid-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0; /* Invisible so WebGL can draw over it */
}`;

code = code.replace(oldCss, newCss);
fs.writeFileSync('src/components/PhotoViewer.css', code);
console.log('CSS updated for filmstrip');
