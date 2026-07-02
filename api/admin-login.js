import crypto from 'crypto';
import { signToken } from './_auth.js';

// In-memory attempt tracking per IP. Serverless instances are ephemeral, so
// this is per-instance rather than global — still meaningful friction against
// brute force without needing an external store.
const attempts = new Map(); // ip -> { count, lockedUntil }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// Hash both sides so timingSafeEqual gets equal-length buffers regardless of
// password length, keeping the comparison constant-time.
function timingSafeStringEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.ADMIN_PASSWORD) {
    res.status(500).json({ error: 'ADMIN_PASSWORD is not configured on the server' });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = attempts.get(ip) || { count: 0, lockedUntil: 0 };

  if (rec.lockedUntil > now) {
    const mins = Math.ceil((rec.lockedUntil - now) / 60000);
    res.status(429).json({ error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` });
    return;
  }

  const { password } = req.body || {};

  if (!password || !timingSafeStringEqual(password, process.env.ADMIN_PASSWORD)) {
    rec.count += 1;
    if (rec.count >= MAX_ATTEMPTS) {
      rec.lockedUntil = now + LOCKOUT_MS;
      rec.count = 0;
    }
    attempts.set(ip, rec);
    res.status(401).json({ error: 'Incorrect password' });
    return;
  }

  attempts.delete(ip);
  res.status(200).json({ token: signToken() });
}
