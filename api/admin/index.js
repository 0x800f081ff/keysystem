import pool from '../../db.js';

function formatDate(d) {
  if (!d) return 'N/A';
  const date = new Date(d);
  return date.toLocaleString('en-GB', { hour12: false });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, action, user_id, license_key, allowed_uses, days_valid } = req.body;

  if (token !== process.env.ADMIN_TOKEN) return res.status(403).json({ error: 'Unauthorized' });

  try {
    let msg = '';

    if (action === 'generate') {
      const key = (Math.random().toString(36).substring(2, 17) + Math.random().toString(36).substring(2, 17)).toUpperCase();
      const expiry = days_valid > 0 ? new Date(Date.now() + days_valid * 24 * 60 * 60 * 1000) : null;

      await pool.query(
        "INSERT INTO licenses (key_code, allowed_uses, hwid_locked, expiry) VALUES (?,?,?,?)",
        [key, allowed_uses || 1, 1, expiry]
      );
      msg = `License generated (HWID locked): ${key}`;
    }

    else if (action === 'ban_user' && user_id) {
      await pool.query("UPDATE users SET banned=1 WHERE id=?", [user_id]);
      await pool.query("UPDATE licenses SET banned=1 WHERE user_id=?", [user_id]);
      msg = `User ${user_id} banned and linked licenses also banned.`;
    } 
    else if (action === 'unban_user' && user_id) {
      await pool.query("UPDATE users SET banned=0 WHERE id=?", [user_id]);
      await pool.query("UPDATE licenses SET banned=0 WHERE user_id=?", [user_id]);
      msg = `User ${user_id} unbanned and linked licenses also unbanned.`;
    } 
    else if (action === 'delete_user' && user_id) {
      await pool.query("DELETE FROM licenses WHERE user_id=?", [user_id]);
      await pool.query("DELETE FROM users WHERE id=?", [user_id]);
      msg = `User ${user_id} and all linked licenses deleted.`;
    } 
    else if ((action === 'ban_key' || action === 'unban_key') && license_key) {
      const banned = action === 'ban_key' ? 1 : 0;
      await pool.query("UPDATE licenses SET banned=? WHERE key_code=?", [banned, license_key]);
      msg = `License ${license_key} ${banned ? 'banned' : 'unbanned'}.`;
    } 
    else if (action === 'delete_key' && license_key) {
      await pool.query("DELETE FROM licenses WHERE key_code=?", [license_key]);
      msg = `License ${license_key} deleted.`;
    }

    const [usersRaw] = await pool.query(
      "SELECT id,username,email,is_admin,banned,created_at,last_login_at,last_login_ip FROM users ORDER BY id DESC"
    );
    const [licensesRaw] = await pool.query("SELECT * FROM licenses ORDER BY id DESC");

    const users = usersRaw.map(u => ({
      ...u,
      created_at: formatDate(u.created_at),
      last_login_at: formatDate(u.last_login_at)
    }));

    const licenses = await Promise.all(
      licensesRaw.map(async l => {
        if (l.user_id) {
          const [u] = await pool.query("SELECT id,username,email FROM users WHERE id=?", [l.user_id]);
          l.user = u[0] || null;
        } else l.user = null;
        l.expiry = formatDate(l.expiry);
        return l;
      })
    );

    res.json({ msg, users, licenses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};
