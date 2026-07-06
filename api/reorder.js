import { v2 as cloudinary } from 'cloudinary';
import { verifyToken } from './_auth.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

  const { type, updates } = req.body || {};
  if (!type || !Array.isArray(updates)) {
    res.status(400).json({ error: 'type and updates array are required' });
    return;
  }

  try {
    const promises = [];

    if (type === 'photos') {
      // updates: [{ id: 'public_id', order: 1 }, ...]
      for (const item of updates) {
        if (!item.id) continue;
        promises.push(
          cloudinary.uploader.add_context(`photo_order=${item.order}`, [item.id])
        );
      }
    } else if (type === 'albums') {
      // updates: [{ session: 'Studio 1', order: 1 }, ...]
      for (const item of updates) {
        if (!item.session) continue;
        // Quote the tag: album names contain spaces ("Studio 1"), and an
        // unquoted `tags=session_Studio 1` is parsed as `session_Studio` AND
        // `1`, matching the wrong photos across albums.
        const searchResult = await cloudinary.search
          .expression(`tags="session_${item.session.trim()}"`)
          .max_results(500)
          .execute();
          
        const ids = searchResult.resources.map(r => r.public_id);
        if (ids.length > 0) {
          promises.push(
            cloudinary.uploader.add_context(`album_order=${item.order}`, ids)
          );
        }
      }
    } else {
      res.status(400).json({ error: 'invalid type' });
      return;
    }

    await Promise.all(promises);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error during reorder', message: error.message });
  }
}
