const $ = (sel) => document.querySelector(sel);
const habitList = $('#habit-list');
const addHabitBtn = $('#add-habit-btn');
const toggleDarkModeBtn = $('#toggle-dark-mode');
const body = document.body;

const state = { habits: [], xp: 0 };
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const EMOJIS = ['💪', '📚', '🧘', '💧', '🏃', '🥗', '😴', '✍️', '🎨', '🎸'];
const XP_PER_LEVEL = 100;

const BADGES = [
  { id: 'first',   icon: '🌱', name: 'First Step',   desc: 'Earn your first XP',       test: (s) => s.xp > 0 },
  { id: 'week',    icon: '🔥', name: 'On Fire',      desc: '7-day streak',             test: (s) => s.habits.some((h) => h.best >= 7) },
  { id: 'month',   icon: '🏆', name: 'Unstoppable',  desc: '30-day streak',            test: (s) => s.habits.some((h) => h.best >= 30) },
  { id: 'perfect', icon: '💯', name: 'Perfect Week', desc: '100% in the last 7 days',  test: (s) => s.habits.some((h) => h.progress === 100) },
  { id: 'lvl5',    icon: '⭐', name: 'Rising Star',  desc: 'Reach level 5',            test: (s) => levelOf(s.xp) >= 5 },
];

// ---------- Helpers ----------
const levelOf = (xp) => Math.floor(xp / XP_PER_LEVEL) + 1;

// Local date (not UTC) so "today" matches the user's calendar day
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

async function api(path, options = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

function toast(message, type = 'info') {
  const node = el('div', `toast ${type}`, message);
  $('#toasts').appendChild(node);
  setTimeout(() => node.remove(), 3000);
}

function confetti() {
  const colors = ['#34d399', '#f59e0b', '#60a5fa', '#f472b6', '#a78bfa'];
  for (let i = 0; i < 40; i++) {
    const piece = el('i', 'confetti');
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = Math.random() * 0.3 + 's';
    piece.style.setProperty('--dx', Math.random() * 200 - 100 + 'px');
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2200);
  }
}

const unlockedBadges = () => new Set(BADGES.filter((b) => b.test(state)).map((b) => b.id));

// ---------- Data ----------
async function load() {
  try {
    const data = await api(`/api/habits?today=${localDate()}`);
    if (!Array.isArray(data.habits)) {
      throw new Error('Old server detected. Restart with the new server.js');
    }
    state.habits = data.habits;
    state.xp = data.xp;
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function toggleHabit(habit) {
  const levelBefore = levelOf(state.xp);
  const badgesBefore = unlockedBadges();
  try {
    const data = await api(`/api/habits/${habit.id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ date: localDate() }),
    });
    state.xp = data.xp;
    state.habits[state.habits.findIndex((h) => h.id === habit.id)] = data.habit;
    render();

    if (data.gained > 0) {
      confetti();
      toast(`+${data.gained} XP 🎉`, 'success');
      if (levelOf(state.xp) > levelBefore) toast(`Level up! You're now level ${levelOf(state.xp)} ⭐`, 'success');
      BADGES.filter((b) => b.test(state) && !badgesBefore.has(b.id))
        .forEach((b) => toast(`Badge unlocked: ${b.icon} ${b.name}`, 'success'));
    } else {
      toast('Completion undone');
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteHabit(habit) {
  if (!confirm(`Delete "${habit.name}"? Your earned XP is kept.`)) return;
  try {
    await api(`/api/habits/${habit.id}`, { method: 'DELETE' });
    toast('Habit deleted');
    load();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ---------- Rendering ----------
function render() {
  renderStats();
  renderHabits();
  renderBadges();
  renderChart();
}

function renderStats() {
  const inLevel = state.xp % XP_PER_LEVEL;
  $('#level').textContent = levelOf(state.xp);
  $('#xp-text').textContent = `${inLevel} / ${XP_PER_LEVEL}`;
  $('#xp-fill').style.width = `${inLevel}%`;
  $('#today-stat').textContent = `${state.habits.filter((h) => h.doneToday).length}/${state.habits.length}`;
  $('#best-stat').textContent = Math.max(0, ...state.habits.map((h) => h.best));
}

function renderHabits() {
  habitList.replaceChildren();

  if (!state.habits.length) {
    habitList.append(el('p', 'empty', 'No habits yet. Add your first one to start earning XP!'));
    return;
  }

  for (const habit of state.habits) {
    const card = el('div', 'card habit-card' + (habit.doneToday ? ' done' : ''));

    const top = el('div', 'card-top');
    top.append(
      el('span', 'emoji', habit.emoji),
      el('h3', null, habit.name),
      el('span', 'streak', `🔥 ${habit.streak} day${habit.streak === 1 ? '' : 's'} · best ${habit.best}`)
    );

    const week = el('div', 'week');
    for (const day of habit.week) {
      const dot = el('span', 'dot' + (day.done ? ' on' : ''), DAYS[new Date(day.date + 'T00:00:00').getDay()]);
      dot.title = day.date;
      week.append(dot);
    }

    const bar = el('div', 'progress-bar');
    const fill = el('div', 'progress-bar-fill');
    fill.style.width = `${habit.progress}%`;
    bar.append(fill);

    const actions = el('div', 'card-actions');
    const completeBtn = el('button', habit.doneToday ? '' : 'primary-btn', habit.doneToday ? '↩ Undo' : 'Mark Complete ✓');
    completeBtn.onclick = () => toggleHabit(habit);
    const deleteBtn = el('button', 'delete-btn', 'Delete');
    deleteBtn.onclick = () => deleteHabit(habit);
    actions.append(completeBtn, deleteBtn);

    card.append(top, week, bar, el('p', 'progress-label', `${habit.progress}% this week`), actions);
    habitList.append(card);
  }
}

function renderBadges() {
  const box = $('#badges');
  box.replaceChildren();
  const unlocked = unlockedBadges();
  for (const b of BADGES) {
    const item = el('div', 'badge' + (unlocked.has(b.id) ? '' : ' locked'));
    item.append(el('span', 'icon', b.icon), el('strong', null, b.name), el('small', null, b.desc));
    box.append(item);
  }
}

function renderChart() {
  const card = $('#chart-card');
  card.hidden = !state.habits.length;
  if (!state.habits.length) return;

  const box = $('#chart');
  box.replaceChildren();
  const max = state.habits.length;

  state.habits[0].week.forEach((d, i) => {
    const count = state.habits.filter((h) => h.week[i].done).length;
    const track = el('div', 'bar-track');
    const bar = el('div', 'bar');
    bar.style.height = `${(count / max) * 100}%`;
    track.append(bar);

    const label = new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });
    const col = el('div', 'bar-col');
    col.append(el('span', 'bar-value', count), track, el('span', 'bar-label', label));
    box.append(col);
  });
}

// ---------- Add-habit dialog ----------
const dialog = $('#habit-dialog');
const form = $('#habit-form');
const nameInput = $('#habit-name');
let chosenEmoji = EMOJIS[0];

function buildPicker() {
  const picker = $('#emoji-picker');
  picker.replaceChildren();
  for (const e of EMOJIS) {
    const btn = el('button', e === chosenEmoji ? 'selected' : '', e);
    btn.type = 'button';
    btn.onclick = () => { chosenEmoji = e; buildPicker(); };
    picker.append(btn);
  }
}

addHabitBtn.onclick = () => {
  form.reset();
  buildPicker();
  dialog.showModal();
  nameInput.focus();
};
$('#cancel-btn').onclick = () => dialog.close();

form.onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api(`/api/habits?today=${localDate()}`, {
      method: 'POST',
      body: JSON.stringify({ name: nameInput.value, emoji: chosenEmoji }),
    });
    dialog.close();
    toast('Habit added!', 'success');
    load();
  } catch (err) {
    toast(err.message, 'error');
  }
};

// ---------- Theme ----------
function applyTheme(dark) {
  body.classList.toggle('dark-mode', dark);
  toggleDarkModeBtn.textContent = dark ? '🌞' : '🌙';
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}
toggleDarkModeBtn.onclick = () => applyTheme(!body.classList.contains('dark-mode'));

// ---------- Init ----------
applyTheme(localStorage.getItem('theme') === 'dark');
load();
// Refresh when returning to the tab (handles the day rolling over at midnight)
document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });