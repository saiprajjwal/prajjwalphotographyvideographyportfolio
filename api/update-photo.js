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

  const { id, category, session } = req.body || {};
  if (!id) {
    res.status(400).json({ error: 'id (public_id) is required' });
    return;
  }
  if (!category) {
    res.status(400).json({ error: 'category is required' });
    return;
  }

  try {
    const tags = session ? [category, `session_${session.trim()}`] : [category];
    
    // Explicit API allows us to rewrite the tags of an existing asset
    const result = await cloudinary.uploader.explicit(id, {
      type: 'upload',
      tags: tags
    });
    
    res.status(200).json({ success: true, tags: result.tags });
  } catch (error) {
    res.status(500).json({ error: 'Server error during update', message: error.message });
  }
}
