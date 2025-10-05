import pool from '../../db.js';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers['admin-token'];
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: 'Invalid admin token' });

  const { user_id, ban } = req.body;
  if (!user_id || typeof ban !== 'boolean') return res.status(400).json({ error: 'Missing user_id or ban flag' });

  try {
    await pool.query("UPDATE users SET banned = ? WHERE id = ?", [ban ? 1 : 0, user_id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
