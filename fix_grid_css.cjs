const fs = require('fs');
let code = fs.readFileSync('src/components/PhotoViewer.css', 'utf8');

const oldCss = `.pv-grid-item img {
  display: block;
  width: 100%;
  height: auto; /* Preserve original aspect ratio */
  object-fit: cover;
}`;

const newCss = `.pv-grid-item img, .pv-grid-img {
  display: block;
  width: 100%;
  height: auto; /* Preserve original aspect ratio */
  object-fit: cover;
  opacity: 0; /* Invisible so WebGL can draw over it */
}`;

code = code.replace(oldCss, newCss);
fs.writeFileSync('src/components/PhotoViewer.css', code);
console.log('CSS updated');
