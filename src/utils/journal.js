// Shared between the admin form and the public Journal pages, so a slug is
// generated the same way everywhere and an entry's photos are resolved from
// one place — a Journal entry never uploads its own images, it only points
// at a category + session that already exists in the photo library.

export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'entry';
}

// Appends -2, -3, ... until the slug is unique among existing entries.
export function uniqueSlug(base, existingIds, ignoreId = null) {
  const taken = new Set(existingIds.filter((id) => id !== ignoreId));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

// All photos this entry draws on: same category, and same session if one is
// set. Order follows each photo's own photoOrder, matching the album grid.
export function photosForEntry(entry, photos) {
  if (!entry) return [];
  return photos
    .filter((p) => p.category === entry.category && (!entry.session || p.session === entry.session))
    .sort((a, b) => (a.photoOrder > 0 ? a.photoOrder : Infinity) - (b.photoOrder > 0 ? b.photoOrder : Infinity));
}

// The lead image for the entry's hero: whichever photo is flagged as the
// album/category cover, else just the first in the set.
export function heroForEntry(entry, entryPhotos) {
  return entryPhotos.find((p) => p.isCover) || entryPhotos.find((p) => p.isHero) || entryPhotos[0] || null;
}

// Split the stored body on blank lines into paragraphs for rendering.
export function paragraphsOf(body) {
  return (body || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
