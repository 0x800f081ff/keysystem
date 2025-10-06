<script>
let adminToken = '';
let countdownIntervals = {};

async function connectAdmin() {
  adminToken = document.getElementById('adminToken').value.trim();
  if(!adminToken) return alert('Enter admin token');
  try {
    const res = await fetch('/api/admin', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token: adminToken, action: 'none' })
    });
    const data = await res.json();
    if(data.error) return alert(data.error);
    document.getElementById('adminContent').classList.remove('hidden');
    renderTables(data);
  } catch(err) {
    alert(err);
  }
}

async function adminAction(action, idOrKey=null) {
  let body = { token: adminToken, action };

  if(action === 'generate') {
    body.allowed_uses = document.getElementById('allowedUses').value;
    body.time_valid = document.getElementById('timeValid').value.trim();
  } else if(action.includes('user')) {
    body.user_id = idOrKey;
  } else if(action.includes('key')) {
    body.license_key = idOrKey;
  }

  try {
    const res = await fetch('/api/admin', {
      method:'POST', 
      headers:{'Content-Type':'application/json'}, 
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if(data.msg) alert(data.msg);
    renderTables(data);
  } catch(err) { alert(err); }
}

// ✅ Utility to start live expiry countdowns
function startCountdown(element, expiryText) {
  if (!expiryText || expiryText === 'Lifetime' || expiryText === 'Expired') {
    element.textContent = expiryText;
    return;
  }

  // Try to parse the original expiry (we’ll assume backend sends “in X days/hours”)
  const match = expiryText.match(/^in (\d+)/);
  if (!match) return (element.textContent = expiryText);

  // Convert relative text to a fake expiry date
  const now = Date.now();
  let expiry = now;
  if (expiryText.includes('day')) expiry += parseInt(match[1]) * 86400000;
  else if (expiryText.includes('hour')) expiry += parseInt(match[1]) * 3600000;
  else if (expiryText.includes('min')) expiry += parseInt(match[1]) * 60000;
  else expiry += 10000; // soon fallback

  // Update countdown every second
  const id = Math.random().toString(36).substring(2, 8);
  countdownIntervals[id] = setInterval(() => {
    const diff = expiry - Date.now();
    if (diff <= 0) {
      clearInterval(countdownIntervals[id]);
      element.textContent = 'Expired';
      return;
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);

    let text = '';
    if (days > 0) text += `${days}d `;
    if (hours > 0 || days > 0) text += `${hours}h `;
    if (mins > 0 || hours > 0 || days > 0) text += `${mins}m `;
    text += `${secs}s`;
    element.textContent = text.trim();
  }, 1000);
}

function renderTables(data) {
  // Clear previous countdowns
  Object.values(countdownIntervals).forEach(clearInterval);
  countdownIntervals = {};

  let html = '<table><tr><th>ID</th><th>Key</th><th>Uses/Allowed</th><th>Email</th><th>Expiry</th><th>Banned</th><th>User</th><th>Actions</th></tr>';
  data.licenses.forEach((l, i)=>{
    html += `<tr>
      <td>${l.id}</td>
      <td>${l.key_code}</td>
      <td>${l.uses}/${l.allowed_uses}</td>
      <td>${l.email || 'N/A'}</td>
      <td id="expiry-${i}">${l.expiry}</td>
      <td>${l.banned}</td>
      <td>${l.user ? l.user.username : 'N/A'}</td>
      <td>
        <button onclick="adminAction('${l.banned? 'unban_key':'ban_key'}','${l.key_code}')">${l.banned? 'Unban':'Ban'}</button>
        <button onclick="adminAction('delete_key','${l.key_code}')">Delete</button>
      </td>
    </tr>`;
  });
  html += '</table>';
  document.getElementById('licensesTable').innerHTML = html;

  // Start countdown timers
  data.licenses.forEach((l, i)=>{
    const el = document.getElementById(`expiry-${i}`);
    if (el) startCountdown(el, l.expiry);
  });

  html = '<table><tr><th>ID</th><th>Username</th><th>Email</th><th>Admin</th><th>Banned</th><th>Created</th><th>Last Login</th><th>IP</th><th>Actions</th></tr>';
  data.users.forEach(u=>{
    html += `<tr>
      <td>${u.id}</td>
      <td>${u.username}</td>
      <td>${u.email}</td>
      <td>${u.is_admin}</td>
      <td>${u.banned}</td>
      <td>${u.created_at}</td>
      <td>${u.last_login_at || 'N/A'}</td>
      <td>${u.last_login_ip || 'N/A'}</td>
      <td>
        <button onclick="adminAction('${u.banned? 'unban_user':'ban_user'}','${u.id}')">${u.banned? 'Unban':'Ban'}</button>
        <button onclick="adminAction('delete_user','${u.id}')">Delete</button>
      </td>
    </tr>`;
  });
  html += '</table>';
  document.getElementById('usersTable').innerHTML = html;
}
</script>
