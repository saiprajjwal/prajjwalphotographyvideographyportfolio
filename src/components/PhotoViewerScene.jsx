import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useReducedMotion, useSpring, useVelocity } from 'framer-motion';

const CLOTH_VERT = `
  uniform vec2 uResolution;
  uniform float uHeight;
  uniform float uScrollPos;
  uniform float uRollStrength;
  uniform float uRollDepth;
  uniform float uWaveAmp;
  uniform float uDirection;
  varying vec2 vUv;
  varying float vTopFade;
  varying float vBandRaw;
  varying float vFoldLight;

  // Ken Perlin's smootherstep for G2 continuity (eliminates the Mach band crease line)
  float smootherstep_custom(float edge0, float edge1, float x) {
    float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    vTopFade = 0.0;
    vBandRaw = 0.0;
    vFoldLight = 0.0;

    if (uRollStrength > 0.0001) {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      float topThreshold = (uResolution.y * 0.5) - (uResolution.y * 0.10);
      float topRange = max(uResolution.y * 0.24, 1.0);
      float viewportBand = clamp(
        (worldPosition.y - topThreshold) / topRange,
        0.0,
        1.0
      );

      // Only the upper portion of the photograph is allowed to become cloth.
      // Even at maximum velocity, everything below it stays optically rigid.
      float photoTopMask = smootherstep_custom(0.58, 0.98, uv.y);
      float band = viewportBand * photoTopMask;
      
      vBandRaw = band; // Pass raw linear band for per-pixel shading

      float smoothBand = smootherstep_custom(0.0, 1.0, band);
      
      // The broad under-roll gives the fabric its depth and recognizable
      // "pulled over a bar" silhouette at the browser edge.
      float angle = smoothBand * 3.14159265 * 0.68;
      float cylinderZ = 1.0 - cos(angle);
      float liftY = sin(angle);

      pos.y += (liftY * 54.0 / max(uHeight, 1.0)) * uRollStrength;
      pos.z -= cylinderZ * uRollDepth * uRollStrength;

      // Three differently sized folds break the cylinder into organic cloth.
      // The phase follows scroll position, so no two pulls look mechanically
      // identical, while the envelope hides every join into the flat image.
      float waveEnvelope = sin(band * 3.14159265);
      float phase = (uv.x - 0.5) * 6.8 - uScrollPos * 0.0055;
      float fabricWave =
        sin(phase) * 0.56 +
        sin(phase * 1.87 + 0.85) * 0.27 +
        sin(phase * 0.43 - 1.65) * 0.17;
      pos.z += fabricWave * waveEnvelope * uWaveAmp * uRollStrength;

      // A slight centre sag and directional tug keep the edge loose rather than
      // perfectly horizontal. Both disappear with the velocity envelope.
      float centreSag = 1.0 - pow(abs(uv.x - 0.5) * 2.0, 2.0);
      pos.y -= (
        centreSag * waveEnvelope * 16.0 / max(uHeight, 1.0)
      ) * uRollStrength;
      pos.x += uDirection * smoothBand * 0.018 * uRollStrength;

      vFoldLight = fabricWave * waveEnvelope * uRollStrength;
      vTopFade = smootherstep_custom(0.34, 1.0, band) * uRollStrength;
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const CLOTH_FRAG = `
  uniform sampler2D uTexture;
  uniform float uOpacity;
  uniform float uVelocity;
  varying vec2 vUv;
  varying float vTopFade;
  varying float vBandRaw;
  varying float vFoldLight;

  float smootherstep_custom(float edge0, float edge1, float x) {
    float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  void main() {
    vec4 tex = texture2D(uTexture, vUv);
    vec3 image = tex.rgb;

    float fadeBlur = clamp(vTopFade * 0.03, 0.0, 0.08);
    float velocityBlur = clamp(abs(uVelocity) * 0.0008, 0.0, 0.08) * smoothstep(0.0, 0.30, vTopFade);
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
      );
      image = mix(blurred, chroma, clamp(vTopFade, 0.0, 1.0));
    }

    // Evaluate G2 continuous shadow per-pixel to completely avoid linear interpolation creases
    float smoothBand = smootherstep_custom(0.0, 1.0, vBandRaw);
    float shadow = mix(1.0, 0.42, smoothBand);
    float foldShade = clamp(1.0 + vFoldLight * 0.22, 0.72, 1.22);
    image *= shadow * foldShade;
    image += max(vFoldLight, 0.0) * 0.045;

    // Keep a faint translucent lip instead of erasing the rolled edge.
    float alpha = tex.a * uOpacity * (1.0 - vTopFade * 0.86);
    gl_FragColor = vec4(image, alpha);
  }
`;

function DOMSyncedImage({ photo, scrollY, rollVelocity, reduceMotion }) {
  const meshRef = useRef(null);
  const materialRef = useRef(null);
  const [texture, setTexture] = useState(null);
  // Temporally damped copies of the two noisiest inputs. Wheel/trackpad
  // velocity arrives in bursts, so feeding it straight into the shader made the
  // roll flicker; easing toward the target instead lets the fabric build and
  // release weight. Scroll position is smoothed for the same reason — it drives
  // the ripple phase, which otherwise strobes at high scroll speeds.
  const rollStrengthRef = useRef(0);
  const wavePhaseRef = useRef(0);
  const directionRef = useRef(1);

  // Load texture
  useEffect(() => {
    let active = true;
    let loadedTexture;

    new THREE.TextureLoader().load(photo.src, (tex) => {
      loadedTexture = tex;
      if (!active) {
        tex.dispose();
        return;
      }
      // Use NoColorSpace to prevent washed-out colours on raw ShaderMaterials
      tex.colorSpace = THREE.NoColorSpace;
      // Disable mipmaps to prevent sharp LOD boundary lines during the 3D roll
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      setTexture(tex);
    });

    return () => {
      active = false;
      loadedTexture?.dispose();
    };
  }, [photo.src]);

  useFrame((_, delta) => {
    if (!meshRef.current || !materialRef.current || !texture) return;

    // Find the invisible DOM image element
    const el = document.getElementById(`pv-img-${photo.id}`);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    
    // Check if it's visible on screen (generous bleed so a mid-scroll drape
    // never pops out at the edges)
    const isVisible = rect.top < window.innerHeight + 900 && rect.bottom > -900;
    
    if (!isVisible) {
      meshRef.current.visible = false;
      return;
    }
    
    meshRef.current.visible = true;

    // Match scale to DOM pixel dimensions
    meshRef.current.scale.set(rect.width, rect.height, 1);

    // Map DOM position (origin top-left, y goes down) 
    // to WebGL Orthographic (origin center, y goes up)
    const px = rect.left + rect.width / 2 - window.innerWidth / 2;
    const py = -(rect.top + rect.height / 2 - window.innerHeight / 2);
    
    meshRef.current.position.set(px, py, 0);

    // Photos lower on screen paint over ones rolling away above them, matching
    // cloth being pulled up. Explicit order keeps this stable — with depthTest
    // off, a plane receding several hundred px in Z would otherwise pop in
    // front of its neighbour depending on traversal order.
    meshRef.current.renderOrder = Math.round(rect.top);

    // Update shader uniforms
    materialRef.current.uniforms.uTexture.value = texture;
    materialRef.current.uniforms.uHeight.value = rect.height;
    materialRef.current.uniforms.uResolution.value.set(
      window.innerWidth,
      window.innerHeight,
    );

    // Frame-rate-independent easing, so nothing jumps on a dropped frame.
    const phaseEase = 1 - Math.exp(-9 * delta);

    const referenceVelocity = THREE.MathUtils.clamp(
      rollVelocity.get() / 60,
      -120,
      120,
    );

    // Velocity supplies the pull. A soft power curve lets slow trackpad motion
    // register, while the separate release rate gives the fabric enough weight
    // to unwind instead of disappearing between wheel events.
    const speed = Math.abs(referenceVelocity);
    const targetStrength = reduceMotion
      ? 0
      : Math.pow(THREE.MathUtils.clamp(speed / 18, 0, 1), 0.62);
    const strengthEase = targetStrength > rollStrengthRef.current
      ? 1 - Math.exp(-12 * delta)
      : 1 - Math.exp(-5.5 * delta);
    rollStrengthRef.current +=
      (targetStrength - rollStrengthRef.current) * strengthEase;

    wavePhaseRef.current += (scrollY.get() - wavePhaseRef.current) * phaseEase;
    if (Math.abs(referenceVelocity) > 0.2) {
      const directionTarget = Math.sign(referenceVelocity);
      const directionEase = 1 - Math.exp(-10 * delta);
      directionRef.current +=
        (directionTarget - directionRef.current) * directionEase;
    }

    materialRef.current.uniforms.uScrollPos.value = wavePhaseRef.current;
    materialRef.current.uniforms.uRollStrength.value = rollStrengthRef.current;
    materialRef.current.uniforms.uDirection.value = directionRef.current;
    materialRef.current.uniforms.uVelocity.value = reduceMotion
      ? 0
      : referenceVelocity;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      {/* Vertical density carries the roll: the curve is compressed into the
          top band, so too few rows there facet the fabric into flat strips.
          Increased to 256 to completely eliminate vertex hinge lines. */}
      <planeGeometry args={[1, 1, 64, 192]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={CLOTH_VERT}
        fragmentShader={CLOTH_FRAG}
        uniforms={{
          uTexture: { value: null },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uHeight: { value: 1 },
          uScrollPos: { value: 0 },
          // Starts at rest — a non-zero default made every plane mount fully
          // rolled and snap flat on its first frame.
          uRollStrength: { value: 0 },
          uRollDepth: { value: 430 },
          uWaveAmp: { value: 34 },
          uDirection: { value: 1 },
          uVelocity: { value: 0 },
          uOpacity: { value: 1 }
        }}
        transparent={true}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

function PixelPerspectiveCamera() {
  const cameraRef = useRef(null);
  const { size } = useThree();

  useLayoutEffect(() => {
    if (!cameraRef.current) return;

    // At this distance a 45° perspective camera still maps 1 world unit to
    // exactly 1 screen pixel at z=0, while allowing the roll's Z displacement
    // to produce the reference's real perspective compression.
    cameraRef.current.position.z =
      size.height / (2 * Math.tan(THREE.MathUtils.degToRad(45 / 2)));
    cameraRef.current.aspect = size.width / size.height;
    cameraRef.current.updateProjectionMatrix();
  }, [size.height, size.width]);

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      fov={45}
      near={1}
      far={10000}
      position={[0, 0, 1000]}
    />
  );
}

export default function PhotoViewerScene({ photos, scrollY }) {
  const reduceMotion = useReducedMotion();
  const rawVelocity = useVelocity(scrollY);
  // Softer and heavier than a UI spring: fabric has mass, so the roll should
  // lag the scroll slightly and unwind rather than snap back.
  const rollVelocity = useSpring(rawVelocity, {
    stiffness: 260,
    damping: 34,
    mass: 0.5,
  });

  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 4005 }}
    >
      <PixelPerspectiveCamera />
      
      {photos.map((p) => (
        <DOMSyncedImage
          key={p.id}
          photo={p}
          scrollY={scrollY}
          rollVelocity={rollVelocity}
          reduceMotion={reduceMotion}
        />
      ))}
    </Canvas>
  );
}
