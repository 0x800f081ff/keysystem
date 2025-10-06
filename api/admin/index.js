import pool from '../../db.js';

// Converts strings like 10s / 10m / 10h / 10d / 10y to milliseconds
function parseTimeDuration(str) {
  if (!str || str === '0') return null; // Lifetime
  const match = str.match(/(\d+)([smhdy])/i);
  if (!match) return null;

  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers = {
    s: 1000,
    m: 1000 * 60,
    h: 1000 * 60 * 60,
    d: 1000 * 60 * 60 * 24,
    y: 1000 * 60 * 60 * 24 * 365,
  };

  return num * multipliers[unit];
}

function formatDate(d) {
  if (!d) return 'Lifetime';
  const date = new Date(d);
  if (isNaN(date)) return 'Lifetime';
  return date.toISOString(); // keep ISO for countdown calculations
}

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { token, action, user_id, license_key, allowed_uses, time_valid } = req.body;

  if (token !== process.env.ADMIN_TOKEN)
    return res.status(403).json({ error: 'Unauthorized' });

  try {
    let msg = '';

    // Generate license
    if (action === 'generate') {
      const key = (Math.random().toString(36).substring(2, 17) + Math.random().toString(36).substring(2, 17)).toUpperCase();
      const durationMs = parseTimeDuration(time_valid);
      const expiry = durationMs ? new Date(Date.now() + durationMs) : null;

      await pool.query(
        "INSERT INTO licenses (key_code, allowed_uses, hwid_locked, expiry) VALUES (?, ?, ?, ?)",
        [key, allowed_uses || 1, 1, expiry] // HWID locked always on
      );

      msg = `License generated: ${key}`;
    }
    // Ban / unban user + linked licenses
    else if (action === 'ban_user' && user_id) {
      await pool.query("UPDATE users SET banned=1 WHERE id=?", [user_id]);
      await pool.query("UPDATE licenses SET banned=1 WHERE user_id=?", [user_id]);
      msg = `User ${user_id} banned and linked licenses also banned.`;
    } else if (action === 'unban_user' && user_id) {
      await pool.query("UPDATE users SET banned=0 WHERE id=?", [user_id]);
      await pool.query("UPDATE licenses SET banned=0 WHERE user_id=?", [user_id]);
      msg = `User ${user_id} unbanned and linked licenses also unbanned.`;
    }
    // Delete user + linked licenses
    else if (action === 'delete_user' && user_id) {
      await pool.query("DELETE FROM licenses WHERE user_id=?", [user_id]);
      await pool.query("DELETE FROM users WHERE id=?", [user_id]);
      msg = `User ${user_id} and all linked licenses deleted.`;
    }
    // Ban / unban license
    else if ((action === 'ban_key' || action === 'unban_key') && license_key) {
      const banned = action === 'ban_key' ? 1 : 0;
      await pool.query("UPDATE licenses SET banned=? WHERE key_code=?", [banned, license_key]);
      msg = `License ${license_key} ${banned ? 'banned' : 'unbanned'}.`;
    }
    // Delete license
    else if (action === 'delete_key' && license_key) {
      await pool.query("DELETE FROM licenses WHERE key_code=?", [license_key]);
      msg = `License ${license_key} deleted.`;
    }

    // Fetch users
    const [usersRaw] = await pool.query(
      "SELECT id,username,email,is_admin,banned,created_at,last_login_at,last_login_ip FROM users ORDER BY id DESC"
    );

    const [licensesRaw] = await pool.query("SELECT * FROM licenses ORDER BY id DESC");

    const users = usersRaw.map(u => ({
      ...u,
      created_at: new Date(u.created_at).toLocaleString('en-GB', { hour12: false }),
      last_login_at: u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-GB', { hour12: false }) : null
    }));

    const licenses = await Promise.all(
      licensesRaw.map(async l => {
        // Attach user
        if (l.user_id) {
          const [u] = await pool.query("SELECT id,username,email FROM users WHERE id=?", [l.user_id]);
          l.user = u[0] || null;
          l.email = l.user ? l.user.email : 'Not Linked';
        } else {
          l.user = null;
          l.email = 'Not Linked';
        }

        // Expiry formatting
        let expiryDisplay = 'Lifetime';
        if (l.expiry) {
          const exp = new Date(l.expiry);
          if (exp < new Date()) expiryDisplay = 'Expired';
          else {
            const now = Date.now();
            const diff = exp - now;
            const seconds = Math.floor(diff / 1000);
            if (seconds < 60) expiryDisplay = `${seconds}s`;
            else if (seconds < 3600) expiryDisplay = `${Math.floor(seconds/60)}m`;
            else if (seconds < 86400) expiryDisplay = `${Math.floor(seconds/3600)}h`;
            else if (seconds < 86400*30) expiryDisplay = `${Math.floor(seconds/86400)}d`;
            else if (seconds < 86400*365) expiryDisplay = `${Math.floor(seconds/(86400*30))}M`;
            else expiryDisplay = `${Math.floor(seconds/(86400*365))}y`;
          }
        }

        l.expiry_raw = l.expiry ? new Date(l.expiry).toISOString() : 'Lifetime';
        l.expiry = expiryDisplay;

        return l;
      })
    );

    res.json({ msg, users, licenses });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}
