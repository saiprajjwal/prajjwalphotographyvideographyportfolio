import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Faceted glass shards that drift in the space around the photo band and swell
// into view while it is hovered — the effect from aikawakenichi.com.
//
// The important part is that these are real geometry floating in the scene, not
// a filter painted onto the photograph. Each shard is a squashed tetrahedron,
// so its four triangular faces catch the key light at different angles and give
// the hard two-tone crystal look; a fresnel term lights the silhouette so the
// edges read as glass. Colour is sampled from the live panel texture, which is
// why the shards go amber over a warm frame and icy over a cold one, exactly
// like the reference.
//
// They sit around and behind the band and are depth-tested against it, so the
// panel — and the category label baked into it — stays in front and legible.

const COUNT = 60;

const SHARD_VERT = /* glsl */ `
  attribute vec3 aAxis;
  attribute float aSpin;
  attribute float aSeed;
  attribute vec2 aUv;

  uniform float uTime;
  uniform float uHover;

  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec2 vSampleUv;

  // Rodrigues rotation, so each shard tumbles about its own axis without its
  // instance matrix being rewritten from JS every frame.
  mat3 rotAxis(vec3 axis, float a) {
    float s = sin(a);
    float c = cos(a);
    float t = 1.0 - c;
    return mat3(
      t * axis.x * axis.x + c,          t * axis.x * axis.y - s * axis.z, t * axis.x * axis.z + s * axis.y,
      t * axis.x * axis.y + s * axis.z, t * axis.y * axis.y + c,          t * axis.y * axis.z - s * axis.x,
      t * axis.x * axis.z - s * axis.y, t * axis.y * axis.z + s * axis.x, t * axis.z * axis.z + c
    );
  }

  void main() {
    mat3 spin = rotAxis(normalize(aAxis), uTime * aSpin + aSeed * 6.2831853);

    vec4 world = instanceMatrix * vec4(spin * position, 1.0);

    // Idle drift keeps them alive at rest; the hover term pushes each shard
    // gently outward from the band so hovering reads as a slow burst.
    float t = uTime * 0.32 + aSeed * 6.2831853;
    world.xyz += vec3(sin(t) * 0.15, cos(t * 0.87) * 0.17, sin(t * 0.71) * 0.11);
    world.xyz += normalize(vec3(world.xy, 0.0001)) * uHover * (0.30 + aSeed * 0.45);

    vNormalW = normalize(mat3(instanceMatrix) * (spin * normal));

    vec4 mv = modelViewMatrix * world;
    vViewDir = normalize(-mv.xyz);
    vSampleUv = aUv;

    gl_Position = projectionMatrix * mv;
  }
`;

const SHARD_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform float uOpacity;

  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec2 vSampleUv;

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 key = normalize(vec3(0.35, 0.85, 0.55));

    // Wrapped lambert: every facet stays visible, but adjacent faces separate
    // into distinct tones instead of flattening into one silhouette.
    float lambert = clamp(dot(n, key) * 0.5 + 0.5, 0.0, 1.0);
    // Wide spread between facets: the reference's shards read as solid crystal
    // because adjacent faces differ sharply, not as translucent haze.
    float facet = mix(0.40, 1.46, lambert);

    // Colour comes from the photograph currently on the band.
    vec3 base = uHasMap > 0.5
      ? texture2D(uMap, vSampleUv).rgb
      : vec3(0.86, 0.91, 0.96);
    base = mix(base, vec3(1.0), 0.12); // just enough lift to read as glass

    float fres = pow(1.0 - clamp(dot(n, normalize(vViewDir)), 0.0, 1.0), 2.4);

    vec3 col = base * facet + fres * 0.30;
    float alpha = uOpacity * (0.46 + fres * 0.40 + lambert * 0.16);

    if (alpha < 0.004) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

export default function GlassShards({ hoverRef, texture }) {
  const meshRef = useRef(null);
  const matRef = useRef(null);
  // Eased separately from the band's own hover so the shards lag slightly —
  // glass has weight, and an instant pop is what makes this read as fake.
  const shown = useRef(0);

  const reduceMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const geometry = useMemo(() => {
    // PolyhedronGeometry is non-indexed, so its normals are already per-face —
    // that is what gives the hard, unsmoothed facets.
    const geo = new THREE.TetrahedronGeometry(1, 0);

    const axis = new Float32Array(COUNT * 3);
    const spin = new Float32Array(COUNT);
    const seed = new Float32Array(COUNT);
    const uv = new Float32Array(COUNT * 2);

    for (let i = 0; i < COUNT; i += 1) {
      const a = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize();
      axis[i * 3] = a.x;
      axis[i * 3 + 1] = a.y;
      axis[i * 3 + 2] = a.z;

      spin[i] = (Math.random() * 0.4 + 0.12) * (Math.random() < 0.5 ? -1 : 1);
      seed[i] = Math.random();

      // Sample away from the middle of the panel, where the category label is
      // burned into the texture, so shards take the photograph's colour rather
      // than the white of the lettering.
      uv[i * 2] = Math.random() < 0.5 ? Math.random() * 0.28 : 0.72 + Math.random() * 0.28;
      uv[i * 2 + 1] = Math.random();
    }

    geo.setAttribute('aAxis', new THREE.InstancedBufferAttribute(axis, 3));
    geo.setAttribute('aSpin', new THREE.InstancedBufferAttribute(spin, 1));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
    geo.setAttribute('aUv', new THREE.InstancedBufferAttribute(uv, 2));

    return geo;
  }, []);

  // Base transforms are written once — the tumble and drift happen in the
  // shader, so there is no per-frame matrix work for 60 instances.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();

    for (let i = 0; i < COUNT; i += 1) {
      // An annulus around the band: clear of the cylinder's silhouette, so the
      // shards surround the photograph instead of covering it.
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.7 + Math.pow(Math.random(), 0.75) * 2.6;
      pos.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.72,
        -3.4 + Math.random() * 4.6
      );

      euler.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      quat.setFromEuler(euler);

      // Flattened on one axis: plates and slivers, like broken glass, not blobs.
      const s = 0.13 + Math.pow(Math.random(), 1.6) * 0.34;
      scale.set(s, s * (0.5 + Math.random() * 0.7), s * (0.12 + Math.random() * 0.26));

      m.compose(pos, quat, scale);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((state, delta) => {
    if (!matRef.current) return;

    const target = reduceMotion ? 0 : (hoverRef?.current ?? 0);
    // Frame-rate independent, ~0.35s to settle: slow enough to feel like glass
    // swimming into view rather than a UI element toggling.
    shown.current += (target - shown.current) * (1 - Math.exp(-6 * delta));

    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    matRef.current.uniforms.uOpacity.value = shown.current;
    matRef.current.uniforms.uHover.value = shown.current;
    matRef.current.uniforms.uMap.value = texture || null;
    matRef.current.uniforms.uHasMap.value = texture ? 1 : 0;

    if (meshRef.current) meshRef.current.visible = shown.current > 0.002;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, COUNT]}
      visible={false}
      frustumCulled={false}
    >
      <shaderMaterial
        ref={matRef}
        vertexShader={SHARD_VERT}
        fragmentShader={SHARD_FRAG}
        uniforms={{
          uTime: { value: 0 },
          uHover: { value: 0 },
          uOpacity: { value: 0 },
          uMap: { value: null },
          uHasMap: { value: 0 },
        }}
        transparent
        depthWrite={false}
      />
    </instancedMesh>
  );
}
