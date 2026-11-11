const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const VALID_REMINDER = /^([01]\d|2[0-3]):[0-5]\d$/;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Persistence ----------
// habit.log = { 'YYYY-MM-DD': xpAwardedThatDay }
let db = { xp: 0, habits: [{ id: 1, name: 'Exercise', emoji: '💪', log: {} }] };
try {
  db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch {
  /* first run: use defaults */
}
const save = () =>
  fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), (err) => {
    if (err) console.error('Save failed:', err);
  });

// ---------- Date helpers (all dates are 'YYYY-MM-DD' strings) ----------
const isDate = (s) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z'));
const todayOf = (raw) => (isDate(raw) ? raw : new Date().toISOString().slice(0, 10));

const shift = (date, days) => {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Current streak: consecutive days ending today (or yesterday, so the
// streak isn't lost until the day is actually over).
function scheduleDaysOf(habit) {
  if (!Array.isArray(habit.scheduleDays)) return ALL_DAYS;
  const days = [...new Set(habit.scheduleDays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  return days.length ? days : ALL_DAYS;
}

function reminderTimesOf(habit) {
  const values = Array.isArray(habit.reminderTimes) ? habit.reminderTimes : [habit.reminderTime];
  return [...new Set(values.filter((time) => typeof time === 'string' && VALID_REMINDER.test(time)))].sort();
}

const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

function currentStreak(days, today, scheduleDays) {
  const set = new Set(days);
  let cursor = scheduleDays.includes(weekdayOf(today)) && !set.has(today) ? shift(today, -1) : today;
  let n = 0;
  for (let checked = 0; checked < 370; checked++) {
    if (scheduleDays.includes(weekdayOf(cursor))) {
      if (!set.has(cursor)) break;
      n++;
    }
    cursor = shift(cursor, -1);
  }
  return n;
}

function bestStreak(days, scheduleDays) {
  let best = 0, run = 0, prev = null;
  for (const d of [...days].sort()) {
    let nextScheduled = prev ? shift(prev, 1) : null;
    while (nextScheduled && nextScheduled < d && !scheduleDays.includes(weekdayOf(nextScheduled))) {
      nextScheduled = shift(nextScheduled, 1);
    }
    run = prev && nextScheduled === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

// XP: base + streak bonus (capped) + milestone bonus every 7 days
const awardFor = (streak) =>
  10 + Math.min(streak, 10) * 2 + (streak > 0 && streak % 7 === 0 ? 25 : 0);

// ---------- View model ----------
function view(habit, today) {
  const log = habit.log || {};
  const days = Object.keys(log);
  const scheduleDays = scheduleDaysOf(habit);
  const scheduledCompletions = days.filter((date) => scheduleDays.includes(weekdayOf(date)));
  const reminderTimes = reminderTimesOf(habit);
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = shift(today, i - 6);
    return { date, done: date in log, scheduled: scheduleDays.includes(weekdayOf(date)) };
  });
  const scheduledToday = scheduleDays.includes(weekdayOf(today));
  const scheduledDaysThisWeek = week.filter((day) => day.scheduled).length;
  return {
    id: habit.id,
    name: habit.name,
    emoji: habit.emoji,
    goal: habit.goal || '',
    reminderTimes,
    scheduleDays,
    scheduledToday,
    streak: currentStreak(days, today, scheduleDays),
    best: bestStreak(scheduledCompletions, scheduleDays),
    doneToday: today in log,
    total: days.length,
    week,
    progress: scheduledDaysThisWeek ? Math.round((week.filter((d) => d.scheduled && d.done).length / scheduledDaysThisWeek) * 100) : 0,
  };
}

const normalizeScheduleDays = (value, fallback = ALL_DAYS) => {
  if (!Array.isArray(value)) return [...fallback];
  const days = [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  return days.length ? days.sort((a, b) => a - b) : [...fallback];
};
const normalizeReminderTimes = (value, legacyValue) => {
  const values = Array.isArray(value) ? value : legacyValue ? [legacyValue] : [];
  return [...new Set(values.filter((time) => typeof time === 'string' && VALID_REMINDER.test(time)))].sort();
};

const findHabit = (req) => db.habits.find((h) => h.id === parseInt(req.params.id, 10));

// ---------- Routes ----------
app.get('/api/habits', (req, res) => {
  const today = todayOf(req.query.today);
  res.json({ xp: db.xp, habits: db.habits.map((h) => view(h, today)) });
});

app.post('/api/habits', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 40) {
    return res.status(400).json({ message: 'Name must be 1–40 characters.' });
  }
  const emoji = String(req.body.emoji || '✅').slice(0, 8);
  const goal = String(req.body.goal || '').trim().slice(0, 120);
  const scheduleDays = normalizeScheduleDays(req.body.scheduleDays);
  const reminderTimes = normalizeReminderTimes(req.body.reminderTimes, req.body.reminderTime);
  const habit = { id: Date.now(), name, emoji, goal, scheduleDays, reminderTimes, log: {} };
  db.habits.push(habit);
  save();
  res.status(201).json(view(habit, todayOf(req.query.today)));
});

app.put('/api/habits/:id', (req, res) => {
  const habit = findHabit(req);
  if (!habit) return res.status(404).json({ message: 'Habit not found' });
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 40) {
    return res.status(400).json({ message: 'Name must be 1–40 characters.' });
  }
  habit.name = name;
  habit.emoji = String(req.body.emoji || '✅').slice(0, 8);
  habit.goal = String(req.body.goal || '').trim().slice(0, 120);
  habit.scheduleDays = normalizeScheduleDays(req.body.scheduleDays, scheduleDaysOf(habit));
  habit.reminderTimes = normalizeReminderTimes(req.body.reminderTimes, req.body.reminderTime);
  save();
  res.json(view(habit, todayOf(req.query.today)));
});

// Toggle today's completion (complete / undo)
app.post('/api/habits/:id/toggle', (req, res) => {
  const habit = findHabit(req);
  if (!habit) return res.status(404).json({ message: 'Habit not found' });

  const today = todayOf(req.body.date);
  if (!scheduleDaysOf(habit).includes(weekdayOf(today))) {
    return res.status(400).json({ message: 'This habit is not scheduled for that day.' });
  }
  let gained;

  if (today in habit.log) {
    gained = -habit.log[today];
    db.xp = Math.max(0, db.xp + gained);
    delete habit.log[today];
  } else {
    habit.log[today] = 0;
    gained = awardFor(currentStreak(Object.keys(habit.log), today, scheduleDaysOf(habit)));
    habit.log[today] = gained;
    db.xp += gained;
  }

  save();
  res.json({ habit: view(habit, today), xp: db.xp, gained });
});

app.delete('/api/habits/:id', (req, res) => {
  const index = db.habits.findIndex((h) => h.id === parseInt(req.params.id, 10));
  if (index === -1) return res.status(404).json({ message: 'Habit not found' });
  db.habits.splice(index, 1); // XP you earned is kept
  save();
  res.json({ message: 'Habit deleted' });
});

app.get('/api/progress', (req, res) => {
  const today = todayOf(req.query.today);
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(req.query.month || '');
  const monthNumber = monthMatch ? Number(monthMatch[2]) : 0;
  const requestedMonth = monthMatch && monthNumber >= 1 && monthNumber <= 12 ? req.query.month : today.slice(0, 7);
  const [year, month] = requestedMonth.split('-').map(Number);
  const monthStart = `${requestedMonth}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daily = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${requestedMonth}-${String(i + 1).padStart(2, '0')}`;
    return { date, completed: db.habits.filter((habit) => date in (habit.log || {})).length };
  });
  const countRange = (start, end) => db.habits.reduce((total, habit) =>
    total + Object.keys(habit.log || {}).filter((date) => date >= start && date <= end).length, 0);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const currentStart = shift(today, -((weekday + 6) % 7));
  const currentWeek = countRange(currentStart, today);
  const previousStart = shift(currentStart, -7);
  const previousEnd = shift(currentStart, -1);
  const previousWeek = countRange(previousStart, previousEnd);
  res.json({
    month: requestedMonth,
    daily,
    currentWeek,
    previousWeek,
    weekChange: currentWeek - previousWeek,
    activeHabits: db.habits.length,
  });
});

// Error handler must come after routes
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

app.listen(PORT, () => console.log(`NEW SERVER v2 running on http://localhost:${PORT}`));
