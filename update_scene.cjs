const fs = require('fs');
let code = fs.readFileSync('src/components/PhotoViewerScene.jsx', 'utf8');

// 1. Update DOMSyncedImage signature and logic
const oldSignature = 'function DOMSyncedImage({ photo, scrollY, rollVelocity, reduceMotion }) {';
const newSignature = 'function DOMSyncedImage({ photo, scrollY, rollVelocity, reduceMotion, view }) {';
code = code.replace(oldSignature, newSignature);

const oldTargetStrength = `    const targetStrength = reduceMotion
      ? 0
      : Math.pow(THREE.MathUtils.clamp(speed / 10.5, 0, 1), 0.56);`;
const newTargetStrength = `    const targetStrength = (reduceMotion || view === 'grid')
      ? 0
      : Math.pow(THREE.MathUtils.clamp(speed / 10.5, 0, 1), 0.56);`;
code = code.replace(oldTargetStrength, newTargetStrength);

// 2. Update PhotoViewerScene signature
const oldExport = 'export default function PhotoViewerScene({ photos, scrollY }) {';
const newExport = 'export default function PhotoViewerScene({ photos, scrollY, view }) {';
code = code.replace(oldExport, newExport);

// 3. Pass view to DOMSyncedImage
const oldRender = `        <DOMSyncedImage
          key={p.id}
          photo={p}
          scrollY={scrollY}
          rollVelocity={rollVelocity}
          reduceMotion={reduceMotion}
        />`;
const newRender = `        <DOMSyncedImage
          key={p.id}
          photo={p}
          scrollY={scrollY}
          rollVelocity={rollVelocity}
          reduceMotion={reduceMotion}
          view={view}
        />`;
code = code.replace(oldRender, newRender);

fs.writeFileSync('src/components/PhotoViewerScene.jsx', code);
console.log('PhotoViewerScene.jsx updated');
