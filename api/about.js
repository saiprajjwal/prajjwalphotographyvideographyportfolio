import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Cloudinary URL for the raw file we save in update-about.js
    const url = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/portfolio_about_data.json`;
    
    // Add a cache-busting query param so we always get the latest if recently updated
    const response = await fetch(`${url}?t=${Date.now()}`);
    
    if (!response.ok) {
      // If it doesn't exist yet on Cloudinary, return a 404 so frontend can fallback to portfolio.json
      res.status(404).json({ error: 'About data not found on Cloudinary' });
      return;
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching about data' });
  }
}
