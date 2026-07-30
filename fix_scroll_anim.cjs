const fs = require('fs');
let code = fs.readFileSync('src/components/PhotoViewer.jsx', 'utf8');

const oldScroll = `      <div
        className={\`pv-scroll pv-scroll--\${view}\`}
        ref={scrollRef}
      >
        <div className="pv-inner">`;

const newScroll = `      <motion.div
        layoutScroll
        className={\`pv-scroll pv-scroll--\${view}\`}
        ref={scrollRef}
      >
        <motion.div layout className="pv-inner">`;

code = code.replace(oldScroll, newScroll);

const oldEnd = `          <div className="pv-end" aria-hidden="true" />
        </div>
      </div>`;

const newEnd = `          <div className="pv-end" aria-hidden="true" />
        </motion.div>
      </motion.div>`;

code = code.replace(oldEnd, newEnd);

fs.writeFileSync('src/components/PhotoViewer.jsx', code);
console.log('Scroll layout animation added');
