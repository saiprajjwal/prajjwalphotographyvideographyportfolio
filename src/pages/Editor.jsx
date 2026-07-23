import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Upload, Download, RotateCw, RefreshCw, Undo, Redo, Save, Eye, Type, Crosshair, ChevronDown, SlidersHorizontal, Crop, LayoutTemplate, Palette, Sparkles, Droplet, Frame, Brush, Settings, Smile, PenTool, Trash2, Wand2, Loader2 } from 'lucide-react';
import './Editor.css';

// Fully client-side basic photo editor for social posts. Nothing is uploaded to
// a server — everything runs in the browser via <canvas>. This page is lazily
// loaded (see App.jsx) so it never affects the rest of the site's load time.

// --- IndexedDB Helper for Large File Storage ---
const DB_NAME = 'PhotoEditorDB';
const STORE_NAME = 'images';

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => { e.target.result.createObjectStore(STORE_NAME); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSave(key, blob) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function idbLoad(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbClear(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// iOS Safari silently ignores CanvasRenderingContext2D.filter — feature-detect
// so blur effects can fall back, and never rely on it for tone adjustments.
const CTX_FILTER_SUPPORTED = (() => {
  try {
    const t = document.createElement('canvas').getContext('2d');
    t.filter = 'blur(2px)';
    return t.filter === 'blur(2px)';
  } catch { return false; }
})();

// Cross-device blur fallback: downscale + smooth upscale approximates a
// gaussian well enough for feathering and tilt-shift when ctx.filter is
// unavailable. Mutates the given canvas in place.
function fallbackBlur(srcCanvas, radius) {
  const k = Math.max(2, Math.min(16, Math.round(radius / 1.5)));
  const w = Math.max(1, Math.round(srcCanvas.width / k));
  const h = Math.max(1, Math.round(srcCanvas.height / k));
  const small = document.createElement('canvas');
  small.width = w; small.height = h;
  const sctx = small.getContext('2d');
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(srcCanvas, 0, 0, w, h);
  const dctx = srcCanvas.getContext('2d');
  dctx.save();
  dctx.imageSmoothingEnabled = true;
  dctx.clearRect(0, 0, srcCanvas.width, srcCanvas.height);
  dctx.drawImage(small, 0, 0, srcCanvas.width, srcCanvas.height);
  dctx.restore();
}

// ---- Per-pixel tone engine --------------------------------------------------
// One code path for every device (no ctx.filter): brightness → contrast →
// saturation (CSS-filter-equivalent math), then true white balance, then
// luminance-masked shadows/highlights, then black-point fade.
const TONE_W_SHADOW = new Float32Array(256);
const TONE_W_HIGH = new Float32Array(256);
for (let l = 0; l < 256; l++) {
  const t = l / 255;
  TONE_W_SHADOW[l] = (1 - t) * (1 - t);
  TONE_W_HIGH[l] = t * t;
}

function toneIsNeutral(a) {
  return a.brightness === 100 && a.contrast === 100 && a.saturation === 100 &&
    a.highlights === 0 && a.shadows === 0 && (a.fade || 0) === 0 &&
    a.warmth === 0 && a.tint === 0;
}

function applyTonePass(ctx, W, H, a) {
  if (toneIsNeutral(a)) return;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const br = a.brightness / 100;
  const ct = a.contrast / 100;
  const sat = a.saturation / 100;
  const doBCS = br !== 1 || ct !== 1 || sat !== 1;
  const sh = (a.shadows / 100) * 0.75;
  const hi = (a.highlights / 100) * 0.75;
  const doWB = a.warmth !== 0 || a.tint !== 0;
  const gainR = 1 + (a.warmth / 100) * 0.22;
  const gainB = 1 - (a.warmth / 100) * 0.22;
  const gainG = 1 - (a.tint / 100) * 0.13;
  const f = (a.fade || 0) / 100;
  const fadeLift = f * 36;      // raised black point
  const fadeFlat = 1 - f * 0.18; // gentle contrast flattening
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (doBCS) {
      r = (r * br - 127.5) * ct + 127.5;
      g = (g * br - 127.5) * ct + 127.5;
      b = (b * br - 127.5) * ct + 127.5;
      if (sat !== 1) {
        const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
        r = lum + (r - lum) * sat;
        g = lum + (g - lum) * sat;
        b = lum + (b - lum) * sat;
      }
    }
    if (doWB) { r *= gainR; g *= gainG; b *= gainB; }
    let l = (r * 77 + g * 150 + b * 29) >> 8;
    if (l > 255) l = 255; else if (l < 0) l = 0;
    if (sh !== 0) { const k = 1 + sh * TONE_W_SHADOW[l]; r *= k; g *= k; b *= k; }
    if (hi !== 0) { const k = 1 + hi * TONE_W_HIGH[l]; r *= k; g *= k; b *= k; }
    if (f > 0) { r = r * fadeFlat + fadeLift; g = g * fadeFlat + fadeLift; b = b * fadeFlat + fadeLift; }
    d[i] = r; d[i + 1] = g; d[i + 2] = b; // Uint8Clamped clamps for us
  }
  ctx.putImageData(img, 0, 0);
}

const ASPECTS = [
  { id: 'original', label: 'Original' },
  { id: '1:1', label: 'Square', ar: 1 },
  { id: '4:5', label: 'Portrait', ar: 4 / 5 },
  { id: '3:2', label: '3:2 Classic', ar: 3 / 2 },
  { id: '2:3', label: '2:3 Tall', ar: 2 / 3 },
  { id: '5:4', label: '5:4 Print', ar: 5 / 4 },
  { id: '9:16', label: 'Story', ar: 9 / 16 },
  { id: '16:9', label: 'Wide', ar: 16 / 9 },
];

const DEFAULT_ADJ = { 
  brightness: 100, contrast: 100, saturation: 100, 
  warmth: 0, tint: 0, highlights: 0, shadows: 0, 
  vignette: 0, grain: 0, fade: 0, sharpen: 0, 
  duotone: 0, duotoneC1: '#000080', duotoneC2: '#ffcc00',
  frame: 'none',
  tiltShift: 0, graduated: 0, radial: 0, glitch: 0, halftone: 0,
  texture: 0, clarity: 0
};

// Curated looks, grouped the way a photographer thinks: quick essentials,
// film-stock emulations, black & white, and graded cinematic styles.
const PRESETS = [
  // — Essentials —
  { id: 'None', group: 'Essentials', adj: { ...DEFAULT_ADJ } },
  { id: 'Punch', group: 'Essentials', adj: { ...DEFAULT_ADJ, contrast: 116, saturation: 122 } },
  { id: 'Warm', group: 'Essentials', adj: { ...DEFAULT_ADJ, warmth: 45, brightness: 104 } },
  { id: 'Cool', group: 'Essentials', adj: { ...DEFAULT_ADJ, warmth: -45 } },
  { id: 'Vivid', group: 'Essentials', adj: { ...DEFAULT_ADJ, saturation: 138, contrast: 108 } },
  { id: 'Pastel Dream', group: 'Essentials', adj: { ...DEFAULT_ADJ, brightness: 115, contrast: 85, saturation: 110, tint: 15, fade: 15, shadows: 30 } },

  // — Film (stock-inspired) —
  { id: 'Portrait Film', group: 'Film', adj: { ...DEFAULT_ADJ, warmth: 15, tint: 5, contrast: 96, saturation: 92, highlights: -12, shadows: 15, fade: 12, grain: 8 } },
  { id: 'Muted Chrome', group: 'Film', adj: { ...DEFAULT_ADJ, saturation: 80, contrast: 108, warmth: -8, shadows: -12, fade: 8, grain: 6 } },
  { id: 'Vivid Slide', group: 'Film', adj: { ...DEFAULT_ADJ, saturation: 145, contrast: 118, warmth: 8, highlights: -8, sharpen: 12 } },
  { id: 'Sun-Faded', group: 'Film', adj: { ...DEFAULT_ADJ, brightness: 108, contrast: 88, saturation: 84, warmth: 30, fade: 45, grain: 18 } },
  { id: 'Film', group: 'Film', adj: { ...DEFAULT_ADJ, contrast: 94, saturation: 88, warmth: 18, vignette: 28, grain: 15 } },
  { id: 'Matte Film', group: 'Film', adj: { ...DEFAULT_ADJ, contrast: 95, saturation: 90, warmth: 15, fade: 40, grain: 25, frame: 'film' } },
  { id: 'Polaroid', group: 'Film', adj: { ...DEFAULT_ADJ, brightness: 110, contrast: 90, saturation: 80, warmth: 25, fade: 20, grain: 15, vignette: 20, frame: 'polaroid' } },

  // — Black & White —
  { id: 'Mono', group: 'B&W', adj: { ...DEFAULT_ADJ, saturation: 0, contrast: 112 } },
  { id: 'Grain 400', group: 'B&W', adj: { ...DEFAULT_ADJ, saturation: 0, contrast: 120, shadows: -10, grain: 35, sharpen: 10 } },
  { id: 'Soft Silver', group: 'B&W', adj: { ...DEFAULT_ADJ, saturation: 0, contrast: 100, highlights: -15, shadows: 20, fade: 20, grain: 15 } },
  { id: 'B&W High Contrast', group: 'B&W', adj: { ...DEFAULT_ADJ, saturation: 0, contrast: 140, highlights: 20, shadows: -40, grain: 10 } },
  { id: 'B&W Soft Matte', group: 'B&W', adj: { ...DEFAULT_ADJ, saturation: 0, contrast: 90, fade: 35, grain: 25 } },

  // — Cinematic —
  { id: 'Golden Hour', group: 'Cinematic', adj: { ...DEFAULT_ADJ, warmth: 35, tint: 10, brightness: 105, contrast: 110, highlights: -15, shadows: 20 } },
  { id: 'Teal & Orange', group: 'Cinematic', adj: { ...DEFAULT_ADJ, contrast: 115, saturation: 110, warmth: 20, tint: 5, duotone: 30, duotoneC1: '#004466', duotoneC2: '#ff9900' } },
  { id: 'Tungsten Night', group: 'Cinematic', adj: { ...DEFAULT_ADJ, warmth: -35, tint: 8, contrast: 105, saturation: 105, shadows: 10, fade: 15, grain: 20 } },
  { id: 'Bleach Bypass', group: 'Cinematic', adj: { ...DEFAULT_ADJ, saturation: 45, contrast: 135, highlights: 10, shadows: -20, sharpen: 15 } },
  { id: 'Editorial Matte', group: 'Cinematic', adj: { ...DEFAULT_ADJ, contrast: 104, saturation: 94, tint: -5, highlights: -20, fade: 25 } },
  { id: 'Moody Dark', group: 'Cinematic', adj: { ...DEFAULT_ADJ, brightness: 90, contrast: 125, saturation: 85, warmth: -10, highlights: -30, shadows: -20, vignette: 40 } },
  { id: 'Street Grime', group: 'Cinematic', adj: { ...DEFAULT_ADJ, contrast: 140, saturation: 65, tint: -15, shadows: -30, grain: 40, sharpen: 20 } },
  { id: 'Cyberpunk', group: 'Cinematic', adj: { ...DEFAULT_ADJ, contrast: 130, saturation: 140, warmth: -25, tint: 45, highlights: 20, shadows: -10, duotone: 50, duotoneC1: '#0011ff', duotoneC2: '#ff00ee' } },
];

const PRESET_GROUPS = ['Essentials', 'Film', 'B&W', 'Cinematic'];

const SLIDERS = [
  { key: 'brightness', label: 'Brightness', min: 50, max: 150 },
  { key: 'contrast', label: 'Contrast', min: 50, max: 150 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 200 },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100 },
  { key: 'fade', label: 'Fade', min: 0, max: 100 },
  { key: 'texture', label: 'Texture', min: -100, max: 100 },
  { key: 'clarity', label: 'Clarity', min: -100, max: 100 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100 },
  { key: 'grain', label: 'Grain', min: 0, max: 100 },
  { key: 'sharpen', label: 'Sharpen', min: 0, max: 100 },
];

const EFFECT_SLIDERS = [
  { key: 'tiltShift', label: 'Tilt-Shift', min: 0, max: 100 },
  { key: 'graduated', label: 'Graduated', min: 0, max: 100 },
  { key: 'radial', label: 'Radial', min: 0, max: 100 },
  { key: 'glitch', label: 'Glitch', min: 0, max: 100 },
  { key: 'halftone', label: 'Halftone', min: 0, max: 100 },
];

const FONTS = [
  'Inter',
  'Montserrat',
  'Playfair Display',
  'Cinzel',
  'Cormorant Garamond',
  'Bodoni Moda',
  'Didot',
  'Optima',
  'Baskerville',
  'Arial',
  'Helvetica',
  'Verdana',
  'Trebuchet MS',
  'Tahoma',
  'Times New Roman',
  'Georgia',
  'Garamond',
  'Courier New',
  'Brush Script MT',
  'Comic Sans MS',
  'Impact',
  'Arial Black',
  'Luminari',
  'Marker Felt',
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy'
];

// Export at the source's full resolution (capped at a canvas-safe max side).
// Aspect crops derive their pixel size from the source too, so a 24MP photo
// cropped to 3:2 exports at 24MP-class resolution, not a fixed social size.
const MAX_EXPORT_SIDE = 8192;

function getOutputSize(image, aspect) {
  let w = image.naturalWidth, h = image.naturalHeight;

  if (aspect !== 'original') {
    const { ar } = ASPECTS.find((x) => x.id === aspect);
    // Largest centered crop of the source at this aspect ratio
    if (w / h > ar) w = Math.round(h * ar);
    else h = Math.round(w / ar);
  }

  const m = Math.max(w, h);
  if (m > MAX_EXPORT_SIDE) {
    const k = MAX_EXPORT_SIDE / m;
    w = Math.round(w * k);
    h = Math.round(h * k);
  }
  return { w, h };
}

// The three display faces only this tool's text picker offers. Loaded on
// demand here rather than globally, so no other visitor pays for them.
const EDITOR_ONLY_FONTS =
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400..900&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&family=Montserrat:ital,wght@0,100..900;1,100..900&display=swap';

export default function Editor() {
  // Add the picker-only faces when the editor opens; harmless if a prior mount
  // already injected them (guarded by id).
  useEffect(() => {
    if (document.getElementById('editor-fonts')) return;
    const link = document.createElement('link');
    link.id = 'editor-fonts';
    link.rel = 'stylesheet';
    link.href = EDITOR_ONLY_FONTS;
    document.head.appendChild(link);
  }, []);

  const [image, setImage] = useState(null);
  const [sourceName, setSourceName] = useState('photo');
  const [adj, setAdj] = useState({ ...DEFAULT_ADJ });
  const [preset, setPreset] = useState('None');
  const [aspect, setAspect] = useState('original');
  const [rotation, setRotation] = useState(0);
  const [straighten, setStraighten] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const [texts, setTexts] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  
  const [stickers, setStickers] = useState([]);
  const [selectedStickerId, setSelectedStickerId] = useState(null);

  const [drawings, setDrawings] = useState([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [brushColor, setBrushColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(0.02);
  
  const [isPickingWB, setIsPickingWB] = useState(false);

  const [masks, setMasks] = useState([]);
  const [activeMaskId, setActiveMaskId] = useState(null);
  const [isMaskingMode, setIsMaskingMode] = useState(false);
  const [maskBrushSize, setMaskBrushSize] = useState(0.05);
  const [showMaskOverlay, setShowMaskOverlay] = useState(true);
  const [isDraggingMaskSlider, setIsDraggingMaskSlider] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [exportFormat, setExportFormat] = useState('jpeg');
  const [exportQuality, setExportQuality] = useState(92);

  const [patches, setPatches] = useState([]);
  const [isPatchMode, setIsPatchMode] = useState(false);
  const [patchSource, setPatchSource] = useState(null); // {x, y}
  const [patchBrushSize, setPatchBrushSize] = useState(0.05);

  const [openSections, setOpenSections] = useState({ presets: false, text: false, stickers: false, crop: true, wb: true, adjust: true, effects: false, splitTone: false, frames: false, export: false, draw: false, masks: false, patch: false });
  // Land on Presets: it's the friendliest entry point on mobile — one tap
  // shows a result. (Masks as the default left mobile users staring at a
  // panel with no editing controls.)
  const [activeTab, setActiveTab] = useState('presets');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 760);
  const [vpTick, setVpTick] = useState(0);

  useEffect(() => {
    let resizeT;
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 760);
      // Debounced tick so the preview canvas re-fits to the new viewport
      clearTimeout(resizeT);
      resizeT = setTimeout(() => setVpTick((t) => t + 1), 150);
    };
    window.addEventListener('resize', handleResize);
    return () => { clearTimeout(resizeT); window.removeEventListener('resize', handleResize); };
  }, []);

  const isSectionOpen = (key) => isMobile ? activeTab === key : openSections[key];

  const toggleMaskingMode = (id) => {
    if (activeMaskId === id && isMaskingMode) {
      setIsMaskingMode(false);
      setActiveMaskId(null);
    } else {
      setActiveMaskId(id);
      setIsMaskingMode(true);
    }
  };

  const addMask = () => {
    const id = 'Mask ' + (masks.length + 1);
    setMasks([...masks, { id, adj: { ...DEFAULT_ADJ }, paths: [] }]);
    setActiveMaskId(id);
    setIsMaskingMode(true);
    scheduleHistorySave();
  };

  const generateAIMask = async (type) => {
    if (!image) return;
    setIsProcessingAI(true);
    try {
      // Loaded on demand — keeps the ~0.8MB AI runtime out of the editor's
      // initial bundle; it's only fetched when the user runs Select Subject.
      const { removeBackground } = await import('@imgly/background-removal');
      const blob = await removeBackground(image.src);
      const bitmap = await createImageBitmap(blob);
      
      const id = 'Mask ' + (masks.length + 1) + (type === 'subject' ? ' (Subject)' : ' (Background)');
      setMasks([...masks, { id, aiType: type, aiMask: bitmap, adj: { ...DEFAULT_ADJ }, paths: [] }]);
      setActiveMaskId(id);
      setIsMaskingMode(true);
      scheduleHistorySave();
    } catch (err) {
      console.error("AI Masking failed:", err);
      alert("AI Masking failed. Please check the console.");
    } finally {
      setIsProcessingAI(false);
    }
  };

  const deleteMask = (id, e) => {
    e.stopPropagation();
    setMasks(masks.filter(m => m.id !== id));
    if (activeMaskId === id) {
      setActiveMaskId(null);
      setIsMaskingMode(false);
    }
    scheduleHistorySave();
  };

  const setMaskAdj = (key, value) => {
    setMasks(masks.map(m => m.id === activeMaskId ? { ...m, adj: { ...m.adj, [key]: value } } : m));
    scheduleHistorySave();
  };

  const [isComparing, setIsComparing] = useState(false);
  const [loupe, setLoupe] = useState(false);
  const [loupePan, setLoupePan] = useState({ x: 0, y: 0 });
  const [clipping, setClipping] = useState({ lo: false, hi: false });
  const histRef = useRef(null);
  const histTimer = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [customPresets, setCustomPresets] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('pe-custom-presets');
    if (saved) setCustomPresets(JSON.parse(saved));
  }, []);

  const previewRef = useRef(null);
  const fileRef = useRef(null);
  const previewSize = useRef({ w: 1, h: 1 });
  const dragRef = useRef(null);
  const grainCanvasRef = useRef(null); // Offscreen canvas for grain
  const adjCanvasRef = useRef(null); // Offscreen canvas for mask adjustments
  const maskCanvasRef = useRef(null); // Offscreen canvas for mask shape
  const textBounds = useRef([]); // Stores bounding boxes for text & stickers hit-testing
  
  // Advanced tools offscreen canvases
  const clarityCanvasRef = useRef(null);
  const patchSourceCanvasRef = useRef(null);
  const patchStrokeCanvasRef = useRef(null);

  // Debounced history saving
  const saveStateTimeout = useRef(null);
  const getCurrentState = useCallback(() => ({ 
    adj, aspect, rotation, straighten, flipH, zoom, pan, texts, stickers, drawings, masks, patches 
  }), [adj, aspect, rotation, straighten, flipH, zoom, pan, texts, stickers, drawings, masks, patches]);

  const scheduleHistorySave = useCallback(() => {
    clearTimeout(saveStateTimeout.current);
    saveStateTimeout.current = setTimeout(() => {
      const state = getCurrentState();
      setHistory(h => {
        const nextHistory = h.slice(0, historyIndex + 1);
        nextHistory.push(state);
        setHistoryIndex(nextHistory.length - 1);
        return nextHistory;
      });
      localStorage.setItem('pe-current-state', JSON.stringify(state));
    }, 400);
  }, [getCurrentState, historyIndex]);

  const applyState = (state) => {
    if (!state) return;
    if (state.adj) setAdj(state.adj); 
    if (state.aspect) setAspect(state.aspect); 
    if (state.rotation !== undefined) setRotation(state.rotation);
    setStraighten(state.straighten || 0);
    if (state.flipH !== undefined) setFlipH(state.flipH); 
    if (state.zoom !== undefined) setZoom(state.zoom); 
    if (state.pan) setPan(state.pan);
    if (state.texts) setTexts(state.texts);
    if (state.stickers) setStickers(state.stickers);
    if (state.drawings) setDrawings(state.drawings);
    if (state.masks) setMasks(state.masks);
    if (state.patches) setPatches(state.patches);
  };

  useEffect(() => {
    // Cancel any pending clear from a StrictMode unmount
    if (window.peClearTimeout) {
      clearTimeout(window.peClearTimeout);
    }

    const savedPresets = localStorage.getItem('pe-custom-presets');
    if (savedPresets) setCustomPresets(JSON.parse(savedPresets));

    const isNewSession = !sessionStorage.getItem('pe-active-session');
    sessionStorage.setItem('pe-active-session', 'true');

    if (isNewSession) {
      // Clear data if this is a brand new tab/window
      idbClear('pe-current-image').catch(console.error);
      localStorage.removeItem('pe-current-state');
    } else {
      // Restore image from IndexedDB on refresh
      idbLoad('pe-current-image').then((blob) => {
        if (blob) {
          if (blob.name) setSourceName(blob.name.replace(/\.[^.]+$/, ''));
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            setImage(img);
            // Restore state from localStorage
            const savedState = localStorage.getItem('pe-current-state');
            if (savedState) {
              const parsed = JSON.parse(savedState);
              applyState(parsed);
              setHistory([parsed]);
              setHistoryIndex(0);
            } else {
              const initial = { adj: { ...DEFAULT_ADJ }, aspect: 'original', rotation: 0, straighten: 0, flipH: false, zoom: 1, pan: { x: 0, y: 0 }, texts: [], stickers: [], drawings: [] };
              setHistory([initial]);
              setHistoryIndex(0);
            }
          };
          img.src = url;
        }
      }).catch(console.error);
    }

    // Cleanup: clear DB when unmounting (navigating away to another page)
    // We use a small timeout so React 18 Strict Mode doesn't clear the photo during dev mode remounts
    return () => {
      window.peClearTimeout = setTimeout(() => {
        idbClear('pe-current-image').catch(console.error);
        localStorage.removeItem('pe-current-state');
      }, 100);
    };
  }, []);

  const handleUndo = () => {
    if (historyIndex > 0) {
      applyState(history[historyIndex - 1]);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      applyState(history[historyIndex + 1]);
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Keyboard shortcuts: Cmd/Ctrl+Z undo, Cmd+Shift+Z / Ctrl+Y redo,
  // hold Space or \ to compare with the original.
  useEffect(() => {
    if (!image) return;
    const isTyping = (e) =>
      (e.target.tagName === 'INPUT' && e.target.type !== 'range') ||
      e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';
    const onKeyDown = (e) => {
      if (isTyping(e)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.key === '\\' || e.code === 'Space') && !e.repeat) {
        if (e.code === 'Space') e.preventDefault(); // stop page scroll
        setIsComparing(true);
      }
    };
    const onKeyUp = (e) => {
      if (e.key === '\\' || e.code === 'Space') setIsComparing(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  // Draw the whole scene into a context at the given output size. Shared by the
  // live preview and the export so what you see is exactly what you download.
  // `view` (preview-only) overrides zoom/pan for the 1:1 loupe without
  // touching the real crop state.
  const draw = useCallback((ctx, W, H, forExport = false, view = null) => {
    if (!image) return;
    const effZoom = view ? view.zoom : zoom;
    const effPan = view ? view.pan : pan;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Brightness/contrast/saturation are applied in the per-pixel tone pass
    // below — NOT via ctx.filter, which iOS Safari silently ignores. One code
    // path means pixel-identical results on every device.

    const rot = ((rotation % 360) + 360) % 360;
    const swap = rot === 90 || rot === 270;
    const fW = swap ? H : W;
    const fH = swap ? W : H;

    // Straighten: fine rotation needs the image scaled up so the rotated
    // frame stays fully covered (no empty corners). The multiplier is the
    // rotated frame's bounding box relative to the frame itself.
    const fine = (straighten * Math.PI) / 180;
    const cosF = Math.abs(Math.cos(fine));
    const sinF = Math.abs(Math.sin(fine));
    const coverMul = straighten !== 0
      ? Math.max((fW * cosF + fH * sinF) / fW, (fW * sinF + fH * cosF) / fH)
      : 1;

    const scale = Math.max(fW / image.naturalWidth, fH / image.naturalHeight) * effZoom * coverMul;
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;

    let px = effPan.x * W;
    let py = effPan.y * H;
    const maxPx = Math.max(0, (dw - fW * coverMul) / 2);
    const maxPy = Math.max(0, (dh - fH * coverMul) / 2);
    px = Math.max(-maxPx, Math.min(maxPx, px));
    py = Math.max(-maxPy, Math.min(maxPy, py));

    ctx.translate(W / 2 + px, H / 2 + py);
    ctx.rotate((rot * Math.PI) / 180 + fine);
    ctx.scale(flipH ? -1 : 1, 1);
    ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    if (isComparing) return;

    // -- PATCH TOOL (Healing / Clone Stamp) --
    if (patches && patches.length > 0) {
      if (!patchSourceCanvasRef.current) patchSourceCanvasRef.current = document.createElement('canvas');
      const psc = patchSourceCanvasRef.current;
      if (psc.width !== W || psc.height !== H) { psc.width = W; psc.height = H; }
      const pscCtx = psc.getContext('2d');
      pscCtx.clearRect(0, 0, W, H);
      pscCtx.drawImage(ctx.canvas, 0, 0);
      
      if (!patchStrokeCanvasRef.current) patchStrokeCanvasRef.current = document.createElement('canvas');
      const sc = patchStrokeCanvasRef.current;
      if (sc.width !== W || sc.height !== H) { sc.width = W; sc.height = H; }
      const scCtx = sc.getContext('2d');

      ctx.save();
      patches.forEach(p => {
        if (!p.path || p.path.length === 0 || !p.source) return;
        const dx = p.source.x - p.path[0].x;
        const dy = p.source.y - p.path[0].y;
        const r = p.size * Math.max(W, H);

        scCtx.clearRect(0, 0, W, H);
        scCtx.lineCap = 'round';
        scCtx.lineJoin = 'round';
        scCtx.lineWidth = r * 2;
        scCtx.shadowBlur = r * 0.8;
        scCtx.shadowColor = 'black';
        scCtx.strokeStyle = 'black';
        scCtx.beginPath();
        scCtx.moveTo(p.path[0].x * W, p.path[0].y * H);
        p.path.forEach(pt => scCtx.lineTo(pt.x * W, pt.y * H));
        scCtx.stroke();
        
        scCtx.globalCompositeOperation = 'source-in';
        scCtx.drawImage(psc, -dx * W, -dy * H);
        scCtx.globalCompositeOperation = 'source-over';
        
        ctx.drawImage(sc, 0, 0);
      });
      ctx.restore();
    }

    // ---- Premium tone pipeline --------------------------------------------
    // Shared per-pixel engine (applyTonePass): brightness/contrast/saturation,
    // true white balance, luminance-masked highlights/shadows, and black-point
    // fade — identical results on every device, no ctx.filter dependence.
    applyTonePass(ctx, W, H, adj);

    // -- CLARITY (Large-radius local contrast) --
    if (adj.clarity !== 0) {
      if (!clarityCanvasRef.current) clarityCanvasRef.current = document.createElement('canvas');
      const cc = clarityCanvasRef.current;
      if (cc.width !== W || cc.height !== H) { cc.width = W; cc.height = H; }
      const cCtx = cc.getContext('2d');
      cCtx.drawImage(ctx.canvas, 0, 0);
      fallbackBlur(cc, 25);
      
      const imgData = ctx.getImageData(0, 0, W, H);
      const blurData = cCtx.getImageData(0, 0, W, H);
      const d = imgData.data;
      const bd = blurData.data;
      const amount = adj.clarity / 100;
      
      for (let i = 0; i < d.length; i += 4) {
        if (amount > 0) {
           d[i] = Math.min(255, Math.max(0, d[i] + (d[i] - bd[i]) * amount));
           d[i+1] = Math.min(255, Math.max(0, d[i+1] + (d[i+1] - bd[i+1]) * amount));
           d[i+2] = Math.min(255, Math.max(0, d[i+2] + (d[i+2] - bd[i+2]) * amount));
        } else {
           const blend = -amount;
           d[i] = d[i] * (1 - blend) + bd[i] * blend;
           d[i+1] = d[i+1] * (1 - blend) + bd[i+1] * blend;
           d[i+2] = d[i+2] * (1 - blend) + bd[i+2] * blend;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // -- TEXTURE (High-frequency detail) --
    if (adj.texture !== 0) {
      const imgData = ctx.getImageData(0, 0, W, H);
      const data = imgData.data;
      const tempData = new Uint8ClampedArray(data);
      const amount = adj.texture / 100;
      const w = W;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = (y * w + x) * 4;
          const up = ((y - 1) * w + x) * 4;
          const down = ((y + 1) * w + x) * 4;
          const left = (y * w + (x - 1)) * 4;
          const right = (y * w + (x + 1)) * 4;
          for (let c = 0; c < 3; c++) {
            const edge = 4 * tempData[i+c] - tempData[up+c] - tempData[down+c] - tempData[left+c] - tempData[right+c];
            data[i+c] = tempData[i+c] + edge * amount;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // Split Toning / Duotone Approximation
    if (adj.duotone > 0) {
      ctx.save();
      ctx.globalAlpha = adj.duotone / 100;
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = adj.duotoneC1;
      ctx.fillRect(0, 0, W, H);
      
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = adj.duotoneC2;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    
    if (adj.vignette > 0) {
      ctx.save();
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${(adj.vignette / 100) * 0.75})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (adj.grain > 0) {
      ctx.save();
      if (!grainCanvasRef.current) {
        const gc = document.createElement('canvas');
        gc.width = 128; gc.height = 128;
        const gctx = gc.getContext('2d');
        const imgData = gctx.createImageData(128, 128);
        for (let i = 0; i < imgData.data.length; i += 4) {
          const v = Math.random() * 255;
          imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = v;
          imgData.data[i + 3] = 255; // alpha
        }
        gctx.putImageData(imgData, 0, 0);
        grainCanvasRef.current = gc;
      }
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = (adj.grain / 100) * 0.5; // Max 50% opacity
      const pat = ctx.createPattern(grainCanvasRef.current, 'repeat');
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Sharpen & Glitch (Convolution / Channel Shift)
    if (adj.sharpen > 0 || adj.glitch > 0) {
      const imgData = ctx.getImageData(0, 0, W, H);
      const data = imgData.data;
      const tempData = new Uint8ClampedArray(data);
      
      const sAmount = adj.sharpen / 100;
      const gOffset = Math.floor((adj.glitch / 100) * W * 0.05) * 4;
      const w = W;

      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = (y * w + x) * 4;
          
          if (adj.sharpen > 0) {
            const up = ((y - 1) * w + x) * 4;
            const down = ((y + 1) * w + x) * 4;
            const left = (y * w + (x - 1)) * 4;
            const right = (y * w + (x + 1)) * 4;
            for (let c = 0; c < 3; c++) {
              const val = 5 * tempData[i+c] - tempData[up+c] - tempData[down+c] - tempData[left+c] - tempData[right+c];
              data[i+c] = tempData[i+c] + (val - tempData[i+c]) * sAmount;
            }
          }

          if (adj.glitch > 0) {
            if (i + gOffset < data.length) data[i] = tempData[i + gOffset]; // Shift Red
            if (i - gOffset >= 0) data[i+2] = tempData[i - gOffset + 2]; // Shift Blue
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }

    // Halftone
    if (adj.halftone > 0 && !isComparing) {
      const imgData = ctx.getImageData(0, 0, W, H);
      const data = imgData.data;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#000000';
      const step = Math.max(2, Math.floor((adj.halftone / 100) * 15));
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          const i = (y * W + x) * 4;
          const lum = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
          const radius = (step * 0.6) * (1 - lum / 255);
          if (radius > 0) {
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }

    // Graduated Filter
    if (adj.graduated > 0 && !isComparing) {
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      g.addColorStop(0, `rgba(0,0,0,${adj.graduated / 100})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Radial Filter
    if (adj.radial > 0 && !isComparing) {
      ctx.save();
      const g = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.min(W,H)*0.6);
      g.addColorStop(0, `rgba(255,255,255,${adj.radial / 100 * 0.5})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // Mask Compositing
    if (masks && masks.length > 0 && !isComparing) {
      if (!adjCanvasRef.current) adjCanvasRef.current = document.createElement('canvas');
      if (!maskCanvasRef.current) maskCanvasRef.current = document.createElement('canvas');
      
      const ac = adjCanvasRef.current;
      const mc = maskCanvasRef.current;
      if (ac.width !== W || ac.height !== H) { ac.width = W; ac.height = H; }
      if (mc.width !== W || mc.height !== H) { mc.width = W; mc.height = H; }
      
      masks.forEach(m => {
        if ((!m.paths || m.paths.length === 0) && !m.aiMask) return;
        
        // 1. Draw the mask to mc
        const mCtx = mc.getContext('2d');
        mCtx.globalCompositeOperation = 'source-over';
        mCtx.clearRect(0, 0, W, H);
        
        // Draw AI Mask if it exists
        if (m.aiMask) {
          mCtx.save();
          mCtx.translate(W / 2 + px, H / 2 + py);
          mCtx.rotate((rot * Math.PI) / 180 + fine);
          mCtx.scale(flipH ? -1 : 1, 1);
          
          if (m.aiType === 'background') {
            mCtx.fillStyle = 'white';
            mCtx.fillRect(-dw / 2, -dh / 2, dw, dh);
            mCtx.globalCompositeOperation = 'destination-out';
            mCtx.drawImage(m.aiMask, -dw / 2, -dh / 2, dw, dh);
          } else {
            mCtx.drawImage(m.aiMask, -dw / 2, -dh / 2, dw, dh);
          }
          mCtx.restore();
          mCtx.globalCompositeOperation = 'source-over';
        }

        mCtx.lineCap = 'round';
        mCtx.lineJoin = 'round';
        let maxFeather = 0;
        m.paths.forEach(stroke => {
          if (stroke.points.length === 0) return;
          mCtx.strokeStyle = 'white';
          mCtx.lineWidth = stroke.size * H;
          mCtx.beginPath();
          mCtx.moveTo(stroke.points[0].nx * W, stroke.points[0].ny * H);
          for (let i = 1; i < stroke.points.length; i++) {
            mCtx.lineTo(stroke.points[i].nx * W, stroke.points[i].ny * H);
          }
          // Feather the brush edge relative to its size
          const feather = Math.max(2, stroke.size * H * 0.25);
          if (CTX_FILTER_SUPPORTED) {
            mCtx.filter = `blur(${feather}px)`;
            mCtx.stroke();
            mCtx.filter = 'none';
          } else {
            mCtx.stroke();
            maxFeather = Math.max(maxFeather, feather);
          }
        });
        // iOS Safari: no ctx.filter — feather the whole mask once instead
        if (maxFeather > 0) fallbackBlur(mc, maxFeather);

        // 2. Draw the image to ac and run the same per-pixel tone engine as
        // the global pass — local adjustments render identically on every
        // device (ctx.filter and composite washes are gone).
        const aCtx = ac.getContext('2d');
        aCtx.globalCompositeOperation = 'source-over';
        aCtx.globalAlpha = 1;
        aCtx.clearRect(0, 0, W, H);
        aCtx.translate(W / 2 + px, H / 2 + py);
        aCtx.rotate((rot * Math.PI) / 180 + fine);
        aCtx.scale(flipH ? -1 : 1, 1);
        aCtx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
        aCtx.resetTransform();
        applyTonePass(aCtx, W, H, m.adj);

        // 3. Clip the adjusted layer to the mask
        aCtx.globalAlpha = 1;
        aCtx.globalCompositeOperation = 'destination-in';
        aCtx.drawImage(mc, 0, 0);
        
        // 4. Composite the clipped layer onto the main canvas
        aCtx.globalCompositeOperation = 'source-over';
        ctx.drawImage(ac, 0, 0);

        // 5. Draw red overlay if this is the active mask being edited
        if (!forExport && isMaskingMode && m.id === activeMaskId && showMaskOverlay && !isDraggingMaskSlider) {
          mCtx.globalCompositeOperation = 'source-in';
          mCtx.fillStyle = 'rgba(255, 0, 0, 0.3)';
          mCtx.fillRect(0, 0, W, H);
          ctx.drawImage(mc, 0, 0);
        }
      });
    }

    // Tilt-Shift Blur
    if (adj.tiltShift > 0 && !isComparing) {
      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const octx = off.getContext('2d');
      octx.drawImage(ctx.canvas, 0, 0);

      const blurRadius = Math.max(2, adj.tiltShift / 5);
      ctx.save();
      if (CTX_FILTER_SUPPORTED) {
        ctx.filter = `blur(${blurRadius}px)`;
        ctx.drawImage(off, 0, 0);
        ctx.filter = 'none';
      } else {
        // iOS Safari: blur a copy via downscale/upscale, keep `off` sharp for
        // the destination-over pass below
        const blurred = document.createElement('canvas');
        blurred.width = W; blurred.height = H;
        blurred.getContext('2d').drawImage(off, 0, 0);
        fallbackBlur(blurred, blurRadius);
        ctx.drawImage(blurred, 0, 0);
      }

      ctx.globalCompositeOperation = 'destination-in';
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.3, 'rgba(0,0,0,1)');
      g.addColorStop(0.45, 'rgba(0,0,0,0)');
      g.addColorStop(0.55, 'rgba(0,0,0,0)');
      g.addColorStop(0.7, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = 'destination-over';
      ctx.drawImage(off, 0, 0);
      ctx.restore();
    }

    // Freehand Drawings
    drawings.forEach(stroke => {
      if (stroke.points.length === 0) return;
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size * H;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].nx * W, stroke.points[0].ny * H);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].nx * W, stroke.points[i].ny * H);
      }
      ctx.stroke();
      ctx.restore();
    });

    // Frames & Borders
    if (adj.frame !== 'none' && !isComparing) {
      ctx.save();
      if (adj.frame === 'thin-white' || adj.frame === 'thin-black') {
        ctx.strokeStyle = adj.frame === 'thin-white' ? '#ffffff' : '#000000';
        ctx.lineWidth = Math.max(2, W * 0.025);
        ctx.strokeRect(0, 0, W, H);
      } else if (adj.frame === 'polaroid') {
        ctx.fillStyle = '#ffffff';
        const border = W * 0.05;
        const bottomBorder = H * 0.16;
        ctx.fillRect(0, 0, W, border); // top
        ctx.fillRect(0, 0, border, H); // left
        ctx.fillRect(W - border, 0, border, H); // right
        ctx.fillRect(0, H - bottomBorder, W, bottomBorder); // bottom
      } else if (adj.frame === 'film') {
        ctx.fillStyle = '#000000';
        const border = W * 0.09;
        ctx.fillRect(0, 0, border, H); // left
        ctx.fillRect(W - border, 0, border, H); // right
        // Draw sprockets
        ctx.fillStyle = '#ffffff';
        const spH = H * 0.015;
        const spW = border * 0.35;
        const gap = H * 0.035;
        for (let y = gap; y < H - gap; y += gap) {
          ctx.fillRect(border * 0.3, y, spW, spH); // left sprockets
          ctx.fillRect(W - border + border * 0.35, y, spW, spH); // right sprockets
        }
      }
      ctx.restore();
    }

    // Draw Texts
    if (!forExport) textBounds.current = [];
    texts.forEach(t => {
      ctx.save();
      const actualSize = t.fontSize * H;
      ctx.font = `${actualSize}px ${t.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const actualX = t.nx * W;
      const actualY = t.ny * H;
      const metrics = ctx.measureText(t.text);
      const padding = t.padding * H;
      
      const width = metrics.width + padding * 2;
      const height = actualSize * 1.2 + padding * 2;
      const left = actualX - width / 2;
      const top = actualY - height / 2;

      if (!forExport) {
        textBounds.current.push({
          id: t.id,
          nx1: left / W, nx2: (left + width) / W,
          ny1: top / H, ny2: (top + height) / H
        });
      }

      if (t.bgColor !== 'transparent') {
         ctx.fillStyle = t.bgColor;
         if (ctx.roundRect) {
           ctx.beginPath();
           ctx.roundRect(left, top, width, height, t.borderRadius * H);
           ctx.fill();
         } else {
           ctx.fillRect(left, top, width, height);
         }
      }
      
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, actualX, actualY);
      
      if (!forExport && t.id === selectedTextId) {
         ctx.strokeStyle = '#3b82f6';
         ctx.lineWidth = 2;
         ctx.setLineDash([4, 4]);
         ctx.strokeRect(left, top, width, height);
      }
      ctx.restore();
    });

    // Draw Stickers
    stickers.forEach(s => {
      ctx.save();
      const actualSize = s.size * H;
      ctx.font = `${actualSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const actualX = s.nx * W;
      const actualY = s.ny * H;
      
      const metrics = ctx.measureText(s.emoji);
      const width = metrics.width;
      const height = actualSize;
      const left = actualX - width / 2;
      const top = actualY - height / 2;

      if (!forExport) {
        textBounds.current.push({
          id: s.id, type: 'sticker',
          nx1: left / W, nx2: (left + width) / W,
          ny1: top / H, ny2: (top + height) / H
        });
      }

      ctx.fillText(s.emoji, actualX, actualY);
      
      if (!forExport && s.id === selectedStickerId) {
         ctx.strokeStyle = '#3b82f6';
         ctx.lineWidth = 2;
         ctx.setLineDash([4, 4]);
         ctx.strokeRect(left, top, width, height);
      }
      ctx.restore();
    });

  }, [image, adj, rotation, straighten, flipH, zoom, pan, isComparing, texts, selectedTextId, stickers, selectedStickerId, drawings, masks, isMaskingMode, activeMaskId, showMaskOverlay, isDraggingMaskSlider]);

  // Redraw the preview whenever anything changes. The canvas bitmap is sized
  // at device resolution and draw() runs in bitmap space (identity transform),
  // so pixel operations (tone pass, sharpen, tilt-shift, self-composites) are
  // always aligned — no ghosting on high-DPI screens.
  useEffect(() => {
    if (!image || !previewRef.current) return;
    const { w, h } = getOutputSize(image, aspect);
    const canvas = previewRef.current;
    // Fit the preview to the viewport, never distort. On phones the wrapper
    // spans the screen so we can measure it; on desktop the wrapper wraps the
    // canvas (measuring it would feed back), so use the fixed stage width.
    const smallScreen = window.innerWidth <= 760;
    const availW = smallScreen
      ? (canvas.parentElement?.clientWidth || window.innerWidth - 16)
      : 520;
    const maxH = Math.round(window.innerHeight * (smallScreen ? 0.42 : 0.69));
    const ar = w / h;
    let cssW = availW, cssH = availW / ar;
    if (cssH > maxH) { cssH = maxH; cssW = maxH * ar; }
    cssW = Math.round(cssW); cssH = Math.round(cssH);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pw = cssW * dpr, ph = cssH * dpr; // bitmap dimensions
    canvas.width = pw;
    canvas.height = ph;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    previewSize.current = { w: cssW, h: cssH };
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (loupe) {
      // 1:1 loupe: one image pixel = one device pixel, with its own pan so
      // inspecting detail never changes the actual crop.
      const rot = ((rotation % 360) + 360) % 360;
      const swap = rot === 90 || rot === 270;
      const fW = swap ? ph : pw;
      const fH = swap ? pw : ph;
      const baseCover = Math.max(fW / image.naturalWidth, fH / image.naturalHeight);
      draw(ctx, pw, ph, false, { zoom: Math.max(1 / baseCover, 1e-6), pan: loupePan });
    } else {
      draw(ctx, pw, ph);
    }

    // Live histogram with clipping detection, throttled behind the redraw.
    clearTimeout(histTimer.current);
    histTimer.current = setTimeout(() => {
      const hc = histRef.current;
      if (!hc) return;
      try {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const bins = new Uint32Array(64);
        let lo = 0, hi = 0, total = 0;
        for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
          const lum = (data[i] * 54 + data[i + 1] * 183 + data[i + 2] * 19) >> 8;
          bins[lum >> 2]++;
          if (lum <= 2) lo++; else if (lum >= 253) hi++;
          total++;
        }
        const hctx = hc.getContext('2d');
        const HW = hc.width, HH = hc.height;
        hctx.clearRect(0, 0, HW, HH);
        hctx.fillStyle = 'rgba(255,255,255,0.06)';
        hctx.fillRect(0, 0, HW, HH);
        const peak = Math.max(1, ...bins);
        hctx.fillStyle = 'rgba(255,255,255,0.75)';
        const bw = HW / 64;
        for (let b = 0; b < 64; b++) {
          const bh = Math.round((bins[b] / peak) * (HH - 4));
          hctx.fillRect(b * bw, HH - bh, Math.ceil(bw) , bh);
        }
        setClipping({ lo: lo / total > 0.005, hi: hi / total > 0.005 });
      } catch { /* canvas unreadable — skip histogram this frame */ }
    }, 120);
  }, [image, aspect, draw, loupe, loupePan, rotation, vpTick]);

  const loadFile = useCallback((file, saveToDb = true) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (saveToDb) {
      idbSave('pe-current-image', file).catch(console.error);
    }
    // Keep the original basename so exports are traceable to their source
    setSourceName((file.name || 'photo').replace(/\.[^.]+$/, ''));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setAdj({ ...DEFAULT_ADJ });
      setPreset('None');
      setAspect('original');
      setRotation(0);
      setStraighten(0);
      setFlipH(false);
      setLoupe(false);
      setLoupePan({ x: 0, y: 0 });
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setTexts([]);
      setSelectedTextId(null);
      setStickers([]);
      setSelectedStickerId(null);
      setDrawings([]);
      setIsDrawingMode(false);
      // Masks belong to the previous photo — never carry them across loads
      setMasks([]);
      setActiveMaskId(null);
      setIsMaskingMode(false);
      // Initialize history
      const initial = { adj: { ...DEFAULT_ADJ }, aspect: 'original', rotation: 0, straighten: 0, flipH: false, zoom: 1, pan: { x: 0, y: 0 }, texts: [], stickers: [], drawings: [], masks: [] };
      setHistory([initial]);
      setHistoryIndex(0);
      localStorage.setItem('pe-current-state', JSON.stringify(initial));
    };
    img.src = url;
  }, []);

  const onPointerDown = (e) => {
    if (!image) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    if (isPickingWB && previewRef.current) {
      const ctx = previewRef.current.getContext('2d');
      const px = Math.floor(nx * previewRef.current.width);
      const py = Math.floor(ny * previewRef.current.height);
      const pixel = ctx.getImageData(px, py, 1, 1).data;
      
      const r = pixel[0];
      const g = pixel[1];
      const b = pixel[2];
      
      let newWarmth = adj.warmth + (b - r) * 0.7;
      let newTint = adj.tint + (g - (r + b) / 2) * 1.5;
      
      newWarmth = Math.max(-100, Math.min(100, Math.round(newWarmth)));
      newTint = Math.max(-100, Math.min(100, Math.round(newTint)));
      
      setAdj(prev => ({ ...prev, warmth: newWarmth, tint: newTint }));
      setIsPickingWB(false);
      scheduleHistorySave();
      return;
    }

    if (isPatchMode) {
      if (!patchSource) {
        setPatchSource({ x: nx, y: ny });
        return;
      }
      dragRef.current = { type: 'patch', currentStroke: { source: patchSource, size: patchBrushSize, path: [{x: nx, y: ny}] } };
      setPatches(p => [...p, dragRef.current.currentStroke]);
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      return;
    }

    if (isDrawingMode) {
      dragRef.current = { type: 'draw', currentStroke: { color: brushColor, size: brushSize, points: [{nx, ny}] } };
      setDrawings(d => [...d, dragRef.current.currentStroke]);
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      return;
    }

    if (isMaskingMode && activeMaskId) {
      dragRef.current = { type: 'mask', currentStroke: { size: maskBrushSize, points: [{nx, ny}] } };
      setMasks(m => m.map(mask => mask.id === activeMaskId ? { ...mask, paths: [...(mask.paths || []), dragRef.current.currentStroke] } : mask));
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      return;
    }

    // Hit test texts & stickers (top to bottom)
    for (let i = textBounds.current.length - 1; i >= 0; i--) {
      const b = textBounds.current[i];
      if (nx >= b.nx1 && nx <= b.nx2 && ny >= b.ny1 && ny <= b.ny2) {
        if (b.type === 'sticker') {
          setSelectedStickerId(b.id);
          setSelectedTextId(null);
          const s = stickers.find(x => x.id === b.id);
          dragRef.current = { type: 'sticker', id: s.id, startNX: nx, startNY: ny, initialNX: s.nx, initialNY: s.ny };
        } else {
          setSelectedTextId(b.id);
          setSelectedStickerId(null);
          const t = texts.find(x => x.id === b.id);
          dragRef.current = { type: 'text', id: t.id, startNX: nx, startNY: ny, initialNX: t.nx, initialNY: t.ny };
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);
        return;
      }
    }

    setSelectedTextId(null);
    setSelectedStickerId(null);
    dragRef.current = loupe
      ? { type: 'loupe', startX: e.clientX, startY: e.clientY, pan: { ...loupePan } }
      : { type: 'pan', startX: e.clientX, startY: e.clientY, pan: { ...pan } };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    if (d.type === 'patch') {
      d.currentStroke.path.push({x: nx, y: ny});
      setPatches(arr => [...arr]);
    } else if (d.type === 'draw') {
      d.currentStroke.points.push({nx, ny});
      // Force re-render to show drawing live
      setDrawings(arr => [...arr]);
    } else if (d.type === 'mask') {
      d.currentStroke.points.push({nx, ny});
      // Force re-render to show mask live
      setMasks(arr => [...arr]);
    } else if (d.type === 'text') {
      const dx = nx - d.startNX;
      const dy = ny - d.startNY;
      setTexts(ts => ts.map(t => t.id === d.id ? { ...t, nx: d.initialNX + dx, ny: d.initialNY + dy } : t));
    } else if (d.type === 'sticker') {
      const dx = nx - d.startNX;
      const dy = ny - d.startNY;
      setStickers(ts => ts.map(t => t.id === d.id ? { ...t, nx: d.initialNX + dx, ny: d.initialNY + dy } : t));
    } else if (d.type === 'loupe') {
      const dx = (e.clientX - d.startX) / previewSize.current.w;
      const dy = (e.clientY - d.startY) / previewSize.current.h;
      setLoupePan({ x: d.pan.x + dx, y: d.pan.y + dy });
    } else {
      const dx = (e.clientX - d.startX) / previewSize.current.w;
      const dy = (e.clientY - d.startY) / previewSize.current.h;
      setPan({ x: d.pan.x + dx, y: d.pan.y + dy });
    }
  };
  const onPointerUp = () => {
    const wasLoupe = dragRef.current?.type === 'loupe';
    dragRef.current = null;
    setIsDragging(false);
    if (!wasLoupe) scheduleHistorySave(); // loupe panning is view-only, not an edit
  };

  const currentAdj = (isMaskingMode && activeMaskId) 
    ? (masks.find(m => m.id === activeMaskId)?.adj || adj) 
    : adj;

  const applyPreset = (p) => { setPreset(p.id); setAdj({ ...p.adj }); scheduleHistorySave(); };
  
  const setAdjKey = (key, value) => { 
    if (isMaskingMode && activeMaskId) {
      setMaskAdj(key, value);
    } else {
      setAdj((a) => ({ ...a, [key]: value })); 
      setPreset('custom'); 
      scheduleHistorySave(); 
    }
  };

  // Lightroom-style readout: sliders whose neutral is 100 read as ± offsets
  const fmtAdj = (key) => {
    const v = currentAdj[key];
    const shown = DEFAULT_ADJ[key] === 100 ? v - 100 : v;
    return shown > 0 ? `+${shown}` : String(shown);
  };
  
  const saveCustomPreset = () => {
    const name = prompt('Name your preset:', `Custom ${customPresets.length + 1}`);
    if (!name) return;
    const newPreset = { id: name, adj: { ...adj } };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    localStorage.setItem('pe-custom-presets', JSON.stringify(updated));
    setPreset(name);
  };

  const resetAll = () => {
    setAdj({ ...DEFAULT_ADJ });
    setPreset('None');
    setRotation(0);
    setStraighten(0);
    setFlipH(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setTexts([]);
    setSelectedTextId(null);
    setStickers([]);
    setSelectedStickerId(null);
    setDrawings([]);
    setIsDrawingMode(false);
    setIsPickingWB(false);
    scheduleHistorySave();
  };

  const handleAddText = () => {
    const newText = {
      id: Date.now().toString(),
      text: 'Double Tap to Edit',
      nx: 0.5, ny: 0.5,
      fontFamily: 'Inter',
      fontSize: 0.08,
      color: '#ffffff',
      bgColor: 'transparent',
      borderRadius: 0,
      padding: 0.02
    };
    setTexts(ts => [...ts, newText]);
    setSelectedTextId(newText.id);
    setSelectedStickerId(null);
    setIsDrawingMode(false);
    scheduleHistorySave();
  };

  const handleAddSticker = (emoji) => {
    const newSticker = {
      id: Date.now().toString(),
      emoji,
      nx: 0.5, ny: 0.5,
      size: 0.15
    };
    setStickers(ts => [...ts, newSticker]);
    setSelectedStickerId(newSticker.id);
    setSelectedTextId(null);
    setIsDrawingMode(false);
    scheduleHistorySave();
  };

  const handleExport = () => {
    if (!image) return;
    const { w, h } = getOutputSize(image, aspect);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    draw(ctx, w, h, true);
    
    const mimeType = exportFormat === 'png' ? 'image/png' : 'image/jpeg';
    const quality = exportFormat === 'png' ? undefined : exportQuality / 100;
    const ext = exportFormat === 'png' ? 'png' : 'jpg';

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sourceName}_edited.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, mimeType, quality);
  };

  const getCursor = () => {
    if (isPickingWB) return `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>') 2 22, crosshair`;
    
    if (isMaskingMode || isPatchMode) {
      const bSize = isPatchMode ? patchBrushSize : maskBrushSize;
      const bColor = isPatchMode ? "rgba(255,255,255,0.1)" : "rgba(255,0,0,0.2)";
      const d = Math.max(10, Math.round(bSize * (previewSize.current?.h || 500)));
      const r = d / 2;
      const dash = (isPatchMode && !patchSource) ? '4 2' : 'none';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}" viewBox="0 0 ${d} ${d}"><circle cx="${r}" cy="${r}" r="${r - 1}" fill="${bColor}" stroke="white" stroke-width="1.5" stroke-dasharray="${dash}" /></svg>`;
      return `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') ${r} ${r}, crosshair`;
    }
    if (isDrawingMode) return 'crosshair';
    return isDragging ? 'grabbing' : 'grab';
  };

  return (
    <motion.div
      className="pe-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className="pe-header">
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            ← Back to Home
          </Link>
        </div>
        <h1 className="pe-title">Photo Editor</h1>
        <p className="pe-sub">Quick edits for social — crop, adjust, and download. Everything stays in your browser.</p>
      </header>

      <div className="pe-workspace">
        <div className="pe-stage">
          {!image ? (
            <div
              className="pe-drop"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('is-over'); }}
              onDragLeave={(e) => e.currentTarget.classList.remove('is-over')}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('is-over'); loadFile(e.dataTransfer.files[0]); }}
            >
              <Upload size={40} />
              <p className="pe-drop-title">Drop a photo here or click to upload</p>
              <p className="pe-drop-hint">JPG or PNG</p>
            </div>
          ) : (
            <>
              <div className="pe-canvas-wrapper" style={{ position: 'relative' }}>
                {isProcessingAI && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 10, borderRadius: '8px', backdropFilter: 'blur(4px)' }}>
                    <Loader2 className="pe-spin" size={36} style={{ marginBottom: '1rem', color: '#a855f7' }} />
                    <span style={{ fontSize: '1rem', fontWeight: 600 }}>Running AI Model...</span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.4rem', textAlign: 'center', maxWidth: '80%' }}>This runs locally in your browser. It may take a moment on the first run as it downloads the ML model.</span>
                  </div>
                )}
                <canvas
                  ref={previewRef}
                  className="pe-canvas"
                  style={{ cursor: getCursor() }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                />
                {isDragging && (
                  <div className="pe-grid-overlay">
                    <div className="pe-grid-line h-1"></div>
                    <div className="pe-grid-line h-2"></div>
                    <div className="pe-grid-line v-1"></div>
                    <div className="pe-grid-line v-2"></div>
                  </div>
                )}
              </div>
              
              <div className="pe-stage-toolbar">
                <button 
                  className={`pe-btn-icon ${historyIndex <= 0 ? 'is-disabled' : ''}`} 
                  onClick={handleUndo} title="Undo"
                >
                  <Undo size={18} />
                </button>
                <button 
                  className={`pe-btn-icon ${historyIndex >= history.length - 1 ? 'is-disabled' : ''}`} 
                  onClick={handleRedo} title="Redo"
                >
                  <Redo size={18} />
                </button>
                <div className="pe-spacer" />
                <button
                  className={`pe-btn-icon pe-loupe-btn ${loupe ? 'is-active' : ''}`}
                  onClick={() => { setLoupe(l => !l); setLoupePan({ x: 0, y: 0 }); }}
                  title="View at 100% (1:1 pixels) — inspection only, does not change the crop"
                >
                  <span className="pe-loupe-label">1:1</span>
                </button>
                <button
                  className="pe-btn-icon pe-compare-btn"
                  onPointerDown={() => setIsComparing(true)}
                  onPointerUp={() => setIsComparing(false)}
                  onPointerLeave={() => setIsComparing(false)}
                  title="Hold to Compare (or hold Space)"
                >
                  <Eye size={18} />
                </button>
              </div>
              <div className="pe-histogram-wrap" title="Luminance histogram">
                <span className={`pe-clip-dot ${clipping.lo ? 'is-on' : ''}`} title="Shadow clipping">◢</span>
                <canvas ref={histRef} width={220} height={44} className="pe-histogram" />
                <span className={`pe-clip-dot ${clipping.hi ? 'is-on' : ''}`} title="Highlight clipping">◣</span>
              </div>
              <p className="pe-stage-hint">{loupe ? '1:1 view — drag to inspect · click 1:1 to exit' : 'Drag to reposition · Use Zoom to fill'}</p>
            </>
          )}
        </div>

        <div className="pe-controls" style={{ opacity: !image ? 0.5 : 1, pointerEvents: !image ? 'none' : 'auto' }}>
          <div className="pe-panels" style={{ flex: 1, overflowY: 'auto' }}>
          
          <div className="pe-group" style={{ display: (!isMobile || activeTab === 'patch') ? 'block' : 'none', background: isPatchMode ? 'rgba(59, 130, 246, 0.1)' : 'transparent', padding: isPatchMode ? '1rem' : '0', borderRadius: '12px', border: isPatchMode ? '1px solid rgba(59, 130, 246, 0.3)' : 'none', transition: 'all 0.3s' }}>
            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, patch: !s.patch }))}>
              <span className="pe-group-label" style={{ color: isPatchMode ? '#3b82f6' : 'var(--text-secondary)' }}>Retouch / Patch</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button className={`pe-btn pe-btn-ghost ${isPatchMode ? 'is-active' : ''}`} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderColor: isPatchMode ? '#3b82f6' : 'transparent', color: isPatchMode ? '#3b82f6' : 'var(--text-primary)' }} onClick={(e) => { e.stopPropagation(); setIsPatchMode(!isPatchMode); setOpenSections(s => ({ ...s, patch: true })); setActiveTab('patch'); }}>
                  {isPatchMode ? 'Done' : 'Patch'}
                </button>
                <ChevronDown size={16} className={`pe-section-chevron ${isSectionOpen('patch') ? 'is-open' : ''}`} />
              </div>
            </div>
            <div className={`pe-section-body ${isSectionOpen('patch') ? '' : 'is-collapsed'}`} style={{ maxHeight: isSectionOpen('patch') ? '400px' : '0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.8rem' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  1. Set Source (Tap image or button below)<br/>
                  2. Paint over blemish
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className={`pe-chip ${!patchSource ? 'is-active' : ''}`} onClick={() => setPatchSource(null)}>
                    <Crosshair size={14}/> Set Source
                  </button>
                  <button className={`pe-chip ${patchSource ? 'is-active' : ''}`} disabled={!patchSource}>
                    <Brush size={14}/> Paint
                  </button>
                  <button className="pe-chip" onClick={() => { setPatches([]); setPatchSource(null); scheduleHistorySave(); }}>
                    Clear
                  </button>
                </div>
                <label className="pe-slider-row">
                  <span>Size</span>
                  <input type="range" min="0.01" max="0.2" step="0.01" value={patchBrushSize} onChange={(e) => setPatchBrushSize(parseFloat(e.target.value))} />
                </label>
              </div>
            </div>
          </div>

          <div className="pe-group" style={{ background: isMaskingMode ? 'rgba(236, 72, 153, 0.1)' : 'transparent', padding: isMaskingMode ? '1rem' : '0', borderRadius: '12px', border: isMaskingMode ? '1px solid rgba(236, 72, 153, 0.3)' : 'none', transition: 'all 0.3s', display: (!isMobile || activeTab === 'masks') ? 'block' : 'none' }}>
            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, masks: !s.masks }))}>
              <span className="pe-group-label" style={{ color: isMaskingMode ? '#ec4899' : 'var(--text-secondary)' }}>Brush Masks</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button className={`pe-btn pe-btn-ghost ${isMaskingMode ? 'is-active' : ''}`} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderColor: isMaskingMode ? '#ec4899' : 'transparent', color: isMaskingMode ? '#ec4899' : 'var(--text-primary)' }} onClick={(e) => { e.stopPropagation(); if (activeMaskId) { toggleMaskingMode(activeMaskId); } else { addMask(); } setOpenSections(s => ({ ...s, masks: true })); setActiveTab('masks'); }}>
                  {isMaskingMode ? 'Done' : 'Mask'}
                </button>
                <ChevronDown size={16} className={`pe-section-chevron ${isSectionOpen('masks') ? 'is-open' : ''}`} />
              </div>
            </div>
            <div className={`pe-section-body ${isSectionOpen('masks') ? '' : 'is-collapsed'}`} style={{ maxHeight: isSectionOpen('masks') ? '800px' : '0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.8rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {masks.map(m => (
                    <button key={m.id} className={`pe-chip ${activeMaskId === m.id ? 'is-active' : ''}`} onClick={() => toggleMaskingMode(m.id)}>
                      {m.id}
                    </button>
                  ))}
                  <button className="pe-chip" onClick={addMask} style={{ borderStyle: 'dashed' }}>+ Brush Mask</button>
                  <button className="pe-chip" onClick={() => generateAIMask('subject')} disabled={isProcessingAI} style={{ borderStyle: 'solid', color: '#e879f9', borderColor: '#e879f9', background: 'rgba(232, 121, 249, 0.1)', opacity: isProcessingAI ? 0.5 : 1 }}>
                    <Wand2 size={12} style={{ display: 'inline', marginRight: '4px' }} /> Select Subject
                  </button>
                  <button className="pe-chip" onClick={() => generateAIMask('background')} disabled={isProcessingAI} style={{ borderStyle: 'solid', color: '#60a5fa', borderColor: '#60a5fa', background: 'rgba(96, 165, 250, 0.1)', opacity: isProcessingAI ? 0.5 : 1 }}>
                    <Wand2 size={12} style={{ display: 'inline', marginRight: '4px' }} /> Select Background
                  </button>
                </div>
                
                {activeMaskId && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.5rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{activeMaskId} Settings</span>
                      <button onClick={(e) => deleteMask(activeMaskId, e)} className="pe-btn pe-btn-delete" style={{ padding: '0.3rem', height: 'auto' }}><Trash2 size={14} /></button>
                    </div>
                    
                    <label className="pe-slider-row">
                      <span>Brush Size</span>
                      <input type="range" min="0.01" max="0.3" step="0.01" value={maskBrushSize} onChange={e => setMaskBrushSize(parseFloat(e.target.value))} />
                    </label>
                    <label className="pe-color-label" style={{ flexDirection: 'row', gap: '0.5rem', justifyContent: 'flex-start' }}>
                      <input type="checkbox" checked={showMaskOverlay} onChange={e => setShowMaskOverlay(e.target.checked)} />
                      Show Red Overlay
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="pe-group">
            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, presets: !s.presets }))}>
              <span className="pe-group-label">Presets</span>
              <ChevronDown size={16} className={`pe-section-chevron ${isSectionOpen('presets') ? 'is-open' : ''}`} />
            </div>
            <div className={`pe-section-body ${isSectionOpen('presets') ? '' : 'is-collapsed'}`} style={{ maxHeight: isSectionOpen('presets') ? '640px' : '0' }}>
            {PRESET_GROUPS.map((groupName) => (
              <div key={groupName} className="pe-preset-group">
                <span className="pe-preset-group-label">{groupName}</span>
                <div className="pe-chips">
                  {PRESETS.filter((p) => p.group === groupName).map((p) => (
                    <button
                      key={p.id}
                      className={`pe-chip ${preset === p.id ? 'is-active' : ''}`}
                      onClick={() => applyPreset(p)}
                    >
                      {p.id}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {customPresets.length > 0 && (
              <div className="pe-preset-group">
                <span className="pe-preset-group-label">My Presets</span>
                <div className="pe-chips">
                  {customPresets.map((p) => (
                    <button
                      key={p.id}
                      className={`pe-chip ${preset === p.id ? 'is-active' : ''}`}
                      onClick={() => applyPreset(p)}
                    >
                      {p.id}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>

          <div className="pe-group">
            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, crop: !s.crop }))}>
              <span className="pe-group-label">Crop</span>
              <ChevronDown size={16} className={`pe-section-chevron ${isSectionOpen('crop') ? 'is-open' : ''}`} />
            </div>
            <div className={`pe-section-body ${isSectionOpen('crop') ? '' : 'is-collapsed'}`} style={{ maxHeight: isSectionOpen('crop') ? '300px' : '0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div className="pe-chips">
                  {ASPECTS.map((a) => (
                    <button
                      key={a.id}
                      className={`pe-chip ${aspect === a.id ? 'is-active' : ''}`}
                      onClick={() => { setAspect(a.id); scheduleHistorySave(); }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <label className="pe-slider-row pe-slider-row-valued">
                  <span>Zoom</span>
                  <input type="range" min="1" max="3" step="0.01" value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    onDoubleClick={() => { setZoom(1); scheduleHistorySave(); }}
                    onPointerUp={scheduleHistorySave} />
                  <span className="pe-slider-value">{zoom.toFixed(2)}×</span>
                </label>
                <label className="pe-slider-row pe-slider-row-valued" title="Double-click to reset">
                  <span>Straighten</span>
                  <input type="range" min="-15" max="15" step="0.1" value={straighten}
                    onChange={(e) => setStraighten(parseFloat(e.target.value))}
                    onDoubleClick={() => { setStraighten(0); scheduleHistorySave(); }}
                    onPointerUp={scheduleHistorySave} />
                  <span className="pe-slider-value" onDoubleClick={() => { setStraighten(0); scheduleHistorySave(); }}>{straighten > 0 ? `+${straighten.toFixed(1)}°` : `${straighten.toFixed(1)}°`}</span>
                </label>
                <div className="pe-chips">
                  <button className="pe-chip" onClick={() => { setRotation((r) => (r + 90) % 360); scheduleHistorySave(); }}>
                    <RotateCw size={15} /> Rotate
                  </button>
                  <button className={`pe-chip ${flipH ? 'is-active' : ''}`} onClick={() => { setFlipH((f) => !f); scheduleHistorySave(); }}>
                    Flip
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* White Balance Group (Lightroom Style) */}
          <div className="pe-group" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: (!isMobile || activeTab === 'wb') ? 'block' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button 
                  className={`pe-btn ${isPickingWB ? 'is-active' : 'pe-btn-ghost'}`} 
                  style={{ 
                    padding: '0.4rem', 
                    borderRadius: '50%',
                    backgroundColor: isPickingWB ? '#3b82f6' : 'rgba(255,255,255,0.08)',
                    color: isPickingWB ? '#fff' : 'var(--text-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.1)'
                  }}
                  onClick={() => setIsPickingWB(!isPickingWB)}
                  title="White Balance Selector (W)"
                >
                  <Crosshair size={18} />
                </button>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>WB :</span>
              </div>
              
              <select 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                value={currentAdj.warmth === 0 && currentAdj.tint === 0 ? 'as-shot' : 'custom'}
                onChange={(e) => { if (e.target.value === 'as-shot') { setAdjKey('warmth', 0); setAdjKey('tint', 0); } }}
              >
                <option value="as-shot" style={{ color: '#000' }}>As Shot</option>
                <option value="custom" style={{ color: '#000' }}>Custom</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label className="pe-wb-row">
                <span style={{ color: 'var(--text-secondary)' }}>Temp</span>
                <input
                  type="range" min="-100" max="100"
                  value={currentAdj.warmth}
                  onChange={(e) => setAdjKey('warmth', parseInt(e.target.value, 10))}
                  onDoubleClick={() => setAdjKey('warmth', DEFAULT_ADJ.warmth)}
                  className="pe-wb-slider pe-wb-temp"
                />
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{adj.warmth > 0 ? `+${adj.warmth}` : adj.warmth}</span>
              </label>
              
              <label className="pe-wb-row">
                <span style={{ color: 'var(--text-secondary)' }}>Tint</span>
                <input
                  type="range" min="-100" max="100"
                  value={currentAdj.tint}
                  onChange={(e) => setAdjKey('tint', parseInt(e.target.value, 10))}
                  onDoubleClick={() => setAdjKey('tint', DEFAULT_ADJ.tint)}
                  className="pe-wb-slider pe-wb-tint"
                />
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{adj.tint > 0 ? `+${adj.tint}` : adj.tint}</span>
              </label>
            </div>
          </div>

          <div className="pe-group">
            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, adjust: !s.adjust }))}>
              <span className="pe-group-label">Adjust</span>
              <ChevronDown size={16} className={`pe-section-chevron ${isSectionOpen('adjust') ? 'is-open' : ''}`} />
            </div>
            <div className={`pe-section-body ${isSectionOpen('adjust') ? '' : 'is-collapsed'}`} style={{ maxHeight: isSectionOpen('adjust') ? '600px' : '0' }}>
            {SLIDERS.map((s) => (
              <label key={s.key} className="pe-slider-row pe-slider-row-valued" title="Double-click to reset">
                <span>{s.label}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  value={currentAdj[s.key]}
                  onChange={(e) => setAdjKey(s.key, parseInt(e.target.value, 10))}
                  onDoubleClick={() => setAdjKey(s.key, DEFAULT_ADJ[s.key])}
                />
                <span className="pe-slider-value" onDoubleClick={() => setAdjKey(s.key, DEFAULT_ADJ[s.key])}>{fmtAdj(s.key)}</span>
              </label>
            ))}
            </div>
          </div>

          <div className="pe-group">
            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, effects: !s.effects }))}>
              <span className="pe-group-label">Creative Effects</span>
              <ChevronDown size={16} className={`pe-section-chevron ${isSectionOpen('effects') ? 'is-open' : ''}`} />
            </div>
            <div className={`pe-section-body ${isSectionOpen('effects') ? '' : 'is-collapsed'}`} style={{ maxHeight: isSectionOpen('effects') ? '400px' : '0' }}>
            {EFFECT_SLIDERS.map((s) => (
              <label key={s.key} className="pe-slider-row pe-slider-row-valued" title="Double-click to reset">
                <span>{s.label}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  value={currentAdj[s.key]}
                  onChange={(e) => setAdjKey(s.key, parseInt(e.target.value, 10))}
                  onDoubleClick={() => setAdjKey(s.key, DEFAULT_ADJ[s.key])}
                />
                <span className="pe-slider-value" onDoubleClick={() => setAdjKey(s.key, DEFAULT_ADJ[s.key])}>{fmtAdj(s.key)}</span>
              </label>
            ))}
            </div>
          </div>

          <div className="pe-group">
            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, splitTone: !s.splitTone }))}>
              <span className="pe-group-label">Split Toning</span>
              <ChevronDown size={16} className={`pe-section-chevron ${isSectionOpen('splitTone') ? 'is-open' : ''}`} />
            </div>
            <div className={`pe-section-body ${isSectionOpen('splitTone') ? '' : 'is-collapsed'}`} style={{ maxHeight: isSectionOpen('splitTone') ? '400px' : '0' }}>
            <label className="pe-slider-row">
              <span>Intensity</span>
              <input type="range" min="0" max="100" value={currentAdj.duotone} onChange={(e) => setAdjKey('duotone', parseInt(e.target.value, 10))} onDoubleClick={() => setAdjKey('duotone', DEFAULT_ADJ.duotone)} />
            </label>
            {adj.duotone > 0 && (
              <div className="pe-color-row" style={{ marginTop: '0.5rem', justifyContent: 'center', gap: '2rem' }}>
                <label className="pe-color-label" title="Shadow Color">
                  <div className="pe-color-swatch-wrapper">
                    <input type="color" value={currentAdj.duotoneC1} onChange={(e) => setAdjKey('duotoneC1', e.target.value)} />
                  </div>
                  Shadows
                </label>
                <label className="pe-color-label" title="Highlight Color">
                  <div className="pe-color-swatch-wrapper">
                    <input type="color" value={currentAdj.duotoneC2} onChange={(e) => setAdjKey('duotoneC2', e.target.value)} />
                  </div>
                  Highlights
                </label>
              </div>
            )}
            </div>
          </div>

          <div className="pe-group">
            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, frames: !s.frames }))}>
              <span className="pe-group-label">Frames</span>
              <ChevronDown size={16} className={`pe-section-chevron ${isSectionOpen('frames') ? 'is-open' : ''}`} />
            </div>
            <div className={`pe-section-body ${isSectionOpen('frames') ? '' : 'is-collapsed'}`} style={{ maxHeight: isSectionOpen('frames') ? '200px' : '0' }}>
            <div className="pe-chips">
              {['none', 'thin-white', 'thin-black', 'polaroid', 'film'].map((f) => (
                <button
                  key={f}
                  className={`pe-chip ${adj.frame === f ? 'is-active' : ''}`}
                  onClick={() => setAdjKey('frame', f)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {f.replace('-', ' ')}
                </button>
              ))}
            </div>
            </div>
          </div>

          <div className="pe-group">
            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, text: !s.text }))}>
              <span className="pe-group-label">Text</span>
              <ChevronDown size={16} className={`pe-section-chevron ${isSectionOpen('text') ? 'is-open' : ''}`} />
            </div>
            <div className={`pe-section-body ${isSectionOpen('text') ? '' : 'is-collapsed'}`} style={{ maxHeight: isSectionOpen('text') ? '600px' : '0' }}>
            <button 
              onClick={handleAddText}
              style={{ 
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: '10px',
                border: '1px dashed rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontFamily: 'var(--font-sans)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <Type size={16} /> Add Text Layer
            </button>
            
            {selectedTextId && texts.find(t => t.id === selectedTextId) && (() => {
              const t = texts.find(t => t.id === selectedTextId);
              const updateT = (changes) => {
                setTexts(ts => ts.map(txt => txt.id === t.id ? { ...txt, ...changes } : txt));
                scheduleHistorySave();
              };
              return (
                <div className="pe-text-editor">
                  <input 
                    type="text" 
                    value={t.text} 
                    onChange={e => updateT({ text: e.target.value })} 
                    className="pe-text-input" 
                    placeholder="Enter text..."
                  />
                  
                  <div className="pe-text-controls-grid">
                    <select value={t.fontFamily} onChange={e => updateT({ fontFamily: e.target.value })} className="pe-select">
                      {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <label className="pe-color-label" title="Text Color">
                      <div className="pe-color-swatch-wrapper">
                        <input type="color" value={t.color} onChange={e => updateT({ color: e.target.value })} />
                      </div>
                      Text
                    </label>
                    <label className="pe-color-label" title="Background Color">
                      <div className="pe-color-swatch-wrapper" style={{ opacity: t.bgColor === 'transparent' ? 0.3 : 1 }}>
                        <input type="color" value={t.bgColor === 'transparent' ? '#000000' : t.bgColor} onChange={e => updateT({ bgColor: e.target.value })} disabled={t.bgColor === 'transparent'} />
                      </div>
                      Bg
                    </label>
                  </div>

                  <label className="pe-slider-row">
                    <span>Size</span>
                    <input type="range" min="0.02" max="0.3" step="0.01" value={t.fontSize} onChange={e => updateT({ fontSize: parseFloat(e.target.value) })} />
                  </label>
                  <label className="pe-slider-row">
                    <span>Radius</span>
                    <input type="range" min="0" max="0.1" step="0.01" value={t.borderRadius} onChange={e => updateT({ borderRadius: parseFloat(e.target.value) })} />
                  </label>
                  
                  <label className="pe-checkbox-label">
                    <input type="checkbox" checked={t.bgColor === 'transparent'} onChange={e => updateT({ bgColor: e.target.checked ? 'transparent' : '#000000' })} /> 
                    Transparent Background
                  </label>

                  <button onClick={() => { setTexts(ts => ts.filter(txt => txt.id !== t.id)); setSelectedTextId(null); scheduleHistorySave(); }} className="pe-btn pe-btn-delete">
                    Delete Layer
                  </button>
                </div>
              );
            })()}
            </div>
          </div>

          <div className="pe-group">
            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, stickers: !s.stickers }))}>
              <span className="pe-group-label">Stickers</span>
              <ChevronDown size={16} className={`pe-section-chevron ${isSectionOpen('stickers') ? 'is-open' : ''}`} />
            </div>
            <div className={`pe-section-body ${isSectionOpen('stickers') ? '' : 'is-collapsed'}`} style={{ maxHeight: isSectionOpen('stickers') ? '400px' : '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="pe-chips">
                {['✨', '🔥', '❤️', '📸', '🎬'].map(emoji => (
                  <button key={emoji} className="pe-btn pe-btn-ghost" style={{ padding: '0.2rem 0.4rem', fontSize: '1rem' }} onClick={() => handleAddSticker(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            {selectedStickerId && stickers.find(t => t.id === selectedStickerId) && (() => {
              const s = stickers.find(t => t.id === selectedStickerId);
              return (
                <div className="pe-text-editor">
                  <label className="pe-slider-row">
                    <span>Size</span>
                    <input type="range" min="0.05" max="0.8" step="0.01" value={s.size} onChange={e => {
                      setStickers(ts => ts.map(txt => txt.id === s.id ? { ...txt, size: parseFloat(e.target.value) } : txt));
                      scheduleHistorySave();
                    }} />
                  </label>
                  <button onClick={() => { setStickers(ts => ts.filter(txt => txt.id !== s.id)); setSelectedStickerId(null); scheduleHistorySave(); }} className="pe-btn pe-btn-delete">
                    Delete Sticker
                  </button>
                </div>
              );
            })()}
            </div>
          </div>


          <div className="pe-group" style={{ background: isDrawingMode ? 'rgba(59, 130, 246, 0.1)' : 'transparent', padding: isDrawingMode ? '1rem' : '0', borderRadius: '12px', border: isDrawingMode ? '1px solid rgba(59, 130, 246, 0.3)' : 'none', transition: 'all 0.3s' }}>
            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, draw: !s.draw }))}>
              <span className="pe-group-label" style={{ color: isDrawingMode ? '#3b82f6' : 'var(--text-secondary)' }}>Freehand Draw</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button className={`pe-btn pe-btn-ghost ${isDrawingMode ? 'is-active' : ''}`} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderColor: isDrawingMode ? '#3b82f6' : 'transparent', color: isDrawingMode ? '#3b82f6' : 'var(--text-primary)' }} onClick={(e) => { e.stopPropagation(); setIsDrawingMode(!isDrawingMode); setOpenSections(s => ({ ...s, draw: true })); setActiveTab('draw'); }}>
                  {isDrawingMode ? 'Done' : 'Draw'}
                </button>
                <ChevronDown size={16} className={`pe-section-chevron ${isSectionOpen('draw') ? 'is-open' : ''}`} />
              </div>
            </div>
            <div className={`pe-section-body ${isSectionOpen('draw') ? '' : 'is-collapsed'}`} style={{ maxHeight: isSectionOpen('draw') ? '300px' : '0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '0.8rem' }}>
                <label className="pe-color-label" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  Brush Color
                  <div className="pe-color-swatch-wrapper">
                    <input type="color" value={brushColor} onChange={e => setBrushColor(e.target.value)} />
                  </div>
                </label>
                <label className="pe-slider-row">
                  <span>Size</span>
                  <input type="range" min="0.005" max="0.1" step="0.001" value={brushSize} onChange={e => setBrushSize(parseFloat(e.target.value))} />
                </label>
                <button onClick={() => { setDrawings([]); scheduleHistorySave(); }} className="pe-btn pe-btn-delete" style={{ padding: '0.4rem', fontSize: '0.75rem' }}>
                  Clear All Drawings
                </button>
              </div>
            </div>
          </div>

          <div className="pe-actions" style={{ marginTop: '1rem' }}>
            <button className="pe-btn pe-btn-ghost" onClick={saveCustomPreset} title="Save current settings as a new preset">
              <Save size={16} /> Save Preset
            </button>
          </div>

          <div className="pe-group" style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, export: !s.export }))}>
              <span className="pe-group-label">Export Settings</span>
              <ChevronDown size={16} className={`pe-section-chevron ${isSectionOpen('export') ? 'is-open' : ''}`} />
            </div>
            <div className={`pe-section-body ${isSectionOpen('export') ? '' : 'is-collapsed'}`} style={{ maxHeight: isSectionOpen('export') ? '300px' : '0' }}>
            <div className="pe-chips" style={{ marginBottom: '1rem' }}>
              <button className={`pe-chip ${exportFormat === 'jpeg' ? 'is-active' : ''}`} onClick={() => setExportFormat('jpeg')}>JPG</button>
              <button className={`pe-chip ${exportFormat === 'png' ? 'is-active' : ''}`} onClick={() => setExportFormat('png')}>PNG</button>
            </div>
            {exportFormat === 'jpeg' && (
              <label className="pe-slider-row">
                <span>Quality</span>
                <input type="range" min="50" max="100" value={exportQuality} onChange={(e) => setExportQuality(parseInt(e.target.value, 10))} />
                <span className="pe-slider-value">{exportQuality}</span>
              </label>
            )}
            {image && (
              <p className="pe-export-info">
                {(() => { const { w, h } = getOutputSize(image, aspect); return `Exports at ${w} × ${h}px`; })()}
                <br />
                Exports are re-rendered — camera &amp; location metadata (EXIF) are not included.
              </p>
            )}
            <div className="pe-actions" style={{ marginTop: '1rem' }}>
              <button className="pe-btn pe-btn-ghost" onClick={resetAll}>
                <RefreshCw size={16} /> Reset
              </button>
              <button className="pe-btn pe-btn-ghost" onClick={() => fileRef.current?.click()} style={{ pointerEvents: 'auto' }}>
                <Upload size={16} /> New
              </button>
              <button className="pe-btn pe-btn-primary" onClick={handleExport}>
                <Download size={16} /> Download
              </button>
            </div>
            </div>
          </div>
        
          </div>
          {isMobile && (
            <div className="pe-tab-bar">
              <button className={`pe-tab-btn ${activeTab === 'presets' ? 'is-active' : ''}`} onClick={() => setActiveTab('presets')}><LayoutTemplate size={20} /><span>Presets</span></button>
              <button className={`pe-tab-btn ${activeTab === 'crop' ? 'is-active' : ''}`} onClick={() => setActiveTab('crop')}><Crop size={20} /><span>Crop</span></button>
              <button className={`pe-tab-btn ${activeTab === 'wb' ? 'is-active' : ''}`} onClick={() => setActiveTab('wb')}><Crosshair size={20} /><span>WB</span></button>
              <button className={`pe-tab-btn ${activeTab === 'adjust' ? 'is-active' : ''}`} onClick={() => setActiveTab('adjust')}><SlidersHorizontal size={20} /><span>Adjust</span></button>
              <button className={`pe-tab-btn ${activeTab === 'effects' ? 'is-active' : ''}`} onClick={() => setActiveTab('effects')}><Sparkles size={20} /><span>Effects</span></button>
              <button className={`pe-tab-btn ${activeTab === 'patch' ? 'is-active' : ''}`} onClick={() => setActiveTab('patch')}><Wand2 size={20} /><span>Patch</span></button>
              <button className={`pe-tab-btn ${activeTab === 'splitTone' ? 'is-active' : ''}`} onClick={() => setActiveTab('splitTone')}><Droplet size={20} /><span>Color</span></button>
              <button className={`pe-tab-btn ${activeTab === 'frames' ? 'is-active' : ''}`} onClick={() => setActiveTab('frames')}><Frame size={20} /><span>Frames</span></button>
              <button className={`pe-tab-btn ${activeTab === 'text' ? 'is-active' : ''}`} onClick={() => setActiveTab('text')}><Type size={20} /><span>Text</span></button>
              <button className={`pe-tab-btn ${activeTab === 'stickers' ? 'is-active' : ''}`} onClick={() => setActiveTab('stickers')}><Smile size={20} /><span>Stickers</span></button>
              <button className={`pe-tab-btn ${activeTab === 'draw' ? 'is-active' : ''}`} onClick={() => setActiveTab('draw')}><Brush size={20} /><span>Draw</span></button>
              <button className={`pe-tab-btn ${activeTab === 'masks' ? 'is-active' : ''}`} onClick={() => setActiveTab('masks')}><PenTool size={20} /><span>Masks</span></button>
              <button className={`pe-tab-btn ${activeTab === 'export' ? 'is-active' : ''}`} onClick={() => setActiveTab('export')}><Settings size={20} /><span>Export</span></button>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => loadFile(e.target.files[0])}
      />
    </motion.div>
  );
}
