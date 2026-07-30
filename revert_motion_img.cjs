const fs = require('fs');
let code = fs.readFileSync('src/components/PhotoViewer.jsx', 'utf8');

const badDOM = `            <motion.div
              layout
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} // smooth FLIP animation
              className={view === 'flow' ? 'pv-frame' : 'pv-grid-item'}
              key={p.id}
              data-pv-id={p.id}
            >
              <motion.img
                layout
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} // smooth FLIP animation
                id={\`pv-img-\${p.id}\`}
                className={view === 'flow' ? 'pv-frame-img' : 'pv-grid-img'}
                src={p.src}
                alt={p.alt}
                loading="lazy"
                draggable="false"
              />
            </motion.div>`;

const goodDOM = `            <motion.div
              layout
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} // smooth FLIP animation
              className={view === 'flow' ? 'pv-frame' : 'pv-grid-item'}
              key={p.id}
              data-pv-id={p.id}
            >
              <img
                id={\`pv-img-\${p.id}\`}
                className={view === 'flow' ? 'pv-frame-img' : 'pv-grid-img'}
                src={p.src}
                alt={p.alt}
                loading="lazy"
                draggable="false"
              />
            </motion.div>`;

code = code.replace(badDOM, goodDOM);
fs.writeFileSync('src/components/PhotoViewer.jsx', code);
console.log('Reverted motion.img');
