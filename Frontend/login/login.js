/* ===========================
   DOM HELPERS
=========================== */
const API_URL = 'https://tempsflow-api.onrender.com';

const $ = id => document.getElementById(id);

function showToast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

/* ===========================
   LOGIN
=========================== */
async function login() {
  const username = $('login-username').value.trim();
  const password = $('login-password').value.trim();

  if (!username || !password) {
    showToast('Veuillez remplir tous les champs', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Identifiants incorrects', 'error');
      return;
    }

    // Store everything from the real backend response
    sessionStorage.setItem('tf_token',    data.token);
    sessionStorage.setItem('tf_username', data.user.username);
    sessionStorage.setItem('tf_role',     data.user.role);
    sessionStorage.setItem('tf_user',     JSON.stringify(data.user));

    if (data.user.role === 'admin') {
      window.location.href = '../admin/admin.html';
    } else {
      window.location.href = '../user/user.html';
    }

  } catch (err) {
    showToast('Erreur réseau, vérifiez que le serveur est en marche', 'error');
  }
}

/* ===========================
   EVENTS
=========================== */
document.addEventListener('DOMContentLoaded', () => {
  $('login-btn').addEventListener('click', login);
  $('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });
});