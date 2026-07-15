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

  const storeData = req.body;
  
  if (!storeData || !Array.isArray(storeData.products)) {
    res.status(400).json({ error: 'Invalid store data provided' });
    return;
  }

  try {
    const jsonString = JSON.stringify(storeData);
    const base64 = Buffer.from(jsonString).toString('base64');
    const dataUri = `data:application/json;base64,${base64}`;

    // Upload as a raw JSON file to Cloudinary
    const result = await cloudinary.uploader.upload(dataUri, {
      resource_type: 'raw',
      public_id: 'portfolio_store_data.json',
      overwrite: true,
      invalidate: true // ensure CDN caches are cleared
    });
    
    res.status(200).json({ success: true, url: result.secure_url });
  } catch (error) {
    res.status(500).json({ error: 'Server error saving store data', message: error.message });
  }
}
