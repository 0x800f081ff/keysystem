import pool from '../db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { key, hwid } = req.body;

  if (!key || !hwid) {
    return res.status(400).json({ error: 'Missing key or HWID' });
  }

  try {
    const [rows] = await pool.query("SELECT * FROM licenses WHERE key_code = ?", [key]);

    if (!rows.length) {
      return res.json({ valid: false, reason: 'License not found' });
    }

    const license = rows[0];

    // Check HWID lock
    if (license.hwid_locked && license.hwid && license.hwid !== hwid) {
      return res.json({ valid: false, reason: 'License locked to another HWID' });
    }

    // Bind HWID if first use
    if (!license.hwid) {
      await pool.query("UPDATE licenses SET hwid = ? WHERE id = ?", [hwid, license.id]);
    }

    res.json({ valid: true, license });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
