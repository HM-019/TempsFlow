const API = 'https://tempsflow-api.onrender.com/api';

/* ===========================
   DOM HELPERS
=========================== */
const $ = id => document.getElementById(id);
const fmt = d => d.toString().padStart(2, '0');

function getToken() {
  return sessionStorage.getItem('tf_token');
}

function showToast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${fmt(m)}m`;
}

function formatTime(datetimeStr) {
  if (!datetimeStr) return '—';
  const d = new Date(datetimeStr);
  return `${fmt(d.getHours())}:${fmt(d.getMinutes())}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

function formatDateTime(datetimeStr) {
  if (!datetimeStr) return '—';
  const d = new Date(datetimeStr);
  return `${fmt(d.getDate())}/${fmt(d.getMonth()+1)} ${fmt(d.getHours())}:${fmt(d.getMinutes())}`;
}

const typeMap = {
  forgot_clock_in:  'Arrivée incorrecte',
  forgot_clock_out: 'Départ incorrect',
};

/* ===========================
   FETCH EMPLOYEES
=========================== */
async function fetchEmployees(filter = '') {
  const tbody = $('admin-emp-body-dash');
  const month = $('dashboard-month-select').value;

  try {
    const res = await fetch(`${API}/admin/users`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await res.json();
    if (!res.ok) { tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Erreur de chargement</td></tr>`; return; }

    let users = data.users;
    if (filter) {
      users = users.filter(u =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(filter.toLowerCase())
      );
    }

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Aucun utilisateur trouvé</td></tr>`;
      return;
    }

    // Fetch shift summary for each user in parallel
    const rows = await Promise.all(users.map(async u => {
      try {
        const sRes = await fetch(`${API}/admin/shifts/${u.id}/month/${month}`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        const sData = await sRes.json();
        const shifts = sData.shifts || [];
        const totalMinutes = shifts.reduce((acc, s) => acc + (s.worked_hours || 0), 0);
        const daysWorked   = shifts.length;
        return { u, totalMinutes, daysWorked };
      } catch {
        return { u, totalMinutes: 0, daysWorked: 0 };
      }
    }));

    tbody.innerHTML = rows.map(({ u, totalMinutes, daysWorked }) => `
      <tr class="clickable-row" onclick="openEmployeeDetail(${u.id})">
        <td><strong>${u.first_name} ${u.last_name}</strong></td>
        <td>${u.role === 'admin' ? 'Administrateur' : 'Employé'}</td>
        <td>${formatMinutes(totalMinutes)}</td>
        <td>${daysWorked} jour(s)</td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Erreur réseau</td></tr>`;
  }
}

/* ===========================
   EMPLOYEE DETAIL
=========================== */
let currentDetailUserId = null;

async function openEmployeeDetail(userId) {
  currentDetailUserId = userId;
  navigate('admin-employee-detail');

  try {
    // Get user info
    const uRes = await fetch(`${API}/admin/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    const uData = await uRes.json();
    const user  = uData.user;

    $('detail-emp-name').textContent = `${user.first_name} ${user.last_name}`;
    $('detail-emp-role').textContent = user.role === 'admin' ? 'Administrateur' : 'Employé';

    const month = $('detail-month-select').value;
    await loadDetailData(userId, month);

  } catch (err) {
    showToast('Erreur de chargement', 'error');
  }
}

async function loadDetailData(userId, month) {
  // Load shifts
  const tbody = $('detail-shifts-body');
  tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Chargement...</td></tr>`;

  try {
    const [shiftsRes, salaryRes] = await Promise.all([
      fetch(`${API}/admin/shifts/${userId}/month/${month}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      }),
      fetch(`${API}/admin/users/${userId}/salary/${month}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      }),
    ]);

    const shiftsData = await shiftsRes.json();
    const salaryData = await salaryRes.json();

    const shifts = shiftsData.shifts || [];
    const totalMinutes = shifts.reduce((acc, s) => acc + (s.worked_hours || 0), 0);

    $('detail-done').textContent = formatMinutes(totalMinutes);
    $('detail-days').textContent = shifts.length;

    // Salary cards
    if (salaryRes.ok) {
      $('detail-salary').textContent      = salaryData.contract_salary.toFixed(2) + '€';
      $('detail-salary-hint').textContent = `sur ${salaryData.contract_salary_max.toFixed(2)}€ · ${salaryData.contract_hours}h contrat`;

      if (salaryData.extra_hours > 0) {
        $('detail-extra-card').style.display    = '';
        $('detail-extra-salary').textContent    = salaryData.extra_salary.toFixed(2) + '€';
        $('detail-extra-hint').textContent      = `${salaryData.extra_hours.toFixed(1)}h sup. × 8€/h`;
      } else {
        $('detail-extra-card').style.display = 'none';
      }
    }

    // Shifts table
    if (!shifts.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Aucun pointage ce mois</td></tr>`;
      return;
    }

    tbody.innerHTML = shifts.map(s => `
      <tr>
        <td>${formatDate(s.work_date)}</td>
        <td>${formatTime(s.clock_in)}</td>
        <td>${formatTime(s.clock_out)}</td>
        <td>${formatMinutes(s.worked_hours || 0)}</td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Erreur de chargement</td></tr>`;
  }
}

/* ===========================
   CORRECTIONS
=========================== */

/* ===========================
   CREATE USER
=========================== */
async function createUser() {
  const first_name     = $('new-first-name').value.trim();
  const last_name      = $('new-last-name').value.trim();
  const username       = $('new-username').value.trim();
  const password       = $('new-password').value.trim();
  const contract_hours = parseInt($('new-contract-hours').value);
  const role           = $('new-role').value;

  if (!first_name || !last_name || !username || !password || !contract_hours) {
    showToast('Veuillez remplir tous les champs', 'error');
    return;
  }

  try {
    const res = await fetch(`${API}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ first_name, last_name, username, password, contract_hours, role })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erreur lors de la création', 'error');
      return;
    }

    showToast(`Compte créé pour ${first_name} ${last_name}`, 'success');
    $('new-first-name').value     = '';
    $('new-last-name').value      = '';
    $('new-username').value       = '';
    $('new-password').value       = '';
    $('new-contract-hours').value = '';
    $('new-role').value           = 'employee';

  } catch (err) {
    showToast('Erreur réseau', 'error');
  }
}

/* ===========================
   NAVIGATION
=========================== */
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.add('active');
    target.classList.remove('hidden');
  }

  const navItem = document.querySelector(`[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  if (page === 'admin-dashboard')   fetchEmployees();
}

/* ===========================
   INIT
=========================== */
function init() {
  const token    = sessionStorage.getItem('tf_token');
  const role     = sessionStorage.getItem('tf_role');
  const userJson = sessionStorage.getItem('tf_user');

  if (!token || role !== 'admin') {
    window.location.href = '../login/login.html';
    return;
  }

  const user = userJson ? JSON.parse(userJson) : null;

  if (user) {
    const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    $('sidebar-name').textContent   = `${user.first_name} ${user.last_name}`;
    $('sidebar-role').textContent   = 'Administrateur';
    $('sidebar-avatar').textContent = initials;
  }

  const now = new Date();
  $('admin-date').textContent = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // Set month selects to current month
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  $('dashboard-month-select').value = currentMonth;
  $('detail-month-select').value    = currentMonth;

  fetchEmployees();
}

/* ===========================
   EVENTS
=========================== */
document.addEventListener('DOMContentLoaded', () => {
  init();

  // Hamburger
  const hamburger = document.getElementById('hamburger-btn');
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebar-overlay');

  if (hamburger) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('show');
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  }

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigate(item.dataset.page);
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  });

  // Back button
  $('back-to-dashboard').addEventListener('click', () => navigate('admin-dashboard'));

  // Reset password
  $('reset-password-btn').addEventListener('click', async () => {
    const new_password = $('reset-password-input').value.trim();

    if (!new_password) {
      showToast('Veuillez entrer un nouveau mot de passe', 'error');
      return;
    }

    if (!currentDetailUserId) {
      showToast('Aucun employé sélectionné', 'error');
      return;
    }

    try {
      const res = await fetch(`${API}/admin/users/${currentDetailUserId}/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ new_password })
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Erreur lors de la réinitialisation', 'error');
        return;
      }

      showToast('Mot de passe réinitialisé avec succès', 'success');
      $('reset-password-input').value = '';

    } catch (err) {
      showToast('Erreur réseau', 'error');
    }
  });

  // Month filter on dashboard
  $('dashboard-month-select').addEventListener('change', () => fetchEmployees());

  // Month filter on detail page
  $('detail-month-select').addEventListener('change', e => {
    if (currentDetailUserId) loadDetailData(currentDetailUserId, e.target.value);
  });

  // Employee search
  $('emp-search-dash').addEventListener('input', e => fetchEmployees(e.target.value));

  // Create user
  $('create-user-btn').addEventListener('click', createUser);

  // Logout
  $('logout-btn').addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = '../login/login.html';
  });
});