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

  const { id } = req.body || {};
  if (!id) {
    res.status(400).json({ error: 'id (public_id) is required' });
    return;
  }

  try {
    const result = await cloudinary.uploader.destroy(id);
    if (result.result === 'ok' || result.result === 'not found') {
      res.status(200).json({ success: true, result: result.result });
    } else {
      res.status(400).json({ error: 'Deletion failed', details: result });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error during deletion', message: error.message });
  }
}
