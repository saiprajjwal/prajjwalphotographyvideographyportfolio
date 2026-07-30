const fs = require('fs');
let code = fs.readFileSync('src/components/PhotoViewer.css', 'utf8');

const oldCss = `/* ── Grid (Masonry contact-sheet) ── */
.pv-scroll--grid .pv-inner {
  max-width: 1400px;
  column-count: 2;
  column-gap: 16px;
  padding: 8vh clamp(16px, 4vw, 32px) 24vh;
}

@media (min-width: 1024px) {
  .pv-scroll--grid .pv-inner {
    column-count: 3;
  }
}

.pv-grid-item {
  break-inside: avoid;
  margin-bottom: 16px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transform: translateZ(0); /* Force hardware acceleration */
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
  gap: 4px;
}

.pv-grid-item {
  flex: 1; /* All items share space equally */
  height: 60vh;
  background: rgba(255, 255, 255, 0.03);
  overflow: hidden;
  border-radius: 0;
  /* Very subtle, slow movement */
  transition: flex 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
  cursor: crosshair;
}

.pv-grid-item:hover {
  /* Much more subtle expansion */
  flex: 2.5; 
}`;

code = code.replace(oldCss, newCss);
fs.writeFileSync('src/components/PhotoViewer.css', code);
console.log('CSS updated back to accordion with subtle movement');
