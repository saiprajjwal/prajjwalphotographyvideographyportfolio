import fs from 'fs';
import path from 'path';
import { verifyToken } from './_auth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorized — please log in again' });
  }

  const { reels } = req.body;
  if (!Array.isArray(reels)) {
    return res.status(400).json({ error: 'Invalid data format' });
  }

  try {
    const dataPath = path.join(process.cwd(), 'src', 'data', 'portfolio.json');
    const fileContents = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(fileContents);

    data.reels = reels;

    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Failed to update reels:', error);
    return res.status(500).json({ error: 'Failed to update reels' });
  }
}
