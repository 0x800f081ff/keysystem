import pool from '../db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

  try {
    const [users] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
    if (!users.length) return res.status(400).json({ error: 'User not found' });

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(403).json({ error: 'Incorrect password' });

    // Return minimal user info (no password hash)
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        created_at: user.created_at
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
