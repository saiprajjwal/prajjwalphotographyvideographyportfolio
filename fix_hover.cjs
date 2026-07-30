const fs = require('fs');
let code = fs.readFileSync('src/components/PhotoViewer.css', 'utf8');

const oldCss = `.pv-scroll--grid .pv-inner {
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
}`;

const newCss = `.pv-scroll--grid .pv-inner {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  padding: 0 4vw;
  gap: 4px; /* More distinct gap */
}

.pv-grid-item {
  flex: 1; /* All items share space equally */
  height: 60vh;
  max-width: clamp(40px, 5vw, 90px); /* Prevents small collections from becoming massive */
  background: rgba(255, 255, 255, 0.03);
  overflow: hidden;
  border-radius: 0;
  transition: flex 0.5s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: crosshair;
}

.pv-grid-item:hover {
  flex: 12; /* Expand massively on hover */
  max-width: 60vw; /* Allow the hovered item to break the sliver limit */
}`;

code = code.replace(oldCss, newCss);
fs.writeFileSync('src/components/PhotoViewer.css', code);
console.log('CSS updated for limited sliver width');
