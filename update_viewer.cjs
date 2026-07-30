const fs = require('fs');
let code = fs.readFileSync('src/components/PhotoViewer.jsx', 'utf8');

// 1. Remove conditional WebGL render
code = code.replace(
  `      {view === 'flow' && (
        <Suspense fallback={null}>
          <PhotoViewerScene photos={album.photos} scrollY={scrollY} />
        </Suspense>
      )}`,
  `      {/* Always render WebGL layer so it can animate between views */}
      <Suspense fallback={null}>
        <PhotoViewerScene photos={album.photos} scrollY={scrollY} view={view} />
      </Suspense>`
);

// 2. Unify DOM elements and use Framer Motion layout
const oldDOM = `          {view === 'flow'
            ? album.photos.map((p) => (
                // Invisible placeholder: gives the WebGL plane its size + scroll
                // position. The real pixels are drawn by PhotoViewerScene.
                <div className="pv-frame" key={p.id} data-pv-id={p.id}>
                  <img
                    id={\`pv-img-\${p.id}\`}
                    className="pv-frame-img"
                    src={p.src}
                    alt={p.alt}
                    loading="lazy"
                    draggable="false"
                  />
                </div>
              ))
            : album.photos.map((p) => (
                <div className="pv-grid-item" key={p.id}>
                  <img
                    src={p.src}
                    srcSet={\`
                      \${p.src.replace('w_1200', 'w_400')} 400w,
                      \${p.src.replace('w_1200', 'w_800')} 800w,
                      \${p.src.replace('w_1200', 'w_1200')} 1200w
                    \`}
                    sizes="(max-width: 700px) 50vw, 33vw"
                    alt={p.alt}
                    loading="lazy"
                    draggable="false"
                  />
                </div>
              ))}`;

const newDOM = `          {album.photos.map((p) => (
            <motion.div
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
            </motion.div>
          ))}`;

code = code.replace(oldDOM, newDOM);
fs.writeFileSync('src/components/PhotoViewer.jsx', code);
console.log('PhotoViewer.jsx updated');
