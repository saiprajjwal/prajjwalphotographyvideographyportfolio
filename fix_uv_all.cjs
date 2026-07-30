const fs = require('fs');
let code = fs.readFileSync('src/components/PhotoViewerScene.jsx', 'utf8');

// The block I just injected:
const badBlock = `    // Object-fit: cover logic
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
    
    vec4 tex = texture2D(uTexture, coverUv);
    vec3 image = tex.rgb;

    float fadeBlur = clamp(vTopFade * 0.035, 0.0, 0.085);
    float velocityBlur = clamp(abs(uVelocity) * 0.00095, 0.0, 0.085) * smoothstep(0.0, 0.28, vTopFade);
    float blurAmount = fadeBlur + velocityBlur;

    if (blurAmount > 0.00001) {
      float velocityDir = sign(uVelocity);
      vec2 dir = vec2(0.0, blurAmount * (velocityDir == 0.0 ? 1.0 : velocityDir));

      vec3 sampleNearA = texture2D(uTexture, vUv - dir * 0.5).rgb;
      vec3 sampleNearB = texture2D(uTexture, vUv + dir * 0.5).rgb;
      vec3 sampleFarA = texture2D(uTexture, vUv - dir).rgb;
      vec3 sampleFarB = texture2D(uTexture, vUv + dir).rgb;
      vec3 blurred = (tex.rgb * 0.32) + (sampleNearA * 0.24) + (sampleNearB * 0.24) + (sampleFarA * 0.10) + (sampleFarB * 0.10);

      vec2 aberrationOffset = vec2(0.008 * vTopFade, 0.0);
      vec3 chroma = vec3(
        texture2D(uTexture, vUv + aberrationOffset).r,
        blurred.g,
        texture2D(uTexture, vUv - aberrationOffset).b
      );`;

const newBlock = `    // Object-fit: cover logic
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
    
    vec4 tex = texture2D(uTexture, coverUv);
    vec3 image = tex.rgb;

    float fadeBlur = clamp(vTopFade * 0.035, 0.0, 0.085);
    float velocityBlur = clamp(abs(uVelocity) * 0.00095, 0.0, 0.085) * smoothstep(0.0, 0.28, vTopFade);
    float blurAmount = fadeBlur + velocityBlur;

    if (blurAmount > 0.00001) {
      float velocityDir = sign(uVelocity);
      // Ensure blur direction respects the object-fit scale
      vec2 dir = vec2(0.0, blurAmount * (velocityDir == 0.0 ? 1.0 : velocityDir) * ratio.y);

      vec3 sampleNearA = texture2D(uTexture, coverUv - dir * 0.5).rgb;
      vec3 sampleNearB = texture2D(uTexture, coverUv + dir * 0.5).rgb;
      vec3 sampleFarA = texture2D(uTexture, coverUv - dir).rgb;
      vec3 sampleFarB = texture2D(uTexture, coverUv + dir).rgb;
      vec3 blurred = (tex.rgb * 0.32) + (sampleNearA * 0.24) + (sampleNearB * 0.24) + (sampleFarA * 0.10) + (sampleFarB * 0.10);

      vec2 aberrationOffset = vec2(0.008 * vTopFade * ratio.x, 0.0);
      vec3 chroma = vec3(
        texture2D(uTexture, coverUv + aberrationOffset).r,
        blurred.g,
        texture2D(uTexture, coverUv - aberrationOffset).b
      );`;

code = code.replace(badBlock, newBlock);
fs.writeFileSync('src/components/PhotoViewerScene.jsx', code);
console.log('Fixed shader blur UVs');
