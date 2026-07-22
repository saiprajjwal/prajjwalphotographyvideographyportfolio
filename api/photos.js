import { v2 as cloudinary } from 'cloudinary';
import { verifyToken } from './_auth.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// The editable category list, kept as a raw JSON file on Cloudinary — the
// same trick update-about.js uses. src/data/portfolio.json still ships a
// default, but it's baked into the bundle at build time, so it can't be the
// source of truth for something the admin edits.
const CATEGORIES_FILE = 'portfolio_categories.json';

async function readCategories() {
  const url = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/${CATEGORIES_FILE}`;
  try {
    // Cache-bust so an edit is visible immediately rather than after the CDN TTL
    const response = await fetch(`${url}?t=${Date.now()}`);
    if (!response.ok) return null;           // never saved yet
    const data = await response.json();
    return Array.isArray(data?.categories) ? data.categories : null;
  } catch {
    return null;                              // fall back to the bundled list
  }
}

// GET  → { photos, categories }
// POST → save the category list (admin only)
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!verifyToken(token)) {
      res.status(401).json({ error: 'Unauthorized — please log in again' });
      return;
    }

    const { categories } = req.body || {};
    if (!Array.isArray(categories) || categories.some(c => typeof c !== 'string' || !c.trim())) {
      res.status(400).json({ error: 'categories must be an array of non-empty strings' });
      return;
    }

    try {
      const cleaned = [...new Set(categories.map(c => c.trim()))];
      const base64 = Buffer.from(JSON.stringify({ categories: cleaned })).toString('base64');
      await cloudinary.uploader.upload(`data:application/json;base64,${base64}`, {
        resource_type: 'raw',
        public_id: CATEGORIES_FILE,
        overwrite: true,
        invalidate: true,
      });
      res.status(200).json({ success: true, categories: cleaned });
    } catch (error) {
      res.status(500).json({ error: 'Server error saving categories', message: error.message });
    }
    return;
  }

  try {
    // Read via the Admin API, not the Search API. The Search API's context
    // index is only *eventually consistent* — after the admin reorders albums
    // or photos (which writes photo_order/album_order into context), the search
    // index can lag for minutes, so the live site kept showing stale/no order.
    // The Admin API reflects context writes immediately. (Cap: 500 resources.)
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'portfolio/',
      context: true,
      tags: true,
      max_results: 500,
    });

    const resources = (result.resources || []).sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    const photos = resources.map((resource) => {
      const tags = resource.tags || [];
      // Category is "the tag that isn't one of our prefixed markers", so every
      // marker prefix must be excluded here — a hero_ tag left in would be
      // read as the photo's category and drop it out of its real one.
      const category =
        tags.find(
          t => !t.startsWith('session_') && !t.startsWith('cover_') && !t.startsWith('hero_')
        ) || 'Uncategorized';
      const sessionTag = tags.find(t => t.startsWith('session_'));
      const session = sessionTag ? sessionTag.replace(/^session_/, '').replace(/_/g, ' ') : null;
      const isCover = tags.some(t => t.startsWith('cover_'));
      // Marks the one photo a category shows on the portfolio hero band
      const isHero = tags.some(t => t.startsWith('hero_'));

      const alt =
        resource.context?.custom?.alt ||
        resource.context?.alt ||
        `${category} photo by Prajjwal Pandey`;
        
      const photoOrder = parseInt(resource.context?.custom?.photo_order, 10) || 0;
      const albumOrder = parseInt(resource.context?.custom?.album_order, 10) || 0;

      return {
        id: resource.public_id,
        src: resource.secure_url.replace('/upload/', '/upload/f_auto,q_auto,w_1200,c_limit,dpr_auto/'),
        alt,
        category,
        session,
        isCover,
        isHero,
        photoOrder,
        albumOrder,
      };
    });

    // null when nothing has been saved yet — the client then falls back to the
    // list bundled in src/data/portfolio.json
    const categories = await readCategories();

    // Short edge cache: the Admin API is rate-limited (500/hr on the free
    // plan), so serving every visitor from origin is risky under traffic.
    // 30s at the edge caps origin hits while keeping admin edits near-live;
    // stale-while-revalidate serves instantly and refreshes in the background.
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
    res.status(200).json({ photos, categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
