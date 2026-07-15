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

  const { id, category, session, alt, cameraSettings } = req.body || {};
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
    
    const explicitParams = {
      type: 'upload',
      tags: tags
    };

    const contextParts = [];
    if (alt) {
      contextParts.push(`alt=${alt.trim()}`);
    }
    if (cameraSettings) {
      contextParts.push(`camera_settings=${cameraSettings.trim()}`);
    }
    
    if (contextParts.length > 0) {
      explicitParams.context = contextParts.join('|');
    }
    
    const result = await cloudinary.uploader.explicit(id, explicitParams);
    
    res.status(200).json({ success: true, tags: result.tags, context: result.context });
  } catch (error) {
    res.status(500).json({ error: 'Server error during update', message: error.message });
  }
}
