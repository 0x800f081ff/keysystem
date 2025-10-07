import pool from '../db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  let { username, password, key, email, hwid } = req.body;

  // Trim fields
  username = username?.trim();
  password = password?.trim();
  key = key?.trim()?.toUpperCase();
  email = email?.trim();
  hwid = hwid?.trim(); // optional for website

  // ✅ Required fields for all registrations
  const missing = [];
  if (!username) missing.push('username');
  if (!password) missing.push('password');
  if (!key) missing.push('license key');
  if (!email) missing.push('email');

  if (missing.length > 0) {
    return res.status(400).json({
      error: `Missing field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`
    });
  }

  // ✅ Check email format (only if provided)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';

  try {
    // ✅ Find license
    const [licenses] = await pool.query(
      "SELECT * FROM licenses WHERE UPPER(key_code) = ?",
      [key]
    );
    if (!licenses.length) return res.status(400).json({ error: 'License not found' });

    const license = licenses[0];

    // ✅ License validations
    if (license.banned) return res.status(403).json({ error: 'License is banned' });
    if (license.expiry && new Date(license.expiry) < new Date())
      return res.status(403).json({ error: 'License has expired' });
    if (license.allowed_uses !== 0 && license.uses >= license.allowed_uses)
      return res.status(403).json({ error: 'License has reached max uses' });

    // ✅ Check username uniqueness
    const [users] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
    if (users.length) return res.status(400).json({ error: 'Username already exists' });

    // ✅ Create user
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (username, password_hash, email, created_at, last_login_ip) VALUES (?, ?, ?, NOW(), ?)",
      [username, hashed, email, clientIP]
    );

    // ✅ Link license to user & assign HWID only if provided
    const updateData = [result.insertId, license.id];
    let updateQuery = "UPDATE licenses SET user_id = ?, uses = uses + 1";
    if (hwid) {
      updateQuery += ", hwid = ?";
      updateData.splice(1, 0, hwid); // insert hwid after user_id
    }
    updateQuery += " WHERE id = ?";
    await pool.query(updateQuery, updateData);

    res.json({
      success: true,
      user_id: result.insertId,
      username,
      email,
      license_key: license.key_code,
      hwid: hwid || null, // only if client sent it
      register_ip: clientIP
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}
