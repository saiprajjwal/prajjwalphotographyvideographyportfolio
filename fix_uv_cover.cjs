const fs = require('fs');
let code = fs.readFileSync('src/components/PhotoViewerScene.jsx', 'utf8');

// Add uniforms to vertex and fragment shader
code = code.replace(
  '  uniform float uOpacity;',
  '  uniform float uOpacity;\n  uniform vec2 uMeshSize;\n  uniform vec2 uTexSize;'
);

const oldFragUv = 'vec4 tex = texture2D(uTexture, vUv);';
const newFragUv = `    // Object-fit: cover logic
    vec2 meshRatio = vec2(uMeshSize.x / uMeshSize.y, 1.0);
    vec2 texRatio = vec2(uTexSize.x / uTexSize.y, 1.0);
    
    vec2 ratio = vec2(
      min((uMeshSize.x / uMeshSize.y) / (uTexSize.x / uTexSize.y), 1.0),
      min((uMeshSize.y / uMeshSize.x) / (uTexSize.y / uTexSize.x), 1.0)
    );
    
    vec2 coverUv = vec2(
      vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
      vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
    );
    
    vec4 tex = texture2D(uTexture, coverUv);`;
code = code.replace(oldFragUv, newFragUv);

// Add state to track texSize
code = code.replace(
  'const [texture, setTexture] = useState(null);',
  'const [texture, setTexture] = useState(null);\n  const [texSize, setTexSize] = useState(new THREE.Vector2(1, 1));'
);

// Update texSize when texture loads
const oldTexLoad = `      tex.generateMipmaps = false;
      setTexture(tex);`;
const newTexLoad = `      tex.generateMipmaps = false;
      setTexSize(new THREE.Vector2(tex.image.width, tex.image.height));
      setTexture(tex);`;
code = code.replace(oldTexLoad, newTexLoad);

// Pass uniforms in useFrame
const oldUniformsUpdate = `    materialRef.current.uniforms.uHeight.value = rect.height;`;
const newUniformsUpdate = `    materialRef.current.uniforms.uHeight.value = rect.height;
    materialRef.current.uniforms.uMeshSize.value.set(rect.width, rect.height);
    materialRef.current.uniforms.uTexSize.value.copy(texSize);`;
code = code.replace(oldUniformsUpdate, newUniformsUpdate);

// Add default uniforms
const oldUniforms = `          uTexture: { value: null },
          uResolution: { value: new THREE.Vector2(1, 1) },`;
const newUniforms = `          uTexture: { value: null },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uMeshSize: { value: new THREE.Vector2(1, 1) },
          uTexSize: { value: new THREE.Vector2(1, 1) },`;
code = code.replace(oldUniforms, newUniforms);

fs.writeFileSync('src/components/PhotoViewerScene.jsx', code);
console.log('PhotoViewerScene.jsx updated for object-fit cover');
