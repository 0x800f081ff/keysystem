import pool from '../../db.js';

// Helper to parse time like "10s", "5m", "3h", "2d", "1y"
function parseDuration(input) {
  if (!input || input === '0') return null; // Lifetime
  const match = input.match(/^(\d+)([smhdy])$/i);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  let ms = 0;
  switch (unit) {
    case 's': ms = value * 1000; break;
    case 'm': ms = value * 60 * 1000; break;
    case 'h': ms = value * 60 * 60 * 1000; break;
    case 'd': ms = value * 24 * 60 * 60 * 1000; break;
    case 'y': ms = value * 365 * 24 * 60 * 60 * 1000; break;
  }
  return new Date(Date.now() + ms);
}

// Format expiry as human readable (e.g. "in 5 days" or "Lifetime")
function formatExpiry(expiry) {
  if (!expiry) return 'Lifetime';
  const now = new Date();
  const diffMs = new Date(expiry) - now;
  if (diffMs <= 0) return 'Expired';

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const diffMinutes = Math.floor((diffMs / (1000 * 60)) % 60);

  if (diffDays > 0) return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  if (diffHours > 0) return `in ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  if (diffMinutes > 0) return `in ${diffMinutes} min${diffMinutes > 1 ? 's' : ''}`;
  return 'soon';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token, action, user_id, license_key, allowed_uses, time_valid } = req.body;
  if (token !== process.env.ADMIN_TOKEN) return res.status(403).json({ error: 'Unauthorized' });

  try {
    let msg = '';

    if (action === 'generate') {
      const key = (Math.random().toString(36).substring(2, 17) + Math.random().toString(36).substring(2, 17)).toUpperCase();
      const expiry = parseDuration(time_valid);
      await pool.query(
        "INSERT INTO licenses (key_code, allowed_uses, hwid_locked, expiry) VALUES (?,?,?,?)",
        [key, allowed_uses || 1, 1, expiry]
      );
      msg = `License generated: ${key}`;
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
      msg = `User ${user_id} and linked licenses deleted.`;
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
      created_at: new Date(u.created_at).toLocaleString('en-GB', { hour12: false }),
      last_login_at: u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-GB', { hour12: false }) : 'N/A'
    }));

    const licenses = await Promise.all(
      licensesRaw.map(async l => {
        if (l.user_id) {
          const [u] = await pool.query("SELECT id,username,email FROM users WHERE id=?", [l.user_id]);
          l.user = u[0] || null;
          l.email = u[0]?.email || null;
        } else {
          l.user = null;
          l.email = null;
        }
        l.expiry = formatExpiry(l.expiry);
        return l;
      })
    );

    res.json({ msg, users, licenses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}
