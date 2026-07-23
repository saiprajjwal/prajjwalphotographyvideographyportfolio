import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';
import * as THREE from 'three';
import { pickCategoryCover } from '../utils/categoryCover';

// ──────────────────────────────────────────────────────────────
// Geometry constants
//
// The reference (aikawakenichi.com) wraps exactly 3 slides around the
// cylinder, so a single photo owns the whole front-facing arc and the
// neighbours only ever show as thin slivers near the silhouette.
// We keep that geometry fixed at 3 panels and recycle textures through
// the slots, so the look holds for any number of categories.
// ──────────────────────────────────────────────────────────────
const SLOTS = 3;
const ANGLE_PER_SLOT = (2 * Math.PI) / SLOTS;
const RADIUS = 2.4;
const PANEL_HEIGHT = 2.15;

// Unwrapped width of one panel, and the gap between panels once flattened
const PANEL_WIDTH = RADIUS * ANGLE_PER_SLOT;
// Spacing in flat mode. Tuned so the neighbouring categories peek in at either
// edge — that sliver is the only cue that there's more to slide to, since flat
// mode has no curve implying a carousel.
const FLAT_GAP = 0.8;
// Corner rounding applied only once the panels have flattened out
const FLAT_CORNER = 0.1;

// Height of the band's centre.
const BAND_Y = 0.1;

// Camera sits far enough back that RADIUS / CAMERA_Z matches the reference's
// curvature. It stays fixed and the FOV does the framing, so the band curves
// identically at every viewport size.
const CAMERA_Z = 12.8;

// Fraction of the frame width the band should span: the reference's 47% on
// wide screens, opening up on narrow ones so it doesn't shrink to a ribbon.
const FILL_WIDE = 0.475;
const FILL_NARROW = 0.86;

// Texture canvas matches the panel's unwrapped aspect (arc length : height)
const BAND_ASPECT = PANEL_WIDTH / PANEL_HEIGHT;
const TEX_W = 1280;
const TEX_H = Math.round(TEX_W / BAND_ASPECT);

// ──────────────────────────────────────────────────────────────
// Ask Cloudinary for a content-aware crop at the band's aspect.
//
// Stored covers are delivered with c_limit, which only constrains size — so
// cropping a 2:3 portrait into this 2.3:1 band centre-crops straight through
// the subject's face. g_auto picks the focal point instead, and doing it at
// the CDN means we fetch a correctly framed image rather than throwing pixels
// away locally.
// ──────────────────────────────────────────────────────────────
function bandCrop(src) {
  const parts = src.split('/image/upload/');
  if (parts.length !== 2) return src;

  // Keep everything from the version segment on; drop any existing transform
  const segments = parts[1].split('/');
  const versionAt = segments.findIndex((s) => /^v\d+$/.test(s));
  const tail = versionAt >= 0 ? segments.slice(versionAt).join('/') : parts[1];

  const transform = `f_auto,q_auto,c_fill,g_auto,ar_${BAND_ASPECT.toFixed(2)},w_${TEX_W}`;
  return `${parts[0]}/image/upload/${transform}/${tail}`;
}

const FALLBACK_IMAGES = {
  Portraits: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1280&q=80&auto=format&fit=crop',
  Pets: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=1280&q=80&auto=format&fit=crop',
  Travel: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1280&q=80&auto=format&fit=crop',
  Products: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1280&q=80&auto=format&fit=crop',
  'Behind The Scene': 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=1280&q=80&auto=format&fit=crop',
};

// ──────────────────────────────────────────────────────────────
// Paint one category panel: photo + neutral edge shading + glass lettering
// ──────────────────────────────────────────────────────────────
function panelFont() {
  return `400 ${Math.round(TEX_H * 0.30)}px "Bodoni Moda", "Playfair Display", Didot, serif`;
}

function paintPanel(img, label) {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d');

  // 1. Photo, cover-fit so it never distorts
  const scale = Math.max(TEX_W / img.width, TEX_H / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (TEX_W - dw) / 2, (TEX_H - dh) / 2, dw, dh);

  // 2. Neutral edge shading only.
  //    No colour wash: the reference's pink cast is the photographer's own
  //    grade baked into their source files (their originals already average
  //    a pink rgb(231,211,224)), not something the site applies. Tinting here
  //    would recolour work that's already been graded. This gradient is pure
  //    black at low alpha, so it darkens the edges into the curve without
  //    shifting hue.
  const vig = ctx.createLinearGradient(0, 0, TEX_W, 0);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0.10)');
  vig.addColorStop(0.32, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(0.68, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.10)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // 5. Glass lettering.
  //    Rather than painting flat white text on top, we cut the word out of a
  //    blurred, brightened copy of the panel itself. The result refracts the
  //    photo behind it, so the label reads as frosted glass sitting *in* the
  //    image instead of a caption laid over it.
  const font = panelFont();
  const cx = TEX_W / 2;
  const cy = TEX_H / 2;

  const glass = document.createElement('canvas');
  glass.width = TEX_W;
  glass.height = TEX_H;
  const gctx = glass.getContext('2d');

  // Blow the panel up slightly before blurring — that offset is what sells
  // the refraction, since the glass bends what's behind it outward.
  gctx.filter = 'blur(7px) brightness(1.42) saturate(0.72)';
  gctx.drawImage(canvas, -TEX_W * 0.035, -TEX_H * 0.045, TEX_W * 1.07, TEX_H * 1.09);
  gctx.filter = 'none';

  // Keep only what falls inside the glyphs
  gctx.globalCompositeOperation = 'destination-in';
  gctx.font = font;
  gctx.textAlign = 'center';
  gctx.textBaseline = 'middle';
  gctx.fillStyle = '#ffffff';
  gctx.fillText(label, cx, cy);

  // Drop shadow under the glass so it lifts off the photo
  ctx.save();
  ctx.shadowColor = 'rgba(30, 14, 48, 0.42)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 4;
  ctx.drawImage(glass, 0, 0);
  ctx.restore();

  // A touch of milky fill keeps the word legible over busy photos
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 252, 248, 0.22)';
  ctx.fillText(label, cx, cy);

  // Bevelled highlight along the top edge of each glyph
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.lineWidth = 1.6;
  ctx.shadowColor = 'rgba(255, 255, 255, 0.55)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = -1.5;
  ctx.strokeText(label, cx, cy);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  // NoColorSpace, deliberately. A raw ShaderMaterial doesn't get three.js's
  // colorspace_fragment chunk, so nothing re-encodes linear back to sRGB on
  // output. Tagging the texture sRGB would make the GPU decode it to linear on
  // sample with no matching encode — the photos come out noticeably darker
  // than the originals. Passing the canvas through untouched renders them
  // exactly as graded.
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  return tex;
}

// ──────────────────────────────────────────────────────────────
// Panel shader.
//
// Vertex positions are generated from UV rather than baked into geometry, so
// one uniform (uFlat) can morph the same mesh between a wrapped cylinder arc
// and a flat plane. That's what drives the ARC / FLAT mode switch.
// ──────────────────────────────────────────────────────────────
const PANEL_VERT = /* glsl */ `
  uniform float uFlat;
  uniform float uReflect;
  uniform float uSide;
  varying vec2 vUv;

  const float RADIUS = ${RADIUS.toFixed(4)};
  const float ARC = ${ANGLE_PER_SLOT.toFixed(6)};
  const float H = ${PANEL_HEIGHT.toFixed(4)};

  void main() {
    vUv = uv;
    float y = (uv.y - 0.5) * H;
    float angle = (uv.x - 0.5) * ARC;

    // 'flat' is a reserved GLSL word, hence 'planar'
    vec3 curved = vec3(RADIUS * sin(angle), y, RADIUS * cos(angle));
    vec3 planar = vec3((uv.x - 0.5) * RADIUS * ARC, y, RADIUS);
    vec3 p = mix(curved, planar, uFlat);

    // Flat mode only: sit the off-centre slides back a touch so the focused
    // one stays dominant. In arc mode the curve already does this.
    float recede = mix(1.0, 1.0 - 0.07 * clamp(uSide, 0.0, 1.0), uFlat);
    p.xy *= recede;

    // Mirror about the panel's lower edge for the reflection copy
    p.y = mix(p.y, -p.y - H, uReflect);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const PANEL_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uReflect;
  uniform float uOpacity;
  uniform float uHasMap;
  uniform float uFlat;
  uniform float uHover;
  uniform float uSide;
  varying vec2 vUv;

  const float PW = ${PANEL_WIDTH.toFixed(5)};
  const float H = ${PANEL_HEIGHT.toFixed(4)};
  const float CR = ${FLAT_CORNER.toFixed(4)};

  float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  void main() {
    if (uHasMap < 0.5) discard;
    vec4 c = texture2D(uMap, vUv);

    // Hovering lifts the panel out of its resting state: a little exposure
    // plus a touch more contrast around the midpoint.
    c.rgb = mix(c.rgb, (c.rgb - 0.5) * 1.06 + 0.5, uHover);
    c.rgb *= 1.0 + uHover * 0.10;

    // Reflections fade with distance from the band, which keeps the falloff
    // tied to the geometry instead of a viewport percentage.
    float fade = pow(1.0 - vUv.y, 1.7) * 0.30;
    float a = c.a * uOpacity * mix(1.0, fade, uReflect);

    // Hold the peeking neighbours back so they read as "more to slide to"
    // rather than competing with the focused slide.
    a *= mix(1.0, 1.0 - 0.42 * clamp(uSide, 0.0, 1.0), uFlat);

    // Round the corners once flattened. Measured in world units so the
    // radius stays even across the panel's 2.3:1 aspect.
    vec2 half_ = vec2(PW, H) * 0.5;
    float sd = sdRoundBox((vUv - 0.5) * vec2(PW, H), half_, CR);
    float corner = 1.0 - smoothstep(-0.012, 0.012, sd);
    a *= mix(1.0, corner, uFlat);

    gl_FragColor = vec4(c.rgb, a);
  }
`;

function makePanelMaterial(isReflection) {
  return new THREE.ShaderMaterial({
    vertexShader: PANEL_VERT,
    fragmentShader: PANEL_FRAG,
    uniforms: {
      uMap: { value: null },
      uFlat: { value: 0 },
      uReflect: { value: isReflection ? 1 : 0 },
      uOpacity: { value: 1 },
      uHasMap: { value: 0 },
      uHover: { value: 0 },
      uSide: { value: 0 },
    },
    transparent: true,
    depthWrite: !isReflection,
    // Render only each panel's outer skin, otherwise the far side of the ring
    // bleeds through and you see the neighbouring panels' labels. The
    // reflection negates y in the vertex shader, which reverses winding, so it
    // needs the opposite face. (three.js only auto-flips for a negative matrix
    // determinant — it can't see a flip done inside the shader.)
    side: isReflection ? THREE.BackSide : THREE.FrontSide,
  });
}

// ──────────────────────────────────────────────────────────────
// Load + paint a texture per category (once)
// ──────────────────────────────────────────────────────────────
function useCategoryTextures(items) {
  const [textures, setTextures] = useState([]);

  useEffect(() => {
    let alive = true;
    const made = [];

    const build = async () => {
      // Title glyphs must be ready before we rasterise them into the canvas
      try {
        await document.fonts.load(panelFont());
      } catch {
        /* font API unavailable — fall through to the serif stack */
      }

      // Try the content-aware crop first, then fall back to the plain source
      // if the CDN rejects the transform — a failed crop must never blank the
      // band.
      const loadImage = (src) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });

      const loaded = await Promise.all(
        items.map(async (item) => {
          const cropped = bandCrop(item.src);
          for (const src of cropped === item.src ? [item.src] : [cropped, item.src]) {
            try {
              return paintPanel(await loadImage(src), item.key);
            } catch {
              /* try the next candidate */
            }
          }
          return null;
        })
      );

      if (!alive) {
        loaded.forEach((t) => t?.dispose());
        return;
      }
      made.push(...loaded);
      setTextures(loaded);
    };

    build();

    return () => {
      alive = false;
      made.forEach((t) => t?.dispose());
    };
  }, [items]);

  return textures;
}

// ──────────────────────────────────────────────────────────────
// Keeps the band filling a consistent share of the frame width, and reports
// the band's screen rect so the DOM layer can hit-test hover / clicks.
//
// A perspective camera's fov is vertical, so a fixed fov lets a narrow
// viewport squeeze the band horizontally until it overflows. Solving fov from
// the aspect instead holds the horizontal framing steady:
//   bandWidth / frameWidth = RADIUS / (CAMERA_Z * aspect * tan(fov / 2))
// ──────────────────────────────────────────────────────────────
function ResponsiveCamera({ rectRef }) {
  const { camera, size } = useThree();

  useEffect(() => {
    const aspect = size.width / size.height;
    // Ease between the wide and narrow fill targets across aspect 0.6 → 1.3
    const t = Math.min(1, Math.max(0, (aspect - 0.6) / 0.7));
    const fill = FILL_NARROW + (FILL_WIDE - FILL_NARROW) * t;

    const fovRad = 2 * Math.atan(RADIUS / (CAMERA_Z * aspect * fill));
    const fovDeg = Math.min(60, THREE.MathUtils.radToDeg(fovRad));
    camera.fov = fovDeg;
    camera.updateProjectionMatrix();

    // Band bounds in canvas pixels, measured at the silhouette depth
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
    const silhouetteDepth = Math.sqrt(CAMERA_Z * CAMERA_Z - RADIUS * RADIUS);
    const frameH = 2 * silhouetteDepth * tanHalf;
    const heightFrac = PANEL_HEIGHT / frameH;
    const centreFrac = 0.5 - BAND_Y / frameH;

    rectRef.current = {
      left: (0.5 - fill / 2) * size.width,
      right: (0.5 + fill / 2) * size.width,
      top: (centreFrac - heightFrac / 2) * size.height,
      bottom: (centreFrac + heightFrac / 2) * size.height,
    };
  }, [camera, size.width, size.height, rectRef]);

  return null;
}

// ──────────────────────────────────────────────────────────────
// The rotating band: 3 fixed slots, textures recycled behind the camera
// ──────────────────────────────────────────────────────────────
function PhotoBand({ textures, activeIndex, flatMode, onSnap, onHoverChange, onTap, rectRef }) {
  const total = textures.length;
  const { gl } = useThree();

  // One ref per collection, filled by callback refs — keeps the hook list flat
  const slots = useRef([]);
  const assigned = useRef([-1, -1, -1]);
  const bandGroup = useRef(null);

  // Continuous carousel position, measured in panels
  const pos = useRef(0);
  const target = useRef(0);
  const dragging = useRef(false);
  const dragged = useRef(false);
  const dragStartX = useRef(0);
  const dragStartTarget = useRef(0);

  // Eased 0 → 1 arc-to-flat morph, and the hover lift
  const flat = useRef(0);
  const hoverLift = useRef(0);
  const hovering = useRef(false);

  // ── Living cylinder ──
  // Momentum: a flick keeps the ring spinning and eases to the nearest panel.
  const velocity = useRef(0);          // target units carried per frame
  const flinging = useRef(false);
  const lastDragTarget = useRef(0);
  // Parallax: the whole band leans toward the cursor and drifts when idle.
  const pointer = useRef({ x: 0, y: 0 }); // -1..1 within the canvas
  const tiltX = useRef(0);
  const tiltZ = useRef(0);
  // Respect the OS setting — no idle drift or tilt for reduced-motion users.
  const calm = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ).current;

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1, 96, 1), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const materials = useMemo(
    () =>
      Array.from({ length: SLOTS }, () => ({
        band: makePanelMaterial(false),
        reflection: makePanelMaterial(true),
      })),
    []
  );
  useEffect(
    () => () => materials.forEach((m) => { m.band.dispose(); m.reflection.dispose(); }),
    [materials]
  );

  // Follow the category chosen elsewhere (filter pills, nav arrows) by the
  // shortest way round the ring
  useEffect(() => {
    if (dragging.current || flinging.current || total === 0) return;
    const current = target.current;
    const currentIdx = ((Math.round(current) % total) + total) % total;
    let delta = activeIndex - currentIdx;
    if (delta > total / 2) delta -= total;
    if (delta < -total / 2) delta += total;
    target.current = current + delta;
  }, [activeIndex, total]);

  useFrame((state) => {
    if (total === 0) return;

    // Momentum: after a flick, keep the ring turning and ease to a stop, then
    // snap to the nearest panel and commit the category.
    if (flinging.current) {
      target.current += velocity.current;
      velocity.current *= 0.925;
      if (Math.abs(velocity.current) < 0.008) {
        flinging.current = false;
        const nearest = Math.round(target.current);
        target.current = nearest;
        if (onSnap) onSnap(((nearest % total) + total) % total);
      }
    }

    // Ease position, mode morph and hover lift
    const diff = target.current - pos.current;
    pos.current = Math.abs(diff) > 0.0002 ? pos.current + diff * 0.11 : target.current;
    flat.current += ((flatMode ? 1 : 0) - flat.current) * 0.08;
    hoverLift.current += ((hovering.current ? 1 : 0) - hoverLift.current) * 0.12;

    if (bandGroup.current) {
      const t = state.clock.elapsedTime;
      const active = dragging.current || flinging.current;

      // Parallax lean toward the cursor; eases back to neutral when idle.
      const targetTiltX = calm ? 0 : pointer.current.y * 0.09;
      const targetTiltZ = calm ? 0 : -pointer.current.x * 0.06;
      tiltX.current += (targetTiltX - tiltX.current) * 0.05;
      tiltZ.current += (targetTiltZ - tiltZ.current) * 0.05;

      // Idle breath: a slow sway + scale pulse, stilled while interacting.
      const breathe = calm || active ? 0 : Math.sin(t * 0.6) * 0.01;
      const sway = calm ? 0 : Math.sin(t * 0.4) * 0.012 * (active ? 0.3 : 1);

      bandGroup.current.rotation.x = tiltX.current;
      bandGroup.current.rotation.z = tiltZ.current + sway;
      bandGroup.current.scale.setScalar(1 + hoverLift.current * 0.055 + breathe);
    }

    const base = Math.round(pos.current);
    const frac = pos.current - base;
    const f = flat.current;

    for (let j = 0; j < SLOTS; j++) {
      // Which side of the ring this slot currently sits on: -1, 0 or +1
      let rel = ((j - base) % SLOTS + SLOTS) % SLOTS;
      if (rel === 2) rel = -1;

      const offset = rel - frac;
      const group = slots.current[j];
      if (group) {
        // Arc mode swings the slot around the axis; flat mode slides it
        // sideways. Blending the two is the mode transition.
        group.rotation.y = offset * ANGLE_PER_SLOT * (1 - f);
        group.position.x = offset * (PANEL_WIDTH + FLAT_GAP) * f;
      }

      // Texture swaps land while the slot is at ±180°, i.e. out of sight.
      // Compare against the material's actual map rather than trusting the
      // cached index, so a late-arriving texture still gets picked up.
      const catIdx = (((base + rel) % total) + total) % total;
      const tex = textures[catIdx] || null;
      assigned.current[j] = catIdx;

      const { band, reflection } = materials[j];
      for (const mat of [band, reflection]) {
        if (mat.uniforms.uMap.value !== tex) {
          mat.uniforms.uMap.value = tex;
          mat.uniforms.uHasMap.value = tex ? 1 : 0;
        }
        mat.uniforms.uFlat.value = f;
        mat.uniforms.uHover.value = hoverLift.current;
        // Continuous, so the neighbours fade up as they slide into focus
        mat.uniforms.uSide.value = Math.min(Math.abs(offset), 1);
      }
      band.uniforms.uOpacity.value = 1;
      reflection.uniforms.uOpacity.value = 1;
    }
  });

  const settle = useCallback(() => {
    const nearest = Math.round(target.current);
    target.current = nearest;
    if (onSnap && total > 0) {
      onSnap(((nearest % total) + total) % total);
    }
  }, [onSnap, total]);

  useEffect(() => {
    const el = gl.domElement;

    const pointFrom = (e) => e.clientX ?? e.touches?.[0]?.clientX ?? 0;

    const inBand = (e) => {
      const r = rectRef.current;
      if (!r) return false;
      const box = el.getBoundingClientRect();
      const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) - box.left;
      const y = (e.clientY ?? e.touches?.[0]?.clientY ?? 0) - box.top;
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };

    const setHover = (on) => {
      if (hovering.current === on) return;
      hovering.current = on;
      el.style.cursor = on ? 'grab' : 'default';
      onHoverChange?.(on);
    };

    // Cursor position within the canvas, normalised to -1..1 for parallax.
    const trackPointer = (e) => {
      const box = el.getBoundingClientRect();
      const cx = e.clientX ?? e.touches?.[0]?.clientX ?? box.left + box.width / 2;
      const cy = e.clientY ?? e.touches?.[0]?.clientY ?? box.top + box.height / 2;
      pointer.current.x = Math.max(-1, Math.min(1, ((cx - box.left) / box.width) * 2 - 1));
      pointer.current.y = Math.max(-1, Math.min(1, ((cy - box.top) / box.height) * 2 - 1));
    };

    const onDown = (e) => {
      if (!inBand(e)) return;
      dragging.current = true;
      dragged.current = false;
      flinging.current = false;
      velocity.current = 0;
      dragStartX.current = pointFrom(e);
      dragStartTarget.current = target.current;
      lastDragTarget.current = target.current;
      el.style.cursor = 'grabbing';
    };

    const onMove = (e) => {
      trackPointer(e);
      if (!dragging.current) {
        setHover(inBand(e));
        onHoverChange?.(hovering.current, e.clientX, e.clientY);
        return;
      }
      const dx = pointFrom(e) - dragStartX.current;
      if (Math.abs(dx) > 4) dragged.current = true;
      // Drag right → bring the previous panel forward
      const next = dragStartTarget.current - dx / 260;
      // Track instantaneous velocity so a flick can carry momentum on release.
      velocity.current = next - lastDragTarget.current;
      lastDragTarget.current = next;
      target.current = next;
      onHoverChange?.(true, e.clientX, e.clientY);
    };

    const onUp = (e) => {
      if (!dragging.current) return;
      dragging.current = false;
      el.style.cursor = hovering.current ? 'grab' : 'default';

      if (dragged.current) {
        // A real flick keeps spinning; a gentle release just settles.
        if (Math.abs(velocity.current) > 0.02) {
          flinging.current = true;
        } else {
          settle();
        }
      } else if (inBand(e)) {
        // A press that never moved is a click on the front panel. Don't
        // re-snap here: settling mid-transition would round to whichever
        // panel happens to be passing and change category behind the click.
        // Hand up the band's viewport rect so the category view can fly the
        // cover out of exactly where the 3D panel sits (shared-element open).
        const r = rectRef.current;
        const box = el.getBoundingClientRect();
        const originRect = r
          ? {
              left: box.left + r.left,
              top: box.top + r.top,
              width: r.right - r.left,
              height: r.bottom - r.top,
            }
          : null;
        onTap?.(originRect);
      }
    };

    const onLeave = () => {
      setHover(false);
      // Recentre the parallax so the band returns to rest when the cursor goes
      pointer.current.x = 0;
      pointer.current.y = 0;
    };

    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('touchstart', onDown);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [gl, settle, onHoverChange, onTap, rectRef]);

  if (total === 0) return null;

  return (
    <group ref={bandGroup} position={[0, BAND_Y, 0]}>
      {[0, 1, 2].map((j) => (
        // Band and reflection share one slot group, so they can never drift
        // out of alignment as the ring turns.
        // frustumCulled={false} is required, not an optimisation opt-out.
        // Panel vertices are placed by the vertex shader, so the geometry's
        // bounding sphere still describes the original unit plane sitting at
        // the slot origin. In flat mode the slot is translated a full panel
        // width sideways, which puts that stale sphere outside the frustum —
        // three.js culls the neighbours even though their real geometry
        // reaches back into frame. Six meshes cost nothing to always draw.
        <group key={`slot-${j}`} ref={(el) => { slots.current[j] = el; }}>
          <mesh geometry={geometry} material={materials[j].band} frustumCulled={false} />
          <mesh
            geometry={geometry}
            material={materials[j].reflection}
            renderOrder={-1}
            frustumCulled={false}
          />
        </group>
      ))}
    </group>
  );
}

// ──────────────────────────────────────────────────────────────
// Cinematic post-processing: a soft bloom on the brightest parts (glass
// lettering, highlights in the photos) and a whisper of chromatic aberration
// for a real-lens feel. Deliberately restrained — enough to read as "shot on
// glass", not a filter. Skipped on low-end / mobile via the `quality` gate.
//
// Kept transparency-safe: no vignette/DoF, which would grey the white page
// behind the band. mipmapBlur bloom composites cleanly over the alpha canvas.
// ──────────────────────────────────────────────────────────────
function HeroPostFX() {
  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      <Bloom
        mipmapBlur
        intensity={0.55}
        luminanceThreshold={0.72}
        luminanceSmoothing={0.28}
        radius={0.7}
      />
      <ChromaticAberration offset={[0.0007, 0.0007]} radialModulation modulationOffset={0.35} />
    </EffectComposer>
  );
}

export default function PortfolioHeroScene({
  categories,
  activeIndex,
  photos,
  photosLoaded = true,
  flatMode,
  onCategoryChange,
  onHoverChange,
  onTap,
}) {
  // Postprocessing is GPU-heavy; only run it where there's headroom.
  const postFX = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const mobile = window.matchMedia('(max-width: 768px)').matches;
    const cores = navigator.hardwareConcurrency || 8;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !mobile && !reduce && cores > 4;
  }, []);
  const items = useMemo(
    () => {
      // Hold the band blank until real photos arrive. Otherwise the Unsplash
      // FALLBACK_IMAGES paint instantly (they're a warm CDN) and flash a stock
      // stranger for a beat before the real Cloudinary cover swaps in.
      if (!photosLoaded) return [];
      return categories.map((cat) => {
        const catPhotos = photos.filter(
          (p) => (p.category || '').toLowerCase() === cat.toLowerCase()
        );
        return {
          key: cat,
          // Fallback only for a category that genuinely has no photo yet.
          src: pickCategoryCover(catPhotos)?.src || FALLBACK_IMAGES[cat] || FALLBACK_IMAGES.Portraits,
        };
      });
    },
    [categories, photos, photosLoaded]
  );

  const textures = useCategoryTextures(items);
  const rectRef = useRef(null);

  return (
    <Canvas
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, CAMERA_Z], fov: 28.5 }}
      style={{ width: '100%', height: '100%' }}
      dpr={[1, 1.5]}
    >
      <ResponsiveCamera rectRef={rectRef} />
      <PhotoBand
        textures={textures}
        activeIndex={activeIndex}
        flatMode={flatMode}
        onSnap={onCategoryChange}
        onHoverChange={onHoverChange}
        onTap={onTap}
        rectRef={rectRef}
      />
      {postFX && <HeroPostFX />}
    </Canvas>
  );
}
