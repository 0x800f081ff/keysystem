import pool from '../db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') 
    return res.status(405).json({ error: 'Method not allowed' });

  const { username, password, hwid } = req.body;
  if (!username || !password || !hwid) {
    return res.status(400).json({ error: 'Missing username, password, or HWID' });
  }

  const login_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  const usernameClean = username.trim();
  const hwidClean = hwid.trim();

  try {
    // Cherche l'utilisateur
    const [users] = await pool.query("SELECT * FROM users WHERE username = ?", [usernameClean]);
    if (!users.length) return res.status(400).json({ error: 'User not found' });

    const user = users[0];

    if (user.banned) return res.status(403).json({ error: 'User is banned' });

    // Vérifie le mot de passe
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(403).json({ error: 'Invalid password' });

    // Si HWID associé à une license, vérifie qu’il correspond
    const [licenses] = await pool.query("SELECT * FROM licenses WHERE user_id = ?", [user.id]);
    if (licenses.length) {
      const license = licenses[0];
      if (license.banned) return res.status(403).json({ error: 'License is banned' });
      if (license.expiry && new Date(license.expiry) < new Date())
        return res.status(403).json({ error: 'License has expired' });
      if (license.hwid_locked && license.hwid !== hwidClean)
        return res.status(403).json({ error: 'HWID mismatch for license' });
    }

    // Met à jour la dernière connexion et l'IP
    await pool.query("UPDATE users SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?", [login_ip, user.id]);

    res.json({
      success: true,
      user_id: user.id,
      username: user.username,
      last_login_ip: login_ip,
      last_login_at: new Date().toISOString()
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}
