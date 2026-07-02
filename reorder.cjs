const fs = require('fs');
const code = fs.readFileSync('src/pages/Editor.jsx', 'utf8');

const sDraw = code.indexOf('<div className="pe-group" style={{ background: isDrawingMode');
const sPresets = code.indexOf('<div className="pe-group">\n            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, presets: !s.presets }))}>');
const sText = code.indexOf('<div className="pe-group">\n            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, text: !s.text }))}>');
const sStickers = code.indexOf('<div className="pe-group">\n            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, stickers: !s.stickers }))}>');
const sCrop = code.indexOf('<div className="pe-group">\n            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, crop: !s.crop }))}>');
const sWb = code.indexOf('{/* White Balance Group (Lightroom Style) */}');
const sAdjust = code.indexOf('<div className="pe-group">\n            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, adjust: !s.adjust }))}>');
const sEffects = code.indexOf('<div className="pe-group">\n            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, effects: !s.effects }))}>');
const sSplitTone = code.indexOf('<div className="pe-group">\n            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, splitTone: !s.splitTone }))}>');
const sFrames = code.indexOf('<div className="pe-group">\n            <div className="pe-section-header" onClick={() => setOpenSections(s => ({ ...s, frames: !s.frames }))}>');
const sActions = code.indexOf('<div className="pe-actions" style={{ marginTop: \'1rem\' }}>');

const bDraw = code.substring(sDraw, sPresets).trim();
const bPresets = code.substring(sPresets, sText).trim();
const bText = code.substring(sText, sStickers).trim();
const bStickers = code.substring(sStickers, sCrop).trim();
const bCrop = code.substring(sCrop, sWb).trim();
const bWb = code.substring(sWb, sAdjust).trim();
const bAdjust = code.substring(sAdjust, sEffects).trim();
const bEffects = code.substring(sEffects, sSplitTone).trim();
const bSplitTone = code.substring(sSplitTone, sFrames).trim();
const bFrames = code.substring(sFrames, sActions).trim();

const pre = code.substring(0, sDraw);
const post = code.substring(sActions);

const orderedBlocks = [
  bPresets,
  bCrop,
  bWb,
  bAdjust,
  bEffects,
  bSplitTone,
  bFrames,
  bText,
  bStickers,
  bDraw
];

const newCode = pre + orderedBlocks.join('\n\n          ') + '\n\n          ' + post;

fs.writeFileSync('src/pages/Editor.jsx', newCode);
console.log("Success");
