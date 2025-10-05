import pool from '../db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { key, email } = req.body;

  if (!key || !email) {
    return res.status(400).json({ error: 'Missing key or email' });
  }

  try {
    const [rows] = await pool.query("SELECT * FROM licenses WHERE key_code = ?", [key]);

    if (!rows.length) {
      return res.json({ valid: false, reason: 'License not found' });
    }

    const license = rows[0];

    // Check if license is bound to another email
    if (license.hwid_locked && license.hwid && license.hwid !== email) {
      return res.json({ valid: false, reason: 'License locked to another email' });
    }

    // Bind license to email if first use
    if (!license.hwid) {
      await pool.query("UPDATE licenses SET hwid = ? WHERE id = ?", [email, license.id]);
    }

    res.json({ valid: true, license });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}
