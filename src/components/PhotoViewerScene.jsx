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
  varying vec2 vUv;
  varying float vTopFade;

  void main() {
    vUv = uv;
    vec3 pos = position;
    vTopFade = 0.0;

    if (uRollStrength > 0.0001) {
      // This is a viewport-anchored roll, matching the reference. A vertex
      // starts bending when it enters the upper 13% of the browser; the roll
      // develops through a band 30% of the viewport high.
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      float topThreshold = (uResolution.y * 0.5) - (uResolution.y * 0.13);
      float topRange = max(uResolution.y * 0.30, 1.0);
      float band = clamp((worldPosition.y - topThreshold) / topRange, 0.0, 1.0);
      float rollMask = smoothstep(0.0, 1.0, band);

      // The two-stage S curve is the cloth-over-a-roller profile: it first
      // recedes from the camera, then softly returns instead of forming a dome.
      float rollEnter = smoothstep(0.0, 0.42, band);
      float rollReturn = smoothstep(0.44, 0.92, band);
      float curlEnter = sin(rollEnter * 3.14159265 * 0.5);
      float curlReturn = sin(rollReturn * 3.14159265);
      float sCurve = (curlEnter * 0.92) - (curlReturn * 0.30 * 0.48);
      float lift = smoothstep(0.62, 0.98, band) * 48.0 * 0.18;

      // A broad, layered horizontal ripple keeps the rolled edge organic. The
      // phase follows scroll position, exactly like cloth being pulled upward.
      float waveMask = sin(band * 3.14159265);
      float wavePhase = (
        ((uv.x * 2.0 - 1.0) * 3.14159265 * 1.45 / 1.22)
        - uScrollPos * 0.01
      );
      float primaryWave = sin(wavePhase);
      float secondaryWave = sin(wavePhase * 0.52 - 0.95);
      float tertiaryWave = sin(wavePhase * 0.31 + 1.20);
      float smoothWave =
        (primaryWave * 0.68)
        + (secondaryWave * 0.22)
        + (tertiaryWave * 0.10);
      float surfaceWave =
        mix(primaryWave, smoothWave, 0.68) * 36.0 * waveMask;

      // Y is normalized because the DOM-sized mesh scale is applied later.
      // Z remains in screen pixels so the perspective camera creates a real
      // 3D roll of the image pixels, rather than a 2D edge arch.
      pos.y += (lift / max(uHeight, 1.0)) * uRollStrength;
      pos.z -= sCurve * 500.0 * rollMask * uRollStrength;
      pos.z += surfaceWave * uRollStrength;

      // The material thins away at the very top of the roll.
      vTopFade =
        pow(smoothstep(0.30, 1.0, band), 0.70) * uRollStrength;
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

  void main() {
    vec4 tex = texture2D(uTexture, vUv);
    vec3 image = tex.rgb;

    // Match the reference's soft optical treatment on the rolling portion:
    // five directional samples, plus a slight red/blue split at the thinnest
    // edge. Multiplying velocity blur by vTopFade keeps the middle and bottom
    // of the photograph perfectly sharp.
    float fadeBlur = clamp(vTopFade * 0.03, 0.0, 0.08);
    float velocityBlur =
      clamp(abs(uVelocity) * 0.0008, 0.0, 0.08)
      * smoothstep(0.0, 0.30, vTopFade);
    float blurAmount = fadeBlur + velocityBlur;

    if (blurAmount > 0.00001) {
      float velocityDir = sign(uVelocity);
      vec2 dir = vec2(
        0.0,
        blurAmount * (velocityDir == 0.0 ? 1.0 : velocityDir)
      );

      vec3 sampleNearA = texture2D(uTexture, vUv - dir * 0.5).rgb;
      vec3 sampleNearB = texture2D(uTexture, vUv + dir * 0.5).rgb;
      vec3 sampleFarA = texture2D(uTexture, vUv - dir).rgb;
      vec3 sampleFarB = texture2D(uTexture, vUv + dir).rgb;
      vec3 blurred =
        (tex.rgb * 0.32)
        + (sampleNearA * 0.24)
        + (sampleNearB * 0.24)
        + (sampleFarA * 0.10)
        + (sampleFarB * 0.10);

      vec2 aberrationOffset = vec2(0.018 * vTopFade, 0.0);
      vec3 chroma = vec3(
        texture2D(uTexture, vUv + aberrationOffset).r,
        blurred.g,
        texture2D(uTexture, vUv - aberrationOffset).b
      );
      image = mix(blurred, chroma, clamp(vTopFade, 0.0, 1.0));
    }

    float alpha = tex.a * uOpacity * (1.0 - vTopFade);
    gl_FragColor = vec4(image, alpha);
  }
`;

function DOMSyncedImage({ photo, scrollY, rollVelocity, reduceMotion }) {
  const meshRef = useRef(null);
  const materialRef = useRef(null);
  const [texture, setTexture] = useState(null);

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

  useFrame(() => {
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

    // Update shader uniforms
    materialRef.current.uniforms.uTexture.value = texture;
    materialRef.current.uniforms.uHeight.value = rect.height;
    materialRef.current.uniforms.uResolution.value.set(
      window.innerWidth,
      window.innerHeight,
    );
    materialRef.current.uniforms.uScrollPos.value = scrollY.get();

    // Framer reports container velocity in px/s. The small dead zone prevents
    // sensor noise from leaving a crease at rest; a brisk wheel/finger gesture
    // reaches the reference's full 500px roll radius.
    const speed = Math.abs(rollVelocity.get());
    const referenceVelocity = THREE.MathUtils.clamp(
      rollVelocity.get() / 60,
      -120,
      120,
    );
    materialRef.current.uniforms.uRollStrength.value = reduceMotion
      ? 0
      : THREE.MathUtils.smoothstep(speed, 24, 900);
    materialRef.current.uniforms.uVelocity.value = reduceMotion
      ? 0
      : referenceVelocity;
  });

  return (
    <mesh ref={meshRef} visible={false}>
      {/* Matches the reference's vertical mesh density for a smooth top roll. */}
      <planeGeometry args={[1, 1, 24, 48]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={CLOTH_VERT}
        fragmentShader={CLOTH_FRAG}
        uniforms={{
          uTexture: { value: null },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uHeight: { value: 1 },
          uScrollPos: { value: 0 },
          uRollStrength: { value: 1 },
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
  const rollVelocity = useSpring(rawVelocity, {
    stiffness: 430,
    damping: 32,
    mass: 0.32,
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
