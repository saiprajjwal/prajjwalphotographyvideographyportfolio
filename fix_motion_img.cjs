const fs = require('fs');
let code = fs.readFileSync('src/components/PhotoViewer.jsx', 'utf8');

const oldDOM = `            <motion.div
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

const newDOM = `            <motion.div
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

code = code.replace(oldDOM, newDOM);
fs.writeFileSync('src/components/PhotoViewer.jsx', code);
console.log('Fixed motion on img');
