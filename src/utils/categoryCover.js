// Which photo represents a category on the portfolio hero band.
//
// Shared so the admin preview and the live band can't drift apart — if these
// were two copies, the admin would happily show a cover the site doesn't use.
//
// 1. An explicit pick from admin ("Portfolio Covers" tab) always wins.
// 2. Otherwise fall back to the lowest-numbered album's own cover, so a
//    category still shows something sensible before anything is chosen.

const albumRank = (v) => (v > 0 ? v : Infinity);

export function pickCategoryCover(catPhotos) {
  if (!catPhotos || catPhotos.length === 0) return null;

  const chosen = catPhotos.find((p) => p.isHero);
  if (chosen) return chosen;

  const albums = [...new Set(catPhotos.map((p) => p.session).filter(Boolean))];
  const leadAlbum = albums.sort((a, b) => {
    const rankOf = (name) =>
      Math.min(
        ...catPhotos.filter((p) => p.session === name).map((p) => albumRank(p.albumOrder))
      );
    return rankOf(a) - rankOf(b);
  })[0];

  const pool = leadAlbum ? catPhotos.filter((p) => p.session === leadAlbum) : catPhotos;
  return pool.find((p) => p.isCover) || pool[0] || catPhotos.find((p) => p.isCover) || catPhotos[0];
}
