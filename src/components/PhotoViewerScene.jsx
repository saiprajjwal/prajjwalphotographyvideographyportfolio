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
  varying vec2 vUv;
  varying float vTopFade;
  varying float vBand;

  void main() {
    vUv = uv;
    vec3 pos = position;
    vTopFade = 0.0;
    vBand = 0.0;

    if (uRollStrength > 0.0001) {
      // Viewport-anchored roll.
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      float topThreshold = (uResolution.y * 0.5) - (uResolution.y * 0.13);
      float topRange = max(uResolution.y * 0.30, 1.0);
      float band = clamp((worldPosition.y - topThreshold) / topRange, 0.0, 1.0);
      float rollMask = smoothstep(0.0, 1.0, band);
      
      vBand = rollMask; // Pass to fragment shader for shading

      // Clean, rigid cylinder roll instead of a wavy cloth
      float rollEnter = smoothstep(0.0, 0.52, band);
      float rollReturn = smoothstep(0.38, 0.96, band);
      float curlEnter = sin(rollEnter * 3.14159265 * 0.5);
      float curlReturn = sin(rollReturn * 3.14159265);
      float sCurve = (curlEnter * 0.92) - (curlReturn * 0.30 * 0.48);
      float lift = smoothstep(0.62, 0.98, band) * 48.0 * 0.18;

      // Y is normalized because the DOM-sized mesh scale is applied later.
      // Z remains in screen pixels so the perspective camera creates a real
      // 3D roll of the image pixels.
      pos.y += (lift / max(uHeight, 1.0)) * uRollStrength;
      pos.z -= sCurve * uRollDepth * rollMask * uRollStrength;

      // The material thins away at the very top of the roll.
      vTopFade = pow(smoothstep(0.30, 1.0, band), 0.70) * uRollStrength;
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
  varying float vBand;

  void main() {
    vec4 tex = texture2D(uTexture, vUv);
    vec3 image = tex.rgb;

    // Match the reference's soft optical treatment on the rolling portion:
    // five directional samples, plus a slight red/blue split at the thinnest edge.
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

      vec2 aberrationOffset = vec2(0.018 * vTopFade, 0.0);
      vec3 chroma = vec3(
        texture2D(uTexture, vUv + aberrationOffset).r,
        blurred.g,
        texture2D(uTexture, vUv - aberrationOffset).b
      );
      image = mix(blurred, chroma, clamp(vTopFade, 0.0, 1.0));
    }

    // Add shadow darkening as it rolls backward
    float shadow = mix(1.0, 0.35, clamp(vBand * 1.2, 0.0, 1.0));
    image *= shadow;

    float alpha = tex.a * uOpacity * (1.0 - vTopFade);
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
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = true;
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
    const rollEase = 1 - Math.exp(-14 * delta);
    const phaseEase = 1 - Math.exp(-9 * delta);

    // The roll is POSITIONAL, not velocity-gated. The shader already derives
    // its shape from where the vertex sits in the viewport, so a photo stays
    // rolled for as long as it is passing under the roller at the top —
    // exactly like the reference. Gating this on scroll speed was what made the
    // effect flash on and vanish the instant you stopped scrolling.
    // The ease here only covers mount and the reduced-motion toggle.
    const targetStrength = reduceMotion ? 0 : 1;
    rollStrengthRef.current +=
      (targetStrength - rollStrengthRef.current) * rollEase;

    wavePhaseRef.current += (scrollY.get() - wavePhaseRef.current) * phaseEase;

    const referenceVelocity = THREE.MathUtils.clamp(
      rollVelocity.get() / 60,
      -120,
      120,
    );

    materialRef.current.uniforms.uScrollPos.value = wavePhaseRef.current;
    materialRef.current.uniforms.uRollStrength.value = rollStrengthRef.current;
    materialRef.current.uniforms.uVelocity.value = reduceMotion
      ? 0
      : referenceVelocity;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      {/* Vertical density carries the roll: the curve is compressed into the
          top band, so too few rows there facet the fabric into flat strips. */}
      <planeGeometry args={[1, 1, 32, 96]} />
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
          uWaveAmp: { value: 26 },
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
