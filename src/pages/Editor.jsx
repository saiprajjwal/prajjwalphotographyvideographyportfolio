import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, Download, RotateCw, RefreshCw, Undo, Redo, Save, Eye, Type, Crosshair } from 'lucide-react';
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

const ASPECTS = [
  { id: 'original', label: 'Original' },
  { id: '1:1', label: 'Square', w: 1080, h: 1080 },
  { id: '4:5', label: 'Portrait', w: 1080, h: 1350 },
  { id: '9:16', label: 'Story', w: 1080, h: 1920 },
  { id: '16:9', label: 'Wide', w: 1920, h: 1080 },
];

const DEFAULT_ADJ = { 
  brightness: 100, contrast: 100, saturation: 100, 
  warmth: 0, tint: 0, highlights: 0, shadows: 0, 
  vignette: 0, grain: 0, fade: 0, sharpen: 0, 
  duotone: 0, duotoneC1: '#000080', duotoneC2: '#ffcc00',
  frame: 'none',
  tiltShift: 0, graduated: 0, radial: 0, glitch: 0, halftone: 0
};

const PRESETS = [
  { id: 'None', adj: { ...DEFAULT_ADJ } },
  { id: 'Punch', adj: { ...DEFAULT_ADJ, contrast: 116, saturation: 122 } },
  { id: 'Warm', adj: { ...DEFAULT_ADJ, warmth: 45, brightness: 104 } },
  { id: 'Cool', adj: { ...DEFAULT_ADJ, warmth: -45 } },
  { id: 'Mono', adj: { ...DEFAULT_ADJ, saturation: 0, contrast: 112 } },
  { id: 'Film', adj: { ...DEFAULT_ADJ, contrast: 94, saturation: 88, warmth: 18, vignette: 28, grain: 15 } },
  { id: 'Vivid', adj: { ...DEFAULT_ADJ, saturation: 138, contrast: 108 } },
];

const SLIDERS = [
  { key: 'brightness', label: 'Brightness', min: 50, max: 150 },
  { key: 'contrast', label: 'Contrast', min: 50, max: 150 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 200 },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100 },
  { key: 'fade', label: 'Fade', min: 0, max: 100 },
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

function getOutputSize(image, aspect) {
  if (aspect === 'original') {
    const maxSide = 2000;
    let w = image.naturalWidth, h = image.naturalHeight;
    const m = Math.max(w, h);
    if (m > maxSide) { const k = maxSide / m; w = Math.round(w * k); h = Math.round(h * k); }
    return { w, h };
  }
  const a = ASPECTS.find((x) => x.id === aspect);
  return { w: a.w, h: a.h };
}

export default function Editor() {
  const [image, setImage] = useState(null);
  const [adj, setAdj] = useState({ ...DEFAULT_ADJ });
  const [preset, setPreset] = useState('None');
  const [aspect, setAspect] = useState('original');
  const [rotation, setRotation] = useState(0);
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

  const [exportFormat, setExportFormat] = useState('jpeg');
  const [exportQuality, setExportQuality] = useState(92);

  const [isComparing, setIsComparing] = useState(false);
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
  const textBounds = useRef([]); // Stores bounding boxes for text & stickers hit-testing

  // Debounced history saving
  const saveStateTimeout = useRef(null);
  const getCurrentState = useCallback(() => ({ 
    adj, aspect, rotation, flipH, zoom, pan, texts, stickers, drawings 
  }), [adj, aspect, rotation, flipH, zoom, pan, texts, stickers, drawings]);

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
    if (state.flipH !== undefined) setFlipH(state.flipH); 
    if (state.zoom !== undefined) setZoom(state.zoom); 
    if (state.pan) setPan(state.pan);
    if (state.texts) setTexts(state.texts);
    if (state.stickers) setStickers(state.stickers);
    if (state.drawings) setDrawings(state.drawings);
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
              const initial = { adj: { ...DEFAULT_ADJ }, aspect: 'original', rotation: 0, flipH: false, zoom: 1, pan: { x: 0, y: 0 }, texts: [], stickers: [], drawings: [] };
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

  // Draw the whole scene into a context at the given output size. Shared by the
  // live preview and the export so what you see is exactly what you download.
  const draw = useCallback((ctx, W, H, forExport = false) => {
    if (!image) return;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    
    if (!isComparing) {
      ctx.filter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%)`;
    }

    const rot = ((rotation % 360) + 360) % 360;
    const swap = rot === 90 || rot === 270;
    const fW = swap ? H : W;
    const fH = swap ? W : H;
    const scale = Math.max(fW / image.naturalWidth, fH / image.naturalHeight) * zoom;
    const dw = image.naturalWidth * scale;
    const dh = image.naturalHeight * scale;

    let px = pan.x * W;
    let py = pan.y * H;
    const maxPx = Math.max(0, (dw - fW) / 2);
    const maxPy = Math.max(0, (dh - fH) / 2);
    px = Math.max(-maxPx, Math.min(maxPx, px));
    py = Math.max(-maxPy, Math.min(maxPy, py));

    ctx.translate(W / 2 + px, H / 2 + py);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, 1);
    ctx.drawImage(image, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();

    if (isComparing) return;

    // Highlights & Shadows approximation via composite operations
    if (adj.shadows !== 0) {
      ctx.save();
      ctx.globalCompositeOperation = adj.shadows > 0 ? 'screen' : 'multiply';
      ctx.globalAlpha = Math.abs(adj.shadows) / 200; // max 50% opacity screen/multiply
      ctx.drawImage(ctx.canvas, 0, 0); // Self-blend
      ctx.restore();
    }
    
    if (adj.highlights !== 0) {
      ctx.save();
      ctx.globalCompositeOperation = adj.highlights > 0 ? 'color-dodge' : 'color-burn';
      ctx.globalAlpha = Math.abs(adj.highlights) / 200;
      ctx.drawImage(ctx.canvas, 0, 0); // Self-blend
      ctx.restore();
    }

    // Temperature (Warmth) and Tint
    if (adj.warmth !== 0 || adj.tint !== 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      if (adj.warmth !== 0) {
        ctx.globalAlpha = Math.min(Math.abs(adj.warmth) / 100, 1) * 0.6;
        ctx.fillStyle = adj.warmth > 0 ? '#ff8a1e' : '#1e7bff';
        ctx.fillRect(0, 0, W, H);
      }
      if (adj.tint !== 0) {
        ctx.globalAlpha = Math.min(Math.abs(adj.tint) / 100, 1) * 0.6;
        ctx.fillStyle = adj.tint > 0 ? '#ff00ff' : '#00ff00';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    }
    
    // Fade / Matte
    if (adj.fade > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighten';
      ctx.globalAlpha = (adj.fade / 100) * 0.8;
      ctx.fillStyle = '#404040';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
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

    // Tilt-Shift Blur
    if (adj.tiltShift > 0 && !isComparing) {
      const off = document.createElement('canvas');
      off.width = W; off.height = H;
      const octx = off.getContext('2d');
      octx.drawImage(ctx.canvas, 0, 0);

      ctx.save();
      ctx.filter = `blur(${Math.max(2, adj.tiltShift / 5)}px)`;
      ctx.drawImage(off, 0, 0);
      ctx.filter = 'none';

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

  }, [image, adj, rotation, flipH, zoom, pan, isComparing, texts, selectedTextId, stickers, selectedStickerId, drawings]);

  // Redraw the preview whenever anything changes.
  useEffect(() => {
    if (!image || !previewRef.current) return;
    const { w, h } = getOutputSize(image, aspect);
    const maxW = 520, maxH = 560;
    const ar = w / h;
    let pw = maxW, ph = maxW / ar;
    if (ph > maxH) { ph = maxH; pw = maxH * ar; }
    pw = Math.round(pw); ph = Math.round(ph);
    const canvas = previewRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = pw * dpr;
    canvas.height = ph * dpr;
    canvas.style.width = pw + 'px';
    canvas.style.height = ph + 'px';
    previewSize.current = { w: pw, h: ph };
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, pw, ph);
  }, [image, aspect, draw]);

  const loadFile = useCallback((file, saveToDb = true) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (saveToDb) {
      idbSave('pe-current-image', file).catch(console.error);
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setAdj({ ...DEFAULT_ADJ });
      setPreset('None');
      setAspect('original');
      setRotation(0);
      setFlipH(false);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setTexts([]);
      setSelectedTextId(null);
      setStickers([]);
      setSelectedStickerId(null);
      setDrawings([]);
      setIsDrawingMode(false);
      // Initialize history
      const initial = { adj: { ...DEFAULT_ADJ }, aspect: 'original', rotation: 0, flipH: false, zoom: 1, pan: { x: 0, y: 0 }, texts: [], stickers: [], drawings: [] };
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

    if (isDrawingMode) {
      dragRef.current = { type: 'draw', currentStroke: { color: brushColor, size: brushSize, points: [{nx, ny}] } };
      setDrawings(d => [...d, dragRef.current.currentStroke]);
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
    dragRef.current = { type: 'pan', startX: e.clientX, startY: e.clientY, pan: { ...pan } };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    if (d.type === 'draw') {
      d.currentStroke.points.push({nx, ny});
      // Force re-render to show drawing live
      setDrawings(arr => [...arr]);
    } else if (d.type === 'text') {
      const dx = nx - d.startNX;
      const dy = ny - d.startNY;
      setTexts(ts => ts.map(t => t.id === d.id ? { ...t, nx: d.initialNX + dx, ny: d.initialNY + dy } : t));
    } else if (d.type === 'sticker') {
      const dx = nx - d.startNX;
      const dy = ny - d.startNY;
      setStickers(ts => ts.map(t => t.id === d.id ? { ...t, nx: d.initialNX + dx, ny: d.initialNY + dy } : t));
    } else {
      const dx = (e.clientX - d.startX) / previewSize.current.w;
      const dy = (e.clientY - d.startY) / previewSize.current.h;
      setPan({ x: d.pan.x + dx, y: d.pan.y + dy });
    }
  };
  const onPointerUp = () => { 
    dragRef.current = null; 
    setIsDragging(false); 
    scheduleHistorySave();
  };

  const applyPreset = (p) => { setPreset(p.id); setAdj({ ...p.adj }); scheduleHistorySave(); };
  const setAdjKey = (key, value) => { setAdj((a) => ({ ...a, [key]: value })); setPreset('custom'); scheduleHistorySave(); };
  
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
      a.download = `edited-${Date.now()}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, mimeType, quality);
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
              <div className="pe-canvas-wrapper">
                <canvas
                  ref={previewRef}
                  className="pe-canvas"
                  style={{ cursor: isPickingWB ? `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>') 2 22, crosshair` : (isDrawingMode ? 'crosshair' : 'grab') }}
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
                  className="pe-btn-icon pe-compare-btn" 
                  onPointerDown={() => setIsComparing(true)}
                  onPointerUp={() => setIsComparing(false)}
                  onPointerLeave={() => setIsComparing(false)}
                  title="Hold to Compare"
                >
                  <Eye size={18} />
                </button>
              </div>
              <p className="pe-stage-hint">Drag to reposition · Use Zoom to fill</p>
            </>
          )}
        </div>

        <div className="pe-controls" style={{ opacity: !image ? 0.5 : 1, pointerEvents: !image ? 'none' : 'auto' }}>
          
          <div className="pe-group" style={{ background: isDrawingMode ? 'rgba(59, 130, 246, 0.1)' : 'transparent', padding: isDrawingMode ? '1rem' : '0', borderRadius: '12px', border: isDrawingMode ? '1px solid rgba(59, 130, 246, 0.3)' : 'none', transition: 'all 0.3s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="pe-group-label" style={{ color: isDrawingMode ? '#3b82f6' : 'var(--text-secondary)' }}>Freehand Draw</span>
              <button className={`pe-btn pe-btn-ghost ${isDrawingMode ? 'is-active' : ''}`} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderColor: isDrawingMode ? '#3b82f6' : 'transparent', color: isDrawingMode ? '#3b82f6' : 'var(--text-primary)' }} onClick={() => setIsDrawingMode(!isDrawingMode)}>
                {isDrawingMode ? 'Done Drawing' : 'Draw'}
              </button>
            </div>
            {isDrawingMode && (
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
            )}
          </div>

          <div className="pe-group">
            <span className="pe-group-label">Presets</span>
            <div className="pe-chips">
              {[...PRESETS, ...customPresets].map((p) => (
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

          <div className="pe-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="pe-group-label">Text</span>
              <button className="pe-btn pe-btn-ghost" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={handleAddText}>
                <Type size={14} /> Add Text
              </button>
            </div>
            
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

          <div className="pe-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="pe-group-label">Stickers</span>
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

          <div className="pe-group">
            <span className="pe-group-label">Crop</span>
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
            <label className="pe-slider-row">
              <span>Zoom</span>
              <input type="range" min="1" max="3" step="0.01" value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                onDoubleClick={() => { setZoom(1); scheduleHistorySave(); }}
                onPointerUp={scheduleHistorySave} />
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

          {/* White Balance Group (Lightroom Style) */}
          <div className="pe-group" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
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
                value={adj.warmth === 0 && adj.tint === 0 ? 'as-shot' : 'custom'}
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
                  value={adj.warmth}
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
                  value={adj.tint}
                  onChange={(e) => setAdjKey('tint', parseInt(e.target.value, 10))}
                  onDoubleClick={() => setAdjKey('tint', DEFAULT_ADJ.tint)}
                  className="pe-wb-slider pe-wb-tint"
                />
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{adj.tint > 0 ? `+${adj.tint}` : adj.tint}</span>
              </label>
            </div>
          </div>

          <div className="pe-group">
            <span className="pe-group-label">Adjust</span>
            {SLIDERS.map((s) => (
              <label key={s.key} className="pe-slider-row">
                <span>{s.label}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  value={adj[s.key]}
                  onChange={(e) => setAdjKey(s.key, parseInt(e.target.value, 10))}
                  onDoubleClick={() => setAdjKey(s.key, DEFAULT_ADJ[s.key])}
                />
              </label>
            ))}
          </div>

          <div className="pe-group">
            <span className="pe-group-label">Creative Effects</span>
            {EFFECT_SLIDERS.map((s) => (
              <label key={s.key} className="pe-slider-row">
                <span>{s.label}</span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  value={adj[s.key]}
                  onChange={(e) => setAdjKey(s.key, parseInt(e.target.value, 10))}
                  onDoubleClick={() => setAdjKey(s.key, DEFAULT_ADJ[s.key])}
                />
              </label>
            ))}
          </div>

          <div className="pe-group">
            <span className="pe-group-label">Split Toning</span>
            <label className="pe-slider-row">
              <span>Intensity</span>
              <input type="range" min="0" max="100" value={adj.duotone} onChange={(e) => setAdjKey('duotone', parseInt(e.target.value, 10))} onDoubleClick={() => setAdjKey('duotone', DEFAULT_ADJ.duotone)} />
            </label>
            {adj.duotone > 0 && (
              <div className="pe-color-row" style={{ marginTop: '0.5rem', justifyContent: 'center', gap: '2rem' }}>
                <label className="pe-color-label" title="Shadow Color">
                  <div className="pe-color-swatch-wrapper">
                    <input type="color" value={adj.duotoneC1} onChange={(e) => setAdjKey('duotoneC1', e.target.value)} />
                  </div>
                  Shadows
                </label>
                <label className="pe-color-label" title="Highlight Color">
                  <div className="pe-color-swatch-wrapper">
                    <input type="color" value={adj.duotoneC2} onChange={(e) => setAdjKey('duotoneC2', e.target.value)} />
                  </div>
                  Highlights
                </label>
              </div>
            )}
          </div>

          <div className="pe-group">
            <span className="pe-group-label">Frames</span>
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

          <div className="pe-actions" style={{ marginTop: '1rem' }}>
            <button className="pe-btn pe-btn-ghost" onClick={saveCustomPreset} title="Save current settings as a new preset">
              <Save size={16} /> Save Preset
            </button>
          </div>

          <div className="pe-group" style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="pe-group-label">Export Settings</span>
            <div className="pe-chips" style={{ marginBottom: '1rem' }}>
              <button className={`pe-chip ${exportFormat === 'jpeg' ? 'is-active' : ''}`} onClick={() => setExportFormat('jpeg')}>JPG</button>
              <button className={`pe-chip ${exportFormat === 'png' ? 'is-active' : ''}`} onClick={() => setExportFormat('png')}>PNG</button>
            </div>
            {exportFormat === 'jpeg' && (
              <label className="pe-slider-row">
                <span>Quality</span>
                <input type="range" min="50" max="100" value={exportQuality} onChange={(e) => setExportQuality(parseInt(e.target.value, 10))} />
              </label>
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
