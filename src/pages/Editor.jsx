import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, Download, RotateCw, RefreshCw } from 'lucide-react';
import './Editor.css';

// Fully client-side basic photo editor for social posts. Nothing is uploaded to
// a server — everything runs in the browser via <canvas>. This page is lazily
// loaded (see App.jsx) so it never affects the rest of the site's load time.

const ASPECTS = [
  { id: 'original', label: 'Original' },
  { id: '1:1', label: 'Square', w: 1080, h: 1080 },
  { id: '4:5', label: 'Portrait', w: 1080, h: 1350 },
  { id: '9:16', label: 'Story', w: 1080, h: 1920 },
  { id: '16:9', label: 'Wide', w: 1920, h: 1080 },
];

const DEFAULT_ADJ = { brightness: 100, contrast: 100, saturation: 100, warmth: 0, vignette: 0 };

const PRESETS = [
  { id: 'None', adj: { ...DEFAULT_ADJ } },
  { id: 'Punch', adj: { ...DEFAULT_ADJ, contrast: 116, saturation: 122 } },
  { id: 'Warm', adj: { ...DEFAULT_ADJ, warmth: 45, brightness: 104 } },
  { id: 'Cool', adj: { ...DEFAULT_ADJ, warmth: -45 } },
  { id: 'Mono', adj: { ...DEFAULT_ADJ, saturation: 0, contrast: 112 } },
  { id: 'Film', adj: { ...DEFAULT_ADJ, contrast: 94, saturation: 88, warmth: 18, vignette: 28 } },
  { id: 'Vivid', adj: { ...DEFAULT_ADJ, saturation: 138, contrast: 108 } },
];

const SLIDERS = [
  { key: 'brightness', label: 'Brightness', min: 50, max: 150 },
  { key: 'contrast', label: 'Contrast', min: 50, max: 150 },
  { key: 'saturation', label: 'Saturation', min: 0, max: 200 },
  { key: 'warmth', label: 'Warmth', min: -100, max: 100 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100 },
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

  const previewRef = useRef(null);
  const fileRef = useRef(null);
  const previewSize = useRef({ w: 1, h: 1 });
  const dragRef = useRef(null);

  // Draw the whole scene into a context at the given output size. Shared by the
  // live preview and the export so what you see is exactly what you download.
  const draw = useCallback((ctx, W, H) => {
    if (!image) return;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.filter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturation}%)`;

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

    if (adj.warmth !== 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = Math.min(Math.abs(adj.warmth) / 100, 1) * 0.6;
      ctx.fillStyle = adj.warmth > 0 ? '#ff8a1e' : '#1e7bff';
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
  }, [image, adj, rotation, flipH, zoom, pan]);

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

  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
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
    };
    img.src = url;
  }, []);

  const onPointerDown = (e) => {
    if (!image) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, pan: { ...pan } };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / previewSize.current.w;
    const dy = (e.clientY - d.startY) / previewSize.current.h;
    setPan({ x: d.pan.x + dx, y: d.pan.y + dy });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const applyPreset = (p) => { setPreset(p.id); setAdj({ ...p.adj }); };
  const setAdjKey = (key, value) => { setAdj((a) => ({ ...a, [key]: value })); setPreset('custom'); };

  const resetAll = () => {
    setAdj({ ...DEFAULT_ADJ });
    setPreset('None');
    setRotation(0);
    setFlipH(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
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
        <div className="pe-workspace">
          <div className="pe-stage">
            <canvas
              ref={previewRef}
              className="pe-canvas"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            <p className="pe-stage-hint">Drag the photo to reposition · use Zoom to fill the crop</p>
          </div>

          <div className="pe-controls">
            <div className="pe-group">
              <span className="pe-group-label">Presets</span>
              <div className="pe-chips">
                {PRESETS.map((p) => (
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
                    onClick={() => setAspect(a.id)}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <label className="pe-slider-row">
                <span>Zoom</span>
                <input type="range" min="1" max="3" step="0.01" value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))} />
              </label>
              <div className="pe-chips">
                <button className="pe-chip" onClick={() => setRotation((r) => (r + 90) % 360)}>
                  <RotateCw size={15} /> Rotate
                </button>
                <button className={`pe-chip ${flipH ? 'is-active' : ''}`} onClick={() => setFlipH((f) => !f)}>
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

            <div className="pe-actions">
              <button className="pe-btn pe-btn-ghost" onClick={resetAll}>
                <RefreshCw size={16} /> Reset
              </button>
              <button className="pe-btn pe-btn-ghost" onClick={() => fileRef.current?.click()}>
                <Upload size={16} /> New
              </button>
              <button className="pe-btn pe-btn-primary" onClick={handleExport}>
                <Download size={16} /> Download
              </button>
            </div>
          </div>
        </div>
      )}

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
