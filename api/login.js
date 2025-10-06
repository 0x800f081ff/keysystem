import pool from '../db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') 
    return res.status(405).json({ error: 'Method not allowed' });

  const { username, password, hwid } = req.body; // hwid is optional
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  const login_ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  const usernameClean = username.trim();

  try {
    // Fetch user
    const [users] = await pool.query("SELECT * FROM users WHERE username = ?", [usernameClean]);
    if (!users.length) return res.status(400).json({ error: 'User not found' });

    const user = users[0];
    if (user.banned) return res.status(403).json({ error: 'User is banned' });

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) return res.status(403).json({ error: 'Invalid password' });

    // Fetch latest license for this user
    const [licenses] = await pool.query(
      "SELECT * FROM licenses WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      [user.id]
    );

    let licenseData = null;
    if (licenses.length) {
      const license = licenses[0];

      // HWID enforcement only if hwid is sent
      if (hwid && license.hwid_locked && license.hwid && license.hwid !== hwid) {
        return res.status(403).json({ error: 'This license is locked to another computer.' });
      }

      licenseData = {
        key: license.key_code,
        email: license.hwid || null, // hwid column now stores email in website flow
        hwid_locked: license.hwid_locked,
        uses: license.uses,
        allowed_uses: license.allowed_uses,
        banned: license.banned,
        expiry: license.expiry
      };

      if (license.banned) return res.status(403).json({ error: 'License is banned' });
      if (license.expiry && new Date(license.expiry) < new Date())
        return res.status(403).json({ error: 'License has expired' });
    }

    // Update last login info
    await pool.query(
      "UPDATE users SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?",
      [login_ip, user.id]
    );

    // Return response
    res.json({
      success: true,
      user_id: user.id,
      username: user.username,
      last_login_ip: login_ip,
      last_login_at: new Date().toISOString(),
      license: licenseData
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}
