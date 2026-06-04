const API = 'http://localhost:3000/api';

/* ===========================
   STATE
=========================== */
let isClockedIn    = false;
let clockInTime    = null;
let currentShiftId = null;
let sessionInterval = null;
let clockInterval   = null;
let editingShiftId  = null;

const state = {
  todayShifts: [],
};

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

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${fmt(h)}:${fmt(m)}:${fmt(sec)}`;
}

function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${fmt(m)}m`;
}

function formatHM(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
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

/* ===========================
   LIVE CLOCK
=========================== */
function startClock() {
  clockInterval = setInterval(() => {
    const now = new Date();
    $('live-clock').textContent = `${fmt(now.getHours())}:${fmt(now.getMinutes())}:${fmt(now.getSeconds())}`;
  }, 1000);
}

/* ===========================
   FETCH SUMMARY STATS
=========================== */
async function fetchStats() {
  try {
    const month   = String(new Date().getMonth() + 1).padStart(2, '0');
    const token   = getToken();
    const headers = { 'Authorization': `Bearer ${token}` };

    const [weekRes, monthRes] = await Promise.all([
      fetch(`${API}/shifts/summary/week`,           { headers }),
      fetch(`${API}/shifts/summary/month/${month}`, { headers }),
    ]);

    if (weekRes.ok) {
      const weekData = await weekRes.json();
      $('week-hours').textContent = formatMinutes(weekData.worked_minutes);
    }

    if (monthRes.ok) {
      const monthData = await monthRes.json();
      $('month-hours').textContent      = formatMinutes(monthData.worked_minutes);
      $('month-days-hint').textContent  = `${monthData.days_worked} jour(s) travaillé(s)`;
    }
  } catch (err) {
    console.error('Stats fetch error:', err);
  }
}

/* ===========================
   SALARY
=========================== */
async function fetchSalary() {
  try {
    const token = getToken();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const res = await fetch(`${API}/shifts/salary/${month}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) return;

    const data = await res.json();

    $('contract-salary').textContent       = data.contract_salary.toFixed(2) + '€';
    $('contract-salary-hint').textContent  = `sur ${data.contract_salary_max.toFixed(2)}€`;
    $('contract-progress-bar').style.width = data.progress + '%';
    $('contract-hours-hint').textContent   = `${data.worked_hours_real.toFixed(1)}h / ${data.contract_hours}h contractuelles`;

    if (data.extra_hours > 0) {
      $('extra-salary-card').style.display = '';
      $('extra-salary').textContent        = data.extra_salary.toFixed(2) + '€';
      $('extra-salary-hint').textContent   = `${data.extra_hours.toFixed(1)}h sup. × 8€/h`;
    } else {
      $('extra-salary-card').style.display = 'none';
    }
  } catch (err) {
    console.error('Salary fetch error:', err);
  }
}

/* ===========================
   CLOCK IN / OUT
=========================== */
async function clockIn() {
  if (isClockedIn) return;

  try {
    const work_date = new Date().toISOString().split('T')[0];
    const res = await fetch(`${API}/shifts/clock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ work_date })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erreur lors du pointage', 'error');
      return;
    }

    isClockedIn    = true;
    currentShiftId = data.shift.id;
    clockInTime    = new Date();

    // Persist clock-in state
    localStorage.setItem('tf_clocked_in', 'true');
    localStorage.setItem('tf_shift_id', data.shift.id);
    localStorage.setItem('tf_clock_in_time', new Date().toISOString());

    $('clock-in-btn').disabled = true;
    $('clock-out-btn').disabled = false;

    sessionInterval = setInterval(() => {
      const elapsed = Date.now() - clockInTime.getTime();
      $('session-timer').textContent = `Session : ${formatDuration(elapsed)}`;
      $('today-hours').textContent   = formatHM(elapsed);

      // Update salary live every minute
      if (Math.floor(elapsed / 60000) !== Math.floor((elapsed - 1000) / 60000)) {
        fetchSalary();
      }
    }, 1000);

    showToast(`Arrivée pointée à ${fmt(clockInTime.getHours())}:${fmt(clockInTime.getMinutes())}`, 'success');

  } catch (err) {
    showToast('Erreur réseau', 'error');
  }
}

async function clockOut() {
  if (!isClockedIn || !currentShiftId) return;

  try {
    const res = await fetch(`${API}/shifts/clock-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ shift_id: currentShiftId })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erreur lors du pointage', 'error');
      return;
    }

    const outTime  = new Date();
    const duration = outTime - clockInTime;

    isClockedIn = false;

    // Clear clock-in state
    localStorage.removeItem('tf_clocked_in');
    localStorage.removeItem('tf_shift_id');
    localStorage.removeItem('tf_clock_in_time');

    clearInterval(sessionInterval);
    $('session-timer').textContent  = 'Session : 00:00:00';
    $('clock-in-btn').disabled      = false;
    $('clock-out-btn').disabled     = true;

    state.todayShifts.push({
      id:       currentShiftId,
      in:       `${fmt(clockInTime.getHours())}:${fmt(clockInTime.getMinutes())}`,
      out:      `${fmt(outTime.getHours())}:${fmt(outTime.getMinutes())}`,
      duration: formatHM(duration),
    });

    clockInTime    = null;
    currentShiftId = null;

    renderTodayShifts();
    fetchSalary();
    fetchStats();
    showToast(`Départ pointé à ${fmt(outTime.getHours())}:${fmt(outTime.getMinutes())}`, 'success');

  } catch (err) {
    showToast('Erreur réseau', 'error');
  }
}

/* ===========================
   RENDER TODAY SHIFTS
=========================== */
function renderTodayShifts() {
  const tbody = $('today-shifts-body');
  if (!state.todayShifts.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Aucun pointage aujourd'hui</td></tr>`;
    return;
  }
  tbody.innerHTML = state.todayShifts.map(s => `
    <tr>
      <td>${s.in}</td>
      <td>${s.out}</td>
      <td>${s.duration}</td>
      <td><button class="btn-reject" style="font-size:11px" onclick="openEditModal(${s.id})">Corriger</button></td>
    </tr>
  `).join('');
}

/* ===========================
   HISTORY
=========================== */
async function fetchHistory(month) {
  const tbody = $('history-body');
  tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Chargement...</td></tr>`;

  try {
    const res = await fetch(`${API}/shifts/me/month/${month}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    const data = await res.json();

    if (!res.ok || !data.shifts.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Aucun pointage ce mois</td></tr>`;
      return;
    }

    tbody.innerHTML = data.shifts.map(s => `
      <tr>
        <td>${formatDate(s.work_date)}</td>
        <td>${formatTime(s.clock_in)}</td>
        <td>${formatTime(s.clock_out)}</td>
        <td>${formatMinutes(s.worked_hours || 0)}</td>
        <td><button class="btn-reject" style="font-size:11px" onclick="openEditModal(${s.id})">Corriger</button></td>
      </tr>
    `).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-row">Erreur de chargement</td></tr>`;
  }
}

/* ===========================
   MANUAL SHIFT
=========================== */
async function addManualShift() {
  const work_date  = $('manual-date').value;
  const clock_in   = $('manual-clock-in').value;
  const clock_out  = $('manual-clock-out').value;

  if (!work_date || !clock_in || !clock_out) {
    showToast('Veuillez remplir tous les champs', 'error');
    return;
  }

  try {
    const res = await fetch(`${API}/shifts/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ work_date, clock_in, clock_out })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erreur lors de l\'ajout', 'error');
      return;
    }

    showToast('Jour ajouté avec succès', 'success');
    $('manual-date').value      = '';
    $('manual-clock-in').value  = '';
    $('manual-clock-out').value = '';

    const month = $('history-month-select').value;
    fetchHistory(month);
    fetchStats();
    fetchSalary();

  } catch (err) {
    showToast('Erreur réseau', 'error');
  }
}

/* ===========================
   EDIT SHIFT MODAL
=========================== */
function openEditModal(shiftId) {
  editingShiftId = shiftId;
  $('edit-clock-in').value  = '';
  $('edit-clock-out').value = '';
  $('edit-modal').style.display = 'flex';
}

function closeEditModal() {
  editingShiftId = null;
  $('edit-modal').style.display = 'none';
}

async function saveShiftEdit() {
  const clock_in  = $('edit-clock-in').value;
  const clock_out = $('edit-clock-out').value;

  if (!clock_in || !clock_out) {
    showToast('Veuillez remplir les deux heures', 'error');
    return;
  }

  try {
    const res = await fetch(`${API}/shifts/${editingShiftId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ clock_in, clock_out })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erreur lors de la modification', 'error');
      return;
    }

    showToast('Pointage modifié avec succès', 'success');
    closeEditModal();

    const month = $('history-month-select').value;
    fetchHistory(month);
    fetchStats();
    fetchSalary();

  } catch (err) {
    showToast('Erreur réseau', 'error');
  }
}

/* ===========================
   NAVIGATION
=========================== */
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.add('active');
    target.classList.remove('hidden');
  }

  const navItem = document.querySelector(`[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  if (page === 'emp-history') {
    const month = $('history-month-select').value;
    fetchHistory(month);
  }
}

/* ===========================
   INIT
=========================== */
function init() {
  const token    = sessionStorage.getItem('tf_token');
  const role     = sessionStorage.getItem('tf_role');
  const userJson = sessionStorage.getItem('tf_user');

  if (!token || role !== 'employee') {
    window.location.href = '../login/login.html';
    return;
  }

  const user = userJson ? JSON.parse(userJson) : null;

  if (user) {
    const displayName = `${user.first_name} ${user.last_name}`;
    const initials    = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    $('sidebar-name').textContent   = displayName;
    $('sidebar-role').textContent   = 'Employé';
    $('sidebar-avatar').textContent = initials;
    $('welcome-msg').textContent    = `Bonjour, ${user.first_name} 👋`;
  }

  const now     = new Date();
  const opts    = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const dateStr = now.toLocaleDateString('fr-FR', opts);
  $('today-date').textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  // Set history month select to current month
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  $('history-month-select').value = currentMonth;

  startClock();
  fetchStats();
  fetchSalary();

}

/* ===========================
   EVENTS
=========================== */
document.addEventListener('DOMContentLoaded', () => {
  init();

  // Restore clock-in state  ← add here after init()
  const savedClockedIn   = localStorage.getItem('tf_clocked_in');
  const savedShiftId     = localStorage.getItem('tf_shift_id');
  const savedClockInTime = localStorage.getItem('tf_clock_in_time');

  console.log('Restore check:', savedClockedIn, savedShiftId, savedClockInTime); // ← add this

  if (savedClockedIn && savedShiftId && savedClockInTime) {
    isClockedIn    = true;
    currentShiftId = parseInt(savedShiftId);
    clockInTime    = new Date(savedClockInTime);

    $('clock-in-btn').disabled  = true;
    $('clock-out-btn').disabled = false;

    sessionInterval = setInterval(() => {
      const elapsed = Date.now() - clockInTime.getTime();
      $('session-timer').textContent = `Session : ${formatDuration(elapsed)}`;
      $('today-hours').textContent   = formatHM(elapsed);

      if (Math.floor(elapsed / 60000) !== Math.floor((elapsed - 1000) / 60000)) {
        fetchSalary();
      }
    }, 1000);
  }

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

  $('clock-in-btn').addEventListener('click', clockIn);
  $('clock-out-btn').addEventListener('click', clockOut);

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navigate(item.dataset.page);
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });
  });

  // History month filter
  $('history-month-select').addEventListener('change', e => fetchHistory(e.target.value));

  // Manual shift
  $('add-manual-shift-btn').addEventListener('click', addManualShift);

  // Edit shift modal
  $('save-edit-btn').addEventListener('click', saveShiftEdit);

  // Logout
  $('logout-btn').addEventListener('click', () => {
    clearInterval(sessionInterval);
    clearInterval(clockInterval);
    sessionStorage.clear();
    // Only clear clock-in state if not currently clocked in
    if (!isClockedIn) {
      localStorage.removeItem('tf_clocked_in');
      localStorage.removeItem('tf_shift_id');
      localStorage.removeItem('tf_clock_in_time');
    }
    window.location.href = '../login/login.html';
  });
});