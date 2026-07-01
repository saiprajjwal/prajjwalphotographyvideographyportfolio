import { signToken } from './_auth.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.ADMIN_PASSWORD) {
    res.status(500).json({ error: 'ADMIN_PASSWORD is not configured on the server' });
    return;
  }

  const { password } = req.body || {};

  if (password !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Incorrect password' });
    return;
  }

  res.status(200).json({ token: signToken() });
}
