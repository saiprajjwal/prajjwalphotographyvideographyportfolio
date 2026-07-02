import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, Download, RotateCw, RefreshCw, Undo, Redo, Save, Eye } from 'lucide-react';
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

const DEFAULT_ADJ = { brightness: 100, contrast: 100, saturation: 100, warmth: 0, tint: 0, highlights: 0, shadows: 0, vignette: 0, grain: 0 };

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
  { key: 'warmth', label: 'Temp', min: -100, max: 100 },
  { key: 'tint', label: 'Tint', min: -100, max: 100 },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100 },
  { key: 'grain', label: 'Grain', min: 0, max: 100 },
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

  // Debounced history saving
  const saveStateTimeout = useRef(null);
  const getCurrentState = useCallback(() => ({ adj, aspect, rotation, flipH, zoom, pan }), [adj, aspect, rotation, flipH, zoom, pan]);

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
              const initial = { adj: { ...DEFAULT_ADJ }, aspect: 'original', rotation: 0, flipH: false, zoom: 1, pan: { x: 0, y: 0 } };
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
  }, [image, adj, rotation, flipH, zoom, pan, isComparing]);

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
      // Initialize history
      const initial = { adj: { ...DEFAULT_ADJ }, aspect: 'original', rotation: 0, flipH: false, zoom: 1, pan: { x: 0, y: 0 } };
      setHistory([initial]);
      setHistoryIndex(0);
      localStorage.setItem('pe-current-state', JSON.stringify(initial));
    };
    img.src = url;
  }, []);

  const onPointerDown = (e) => {
    if (!image) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, pan: { ...pan } };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / previewSize.current.w;
    const dy = (e.clientY - d.startY) / previewSize.current.h;
    setPan({ x: d.pan.x + dx, y: d.pan.y + dy });
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
    scheduleHistorySave();
  };

  const handleExport = () => {
    if (!image) return;
    const { w, h } = getOutputSize(image, aspect);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    draw(ctx, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited-${Date.now()}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/jpeg', 0.92);
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
                />
              </label>
            ))}
          </div>

          <div className="pe-actions" style={{ marginTop: '1rem' }}>
            <button className="pe-btn pe-btn-ghost" onClick={saveCustomPreset} title="Save current settings as a new preset">
              <Save size={16} /> Save Preset
            </button>
          </div>

          <div className="pe-actions">
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
