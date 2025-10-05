import pool from '../../db.js';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers['admin-token'];
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: 'Invalid admin token' });

  const { key, ban } = req.body;
  if (!key || typeof ban !== 'boolean') return res.status(400).json({ error: 'Missing key or ban flag' });

  try {
    await pool.query("UPDATE licenses SET banned = ? WHERE key_code = ?", [ban ? 1 : 0, key]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
