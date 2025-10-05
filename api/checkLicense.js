import pool from '../db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { key, email } = req.body; // replace hwid with email
  if (!key || !email) {
    return res.status(400).json({ error: 'Missing key or email' });
  }

  try {
    const [rows] = await pool.query("SELECT * FROM licenses WHERE key_code = ?", [key]);

    if (!rows.length) {
      return res.json({ valid: false, reason: 'License not found' });
    }

    const license = rows[0];

    // Check email lock if hwid_locked is set
    if (license.hwid_locked && license.hwid && license.hwid !== email) {
      return res.json({ valid: false, reason: 'License bound to another email' });
    }

    // Bind email if first use
    if (!license.hwid) {
      await pool.query("UPDATE licenses SET hwid = ? WHERE id = ?", [email, license.id]);
    }

    // Return cleaned license object
    const licenseData = {
      key: license.key_code,
      email: license.hwid || null,
      hwid_locked: license.hwid_locked,
      uses: license.uses,
      allowed_uses: license.allowed_uses,
      banned: license.banned,
      expiry: license.expiry
    };

    res.json({ valid: true, license: licenseData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}
