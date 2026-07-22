import { v2 as cloudinary } from 'cloudinary';
import { verifyToken } from './_auth.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Marks one photo as the representative image for a group, by moving an
// exclusive tag onto it.
//
// Two modes, deliberately sharing one endpoint:
//   { id, session }  → cover of that album    (tag cover_<album>)
//   { id, category } → hero of that category  (tag hero_<category>)
//
// The hero mode briefly lived in its own api/set-hero.js, which failed to
// deploy: Vercel's Hobby plan caps a deployment at 12 Serverless Functions
// and this project sits exactly on that limit, so a 13th file breaks the
// build. (It builds fine locally — `npm run build` only compiles the
// frontend and never sees the limit.) The two operations differ only by
// which tag they move, so they share a handler rather than cost a slot.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!verifyToken(token)) {
    res.status(401).json({ error: 'Unauthorized — please log in again' });
    return;
  }

  const { id, session, category } = req.body || {};
  if (!id || (!session && !category)) {
    res.status(400).json({ error: 'id and either session or category are required' });
    return;
  }

  // session takes precedence, so existing album-cover callers are unchanged
  const tag = session ? `cover_${session.trim()}` : `hero_${category.trim()}`;

  try {
    // 1. Find whoever currently holds this tag. Quote it — album and category
    // names contain spaces, and an unquoted expression would match the wrong
    // photos (parsing "cover_Studio 1" as "cover_Studio" AND "1").
    const searchResult = await cloudinary.search
      .expression(`tags="${tag}"`)
      .max_results(50)
      .execute();

    // 2. Clear it from them
    const existingIds = searchResult.resources
      .map(r => r.public_id)
      .filter(pid => pid !== id);
    if (existingIds.length > 0) {
      await cloudinary.uploader.remove_tag(tag, existingIds);
    }

    // 3. Apply it to the requested photo
    await cloudinary.uploader.add_tag(tag, [id]);

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error while setting image', message: error.message });
  }
}
