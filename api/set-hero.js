import { v2 as cloudinary } from 'cloudinary';
import { verifyToken } from './_auth.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Picks which photo represents a category on the portfolio hero band.
//
// Separate from set-cover: that one marks the cover *within an album*
// (tag cover_<album>), whereas this marks the single image a whole category
// shows on the hero (tag hero_<category>). A photo can be both.
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

  const { id, category } = req.body || {};
  if (!id || !category) {
    res.status(400).json({ error: 'id and category are required' });
    return;
  }

  try {
    const heroTag = `hero_${category.trim()}`;

    // 1. Find any existing hero for this category. Quote the tag — category
    // names contain spaces ("Behind The Scene"), and an unquoted expression
    // would parse that as separate terms and match the wrong photos.
    const searchResult = await cloudinary.search
      .expression(`tags="${heroTag}"`)
      .max_results(50)
      .execute();

    // 2. Clear the tag from them
    const existingIds = searchResult.resources
      .map((r) => r.public_id)
      .filter((pid) => pid !== id);
    if (existingIds.length > 0) {
      await cloudinary.uploader.remove_tag(heroTag, existingIds);
    }

    // 3. Tag the requested photo
    await cloudinary.uploader.add_tag(heroTag, [id]);

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error during set hero', message: error.message });
  }
}
