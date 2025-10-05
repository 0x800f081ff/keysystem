import pool from '../db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') 
    return res.status(405).json({ error: 'Method not allowed' });

  const { username, password, hwid } = req.body;
  if (!username || !password || !hwid) {
    return res.status(400).json({ error: 'Missing username, password, or HWID' });
  }

  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
  const usernameClean = username.trim();
  const hwidClean = hwid.trim();

  try {
    // 1️⃣ Cherche l'utilisateur
    const [users] = await pool.query(
      "SELECT * FROM users WHERE username = ?",
      [usernameClean]
    );
    if (!users.length) return res.status(400).json({ error: 'User not found' });

    const user = users[0];

    if (user.banned) return res.status(403).json({ error: 'User is banned' });

    // 2️⃣ Vérifie le mot de passe
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) return res.status(403).json({ error: 'Invalid password' });

    // 3️⃣ Vérifie la license la plus récente de l’utilisateur
    const [licenses] = await pool.query(
      "SELECT * FROM licenses WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      [user.id]
    );

    let licenseData = null;
    if (licenses.length) {
      const license = licenses[0];
      licenseData = {
        key: license.key_code,
        hwid_locked: license.hwid_locked,
        uses: license.uses,
        allowed_uses: license.allowed_uses,
        banned: license.banned,
        expiry: license.expiry
      };

      if (license.banned) return res.status(403).json({ error: 'License is banned' });
      if (license.expiry && new Date(license.expiry) < new Date())
        return res.status(403).json({ error: 'License has expired' });

      // HWID vérification
      if (license.hwid_locked) {
        if (!license.hwid) {
          await pool.query("UPDATE licenses SET hwid = ? WHERE id = ?", [hwidClean, license.id]);
          licenseData.hwid = hwidClean;
        } else if (license.hwid !== hwidClean) {
          return res.status(403).json({ error: 'HWID mismatch for license' });
        } else {
          licenseData.hwid = license.hwid;
        }
      } else {
        licenseData.hwid = license.hwid || null;
      }
    }

    // 4️⃣ Met à jour la dernière connexion et l’IP
    await pool.query(
      "UPDATE users SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?",
      [clientIP, user.id]
    );

    // 5️⃣ Retourne le résultat
    res.json({
      success: true,
      user_id: user.id,
      username: user.username,
      last_login_ip: clientIP,
      last_login_at: new Date().toISOString(),
      license: licenseData
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}
