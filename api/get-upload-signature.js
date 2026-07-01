import { v2 as cloudinary } from 'cloudinary';
import { verifyToken } from './_auth.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!verifyToken(token)) {
    res.status(401).json({ error: 'Unauthorized — please log in again' });
    return;
  }

  const { category, altText } = req.body || {};
  if (!category) {
    res.status(400).json({ error: 'category is required' });
    return;
  }

  const timestamp = Math.round(Date.now() / 1000);
  const folder = 'portfolio';
  const context = `alt=${altText || `${category} photo by Prajjwal Pandey`}`;

  // Every non-file param the client will send must be included here, or
  // Cloudinary will reject the upload with a signature mismatch.
  const paramsToSign = { timestamp, folder, tags: category, context };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

  res.status(200).json({
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder,
    tags: category,
    context,
  });
}
