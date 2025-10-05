import pool from '../../db.js';

export default async function handler(req, res) {
  // Check token from POST
  const token = req.body.token || '';
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(403).send('Unauthorized. Provide correct admin token.');
  }

  const action = req.body.action || '';
  let msg = '';

  try {
    if (action === 'generate') {
      const key = crypto.randomBytes(15).toString('hex').toUpperCase();
      const allowed_uses = parseInt(req.body.allowed_uses) || 1;
      const hwid_locked = req.body.hwid_locked ? 1 : 0;
      const days = parseInt(req.body.days_valid) || 0;
      const expiry = days > 0 ? new Date(Date.now() + 86400*1000*days) : null;

      await pool.query(
        "INSERT INTO licenses (key_code, allowed_uses, hwid_locked, expiry) VALUES (?,?,?,?)",
        [key, allowed_uses, hwid_locked, expiry]
      );
      msg = `License generated: ${key} (expiry: ${expiry})`;
    } 
    else if (action === 'ban_user' || action === 'unban_user') {
      const id = parseInt(req.body.user_id);
      await pool.query("UPDATE users SET banned=? WHERE id=?", [action==='ban_user'?1:0, id]);
      msg = `User ${id} ${action==='ban_user'?'banned':'unbanned'}.`;
    } 
    else if (action === 'ban_key' || action === 'unban_key') {
      const key = req.body.license_key || '';
      await pool.query("UPDATE licenses SET banned=? WHERE key_code=?", [action==='ban_key'?1:0, key]);
      msg = `License ${key} ${action==='ban_key'?'banned':'unbanned'}.`;
    }

    // Fetch current users & licenses
    const [users] = await pool.query("SELECT id,username,email,is_admin,banned,created_at,last_login_at,last_login_ip FROM users ORDER BY id DESC");
    const [licenses] = await pool.query("SELECT id,key_code,allowed_uses,uses,hwid_locked,hwid,expiry,banned,user_id FROM licenses ORDER BY id DESC");

    res.status(200).json({ msg, users, licenses });

  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}
