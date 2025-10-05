import pool from '../db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password, key, hwid } = req.body;
  if (!username || !password || !key || !hwid) {
    return res.status(400).json({ error: 'Missing username, password, license, or HWID' });
  }

  try {
    // Check if license exists
    const [licenses] = await pool.query("SELECT * FROM licenses WHERE key_code = ?", [key]);
    if (!licenses.length) return res.status(400).json({ error: 'License not found' });

    const license = licenses[0];

    // Check if license is banned
    if (license.banned) return res.status(403).json({ error: 'License is banned' });

    // Check HWID binding
    if (license.hwid_locked && license.hwid && license.hwid !== hwid) {
      return res.status(403).json({ error: 'License is locked to another HWID' });
    }

    // Bind HWID if empty
    if (!license.hwid) {
      await pool.query("UPDATE licenses SET hwid = ? WHERE id = ?", [hwid, license.id]);
    }

    // Check if username exists
    const [users] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
    if (users.length) return res.status(400).json({ error: 'Username already exists' });

    // Hash password and create user
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, NOW())",
      [username, hashed]
    );

    res.json({ success: true, user_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
