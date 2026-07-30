const fs = require('fs');
let code = fs.readFileSync('src/components/PhotoViewer.css', 'utf8');

const oldCss = `.pv-grid-item {
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

const newCss = `.pv-grid-item {
  flex: 1; /* All items share space equally */
  height: 45vh; /* Reduced height so faces aren't uncomfortably massive */
  background: rgba(255, 255, 255, 0.03);
  overflow: hidden;
  border-radius: 0;
  transition: flex 0.8s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: crosshair;
}

.pv-grid-item:hover {
  flex: 4; 
  /* Crucial: Prevent the strip from becoming wider than the photo's natural aspect ratio.
     If it gets wider, object-fit: cover forces the photo to zoom in, which looks awful on portraits.
     0.7 is roughly a 3:4 portrait aspect ratio. */
  max-width: calc(45vh * 0.75); 
}`;

code = code.replace(oldCss, newCss);
fs.writeFileSync('src/components/PhotoViewer.css', code);
console.log('CSS updated to prevent zooming');
