// Reads a small, curated set of "safe" EXIF fields from an uploaded JPEG and
// re-embeds them into the exported JPEG. Canvas exports never carry over the
// original file's metadata (toBlob always produces a fresh file with none),
// so without this, editing here loses information a phone's editor keeps.
//
// Deliberately excludes GPS/location — every field here is read out of the
// same fixed allow-list on both the read and write side, so there is no path
// for location data to reach the exported file even if present in the source.

const TYPE_ASCII = 2;
const TYPE_SHORT = 3;
const TYPE_LONG = 4;
const TYPE_RATIONAL = 5;
const TYPE_SIZES = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

const TAG_MAKE = 0x010f;
const TAG_MODEL = 0x0110;
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_EXPOSURE_TIME = 0x829a;
const TAG_FNUMBER = 0x829d;
const TAG_ISO = 0x8827;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_FOCAL_LENGTH = 0x920a;
const TAG_LENS_MODEL = 0xa434;

export async function readBasicExif(file) {
  try {
    if (!file) return null;
    const buf = await file.arrayBuffer();
    const view = new DataView(buf);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not a JPEG

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      if (marker === 0xffda) break; // Start of Scan — image data follows, no more metadata
      if ((marker & 0xff00) !== 0xff00) break; // not a valid marker, stop rather than guess
      const segLength = view.getUint16(offset + 2);
      if (marker === 0xffe1 && offset + 4 + 6 <= view.byteLength) {
        const exifStart = offset + 4;
        if (
          view.getUint32(exifStart) === 0x45786966 && // "Exif"
          view.getUint16(exifStart + 4) === 0x0000
        ) {
          return parseTiff(view, exifStart + 6);
        }
      }
      offset += 2 + segLength;
    }
    return null;
  } catch {
    return null; // malformed/truncated file — never block photo loading over this
  }
}

function parseTiff(view, tiffStart) {
  try {
    const little = view.getUint16(tiffStart) === 0x4949; // "II"
    const get16 = (o) => view.getUint16(o, little);
    const get32 = (o) => view.getUint32(o, little);

    const readAscii = (valueOffset, count) => {
      let str = '';
      for (let i = 0; i < count - 1; i++) {
        const c = view.getUint8(valueOffset + i);
        if (c === 0) break;
        str += String.fromCharCode(c);
      }
      return str.trim();
    };
    const readRational = (valueOffset) => ({ num: get32(valueOffset), den: get32(valueOffset + 4) });

    const readIfd = (ifdOffset) => {
      const entryCount = get16(ifdOffset);
      const tags = new Map();
      for (let i = 0; i < entryCount; i++) {
        const entryOffset = ifdOffset + 2 + i * 12;
        const tag = get16(entryOffset);
        const type = get16(entryOffset + 2);
        const count = get32(entryOffset + 4);
        const typeSize = TYPE_SIZES[type] || 1;
        const totalSize = typeSize * count;
        const valueFieldOffset = entryOffset + 8;
        const valueOffset = totalSize > 4 ? tiffStart + get32(valueFieldOffset) : valueFieldOffset;
        tags.set(tag, { type, count, valueOffset });
      }
      return tags;
    };

    const ifd0Offset = get32(tiffStart + 4);
    const ifd0 = readIfd(tiffStart + ifd0Offset);
    const result = {};

    if (ifd0.has(TAG_MAKE)) { const e = ifd0.get(TAG_MAKE); result.make = readAscii(e.valueOffset, e.count); }
    if (ifd0.has(TAG_MODEL)) { const e = ifd0.get(TAG_MODEL); result.model = readAscii(e.valueOffset, e.count); }
    if (ifd0.has(TAG_DATETIME)) { const e = ifd0.get(TAG_DATETIME); result.dateTime = readAscii(e.valueOffset, e.count); }

    if (ifd0.has(TAG_EXIF_IFD)) {
      const exifIfd = readIfd(tiffStart + get32(ifd0.get(TAG_EXIF_IFD).valueOffset));
      if (exifIfd.has(TAG_DATETIME_ORIGINAL)) { const e = exifIfd.get(TAG_DATETIME_ORIGINAL); result.dateTimeOriginal = readAscii(e.valueOffset, e.count); }
      if (exifIfd.has(TAG_EXPOSURE_TIME)) result.exposureTime = readRational(exifIfd.get(TAG_EXPOSURE_TIME).valueOffset);
      if (exifIfd.has(TAG_FNUMBER)) result.fNumber = readRational(exifIfd.get(TAG_FNUMBER).valueOffset);
      if (exifIfd.has(TAG_ISO)) result.iso = get16(exifIfd.get(TAG_ISO).valueOffset);
      if (exifIfd.has(TAG_FOCAL_LENGTH)) result.focalLength = readRational(exifIfd.get(TAG_FOCAL_LENGTH).valueOffset);
      if (exifIfd.has(TAG_LENS_MODEL)) { const e = exifIfd.get(TAG_LENS_MODEL); result.lensModel = readAscii(e.valueOffset, e.count); }
    }

    return Object.keys(result).length ? result : null;
  } catch {
    return null;
  }
}

function encodeAscii(str) {
  const bytes = new Uint8Array(str.length + 1);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
  return bytes;
}
function encodeShort(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}
function encodeRational({ num, den }) {
  const bytes = new Uint8Array(8);
  const dv = new DataView(bytes.buffer);
  dv.setUint32(0, num >>> 0, true);
  dv.setUint32(4, den >>> 0, true);
  return bytes;
}

// Lays out one IFD's entries (sorted by tag, per spec) at `startOffset`
// (absolute, relative to the TIFF header). Entries whose value is >4 bytes
// get appended right after the entry table and store an offset instead.
function buildIfdBytes(entries, startOffset) {
  entries.sort((a, b) => a.tag - b.tag);
  const fixedSize = 2 + entries.length * 12 + 4;
  let cursor = startOffset + fixedSize;
  const overflow = [];
  for (const e of entries) {
    if (e.bytes.length > 4) {
      e._offset = cursor;
      overflow.push(e);
      cursor += e.bytes.length + (e.bytes.length % 2); // even-align, standard TIFF hygiene
    }
  }
  const totalSize = cursor - startOffset;
  const out = new Uint8Array(totalSize);
  const dv = new DataView(out.buffer);

  let p = 0;
  dv.setUint16(p, entries.length, true); p += 2;
  for (const e of entries) {
    dv.setUint16(p, e.tag, true);
    dv.setUint16(p + 2, e.type, true);
    dv.setUint32(p + 4, e.count, true);
    if (e.bytes.length > 4) dv.setUint32(p + 8, e._offset, true);
    else out.set(e.bytes, p + 8);
    p += 12;
  }
  dv.setUint32(p, 0, true); // no IFD1

  for (const e of overflow) out.set(e.bytes, e._offset - startOffset);
  return out;
}

function patchIfdPointer(ifdBytes, tag, value) {
  const dv = new DataView(ifdBytes.buffer, ifdBytes.byteOffset, ifdBytes.byteLength);
  const count = dv.getUint16(0, true);
  for (let i = 0; i < count; i++) {
    const entryOffset = 2 + i * 12;
    if (dv.getUint16(entryOffset, true) === tag) {
      dv.setUint32(entryOffset + 8, value, true);
      return;
    }
  }
}

function buildExifApp1Segment(exifData) {
  const ifd0Entries = [];
  const exifIfdEntries = [];

  if (exifData.make) ifd0Entries.push({ tag: TAG_MAKE, type: TYPE_ASCII, count: exifData.make.length + 1, bytes: encodeAscii(exifData.make) });
  if (exifData.model) ifd0Entries.push({ tag: TAG_MODEL, type: TYPE_ASCII, count: exifData.model.length + 1, bytes: encodeAscii(exifData.model) });
  if (exifData.dateTime) ifd0Entries.push({ tag: TAG_DATETIME, type: TYPE_ASCII, count: exifData.dateTime.length + 1, bytes: encodeAscii(exifData.dateTime) });

  if (exifData.dateTimeOriginal) exifIfdEntries.push({ tag: TAG_DATETIME_ORIGINAL, type: TYPE_ASCII, count: exifData.dateTimeOriginal.length + 1, bytes: encodeAscii(exifData.dateTimeOriginal) });
  if (exifData.exposureTime) exifIfdEntries.push({ tag: TAG_EXPOSURE_TIME, type: TYPE_RATIONAL, count: 1, bytes: encodeRational(exifData.exposureTime) });
  if (exifData.fNumber) exifIfdEntries.push({ tag: TAG_FNUMBER, type: TYPE_RATIONAL, count: 1, bytes: encodeRational(exifData.fNumber) });
  if (exifData.iso != null) exifIfdEntries.push({ tag: TAG_ISO, type: TYPE_SHORT, count: 1, bytes: encodeShort(exifData.iso) });
  if (exifData.focalLength) exifIfdEntries.push({ tag: TAG_FOCAL_LENGTH, type: TYPE_RATIONAL, count: 1, bytes: encodeRational(exifData.focalLength) });
  if (exifData.lensModel) exifIfdEntries.push({ tag: TAG_LENS_MODEL, type: TYPE_ASCII, count: exifData.lensModel.length + 1, bytes: encodeAscii(exifData.lensModel) });

  if (exifIfdEntries.length > 0) {
    ifd0Entries.push({ tag: TAG_EXIF_IFD, type: TYPE_LONG, count: 1, bytes: new Uint8Array(4) }); // patched below
  }

  const ifd0Start = 8; // TIFF header ("II" + magic + IFD0 offset) is always 8 bytes
  const ifd0Bytes = buildIfdBytes(ifd0Entries, ifd0Start);

  let exifIfdBytes = new Uint8Array(0);
  if (exifIfdEntries.length > 0) {
    const exifIfdStart = ifd0Start + ifd0Bytes.length;
    exifIfdBytes = buildIfdBytes(exifIfdEntries, exifIfdStart);
    patchIfdPointer(ifd0Bytes, TAG_EXIF_IFD, exifIfdStart);
  }

  const tiff = new Uint8Array(8 + ifd0Bytes.length + exifIfdBytes.length);
  const tdv = new DataView(tiff.buffer);
  tiff[0] = 0x49; tiff[1] = 0x49; // "II" — little-endian
  tdv.setUint16(2, 0x002a, true);
  tdv.setUint32(4, 8, true); // IFD0 starts right after this 8-byte header
  tiff.set(ifd0Bytes, 8);
  tiff.set(exifIfdBytes, 8 + ifd0Bytes.length);

  const exifHeader = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"
  const app1Data = new Uint8Array(exifHeader.length + tiff.length);
  app1Data.set(exifHeader, 0);
  app1Data.set(tiff, exifHeader.length);

  const out = new Uint8Array(4 + app1Data.length);
  const odv = new DataView(out.buffer);
  odv.setUint16(0, 0xffe1, false); // APP1 marker — JPEG marker bytes are always big-endian
  odv.setUint16(2, app1Data.length + 2, false); // segment length includes itself, excludes the marker
  out.set(app1Data, 4);
  return out;
}

// Inserts an APP1/Exif segment right after SOI in a JPEG blob, carrying only
// the fields captured by readBasicExif (never GPS). No-op for anything that
// isn't a JPEG, or if there's nothing to write.
export async function writeBasicExif(blob, exifData) {
  if (!exifData || Object.keys(exifData).length === 0) return blob;
  try {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return blob;

    const segment = buildExifApp1Segment(exifData);
    const out = new Uint8Array(2 + segment.length + (bytes.length - 2));
    out.set(bytes.subarray(0, 2), 0);
    out.set(segment, 2);
    out.set(bytes.subarray(2), 2 + segment.length);
    return new Blob([out], { type: 'image/jpeg' });
  } catch {
    return blob; // never let a metadata failure block the actual download
  }
}
