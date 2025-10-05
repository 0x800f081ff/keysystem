import pool from '../../db.js';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers['admin-token'];
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: 'Invalid admin token' });

  const { allowed_uses = 1, days_valid = 0 } = req.body;

  const crypto = await import('crypto');
  const key = crypto.randomBytes(15).toString('hex').toUpperCase().slice(0, 30);
  const hwid_locked = 1; // always locked
  const expiry = days_valid > 0 ? new Date(Date.now() + days_valid * 24 * 60 * 60 * 1000) : null;

  try {
    await pool.query(
      "INSERT INTO licenses (key_code, allowed_uses, hwid_locked, expiry) VALUES (?, ?, ?, ?)",
      [key, allowed_uses, hwid_locked, expiry]
    );
    res.json({ success: true, key });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
