import pool from '../db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') 
    return res.status(405).json({ error: 'Method not allowed' });

  let { username, password, key, hwid } = req.body;
  if (!username || !password || !key || !hwid) {
    return res.status(400).json({ error: 'Missing username, password, license, or HWID' });
  }

  // Nettoyage des valeurs
  username = username.trim();
  password = password.trim();
  const licenseKey = key.trim().toUpperCase();
  hwid = hwid.trim();

  // Récupère l'IP du client
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';

  try {
    // Cherche la license
    const [licenses] = await pool.query(
      "SELECT * FROM licenses WHERE UPPER(key_code) = ?",
      [licenseKey]
    );
    if (!licenses.length) return res.status(400).json({ error: 'License not found' });

    const license = licenses[0];

    // Vérifications license
    if (license.banned) return res.status(403).json({ error: 'License is banned' });
    if (license.expiry && new Date(license.expiry) < new Date())
      return res.status(403).json({ error: 'License has expired' });
    if (license.allowed_uses !== 0 && license.uses >= license.allowed_uses)
      return res.status(403).json({ error: 'License has reached max uses' });

    // HWID binding si nécessaire
    if (license.hwid_locked && license.hwid && license.hwid !== hwid) {
      return res.status(403).json({ error: 'License is locked to another HWID' });
    }

    if (license.hwid_locked && !license.hwid) {
      await pool.query("UPDATE licenses SET hwid = ? WHERE id = ?", [hwid, license.id]);
    }

    // Vérifie si le username existe déjà
    const [users] = await pool.query("SELECT * FROM users WHERE username = ?", [username]);
    if (users.length) return res.status(400).json({ error: 'Username already exists' });

    // Hash du mot de passe et création de l’utilisateur
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (username, password_hash, created_at, last_login_ip) VALUES (?, ?, NOW(), ?)",
      [username, hashed, clientIP]
    );

    // Lier la license à cet utilisateur
    await pool.query(
      "UPDATE licenses SET user_id = ?, uses = uses + 1 WHERE id = ?",
      [result.insertId, license.id]
    );

    res.json({
      success: true,
      user_id: result.insertId,
      license_key: license.key_code,
      register_ip: clientIP
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}
