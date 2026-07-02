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

  const { id, session } = req.body || {};
  if (!id || !session) {
    res.status(400).json({ error: 'id and session are required' });
    return;
  }

  try {
    const coverTag = `cover_${session.trim()}`;

    // 1. Find any existing covers for this session
    const searchResult = await cloudinary.search
      .expression(`tags=${coverTag}`)
      .max_results(50)
      .execute();

    // 2. Remove the cover tag from them
    const existingIds = searchResult.resources.map(r => r.public_id);
    if (existingIds.length > 0) {
      await cloudinary.uploader.remove_tag(coverTag, existingIds);
    }

    // 3. Add the cover tag to the requested photo
    await cloudinary.uploader.add_tag(coverTag, [id]);

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error during set cover', message: error.message });
  }
}
