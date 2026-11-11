import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const XP_PER_LEVEL = 100;
const EMOJIS = ['💪', '📚', '🧘', '💧', '🏃', '🥗', '😴', '✍️', '🎨', '🎸'];
const DAY_CHOICES = [{ day: 1, label: 'Mon' }, { day: 2, label: 'Tue' }, { day: 3, label: 'Wed' }, { day: 4, label: 'Thu' }, { day: 5, label: 'Fri' }, { day: 6, label: 'Sat' }, { day: 0, label: 'Sun' }];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const BADGES = [
  { id: 'first', icon: '🌱', name: 'First Step', desc: 'Earn your first XP', test: (s) => s.xp > 0 },
  { id: 'week', icon: '🔥', name: 'On Fire', desc: '7-day streak', test: (s) => s.habits.some((h) => h.best >= 7) },
  { id: 'month', icon: '🏆', name: 'Unstoppable', desc: '30-day streak', test: (s) => s.habits.some((h) => h.best >= 30) },
  { id: 'perfect', icon: '💯', name: 'Perfect Week', desc: '100% in the last 7 days', test: (s) => s.habits.some((h) => h.progress === 100) },
  { id: 'lvl5', icon: '⭐', name: 'Rising Star', desc: 'Reach level 5', test: (s) => Math.floor(s.xp / XP_PER_LEVEL) + 1 >= 5 },
];
const levelOf = (xp) => Math.floor(xp / XP_PER_LEVEL) + 1;
const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const readProfile = () => {
  try { return JSON.parse(localStorage.getItem('habit-profile')) || {}; }
  catch { return {}; }
};

function App() {
  const [habits, setHabits] = useState([]);
  const [xp, setXp] = useState(0);
  const [progress, setProgress] = useState(null);
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const [notificationPermission, setNotificationPermission] = useState(() => 'Notification' in window ? Notification.permission : 'unsupported');
  const [profile, setProfile] = useState(readProfile);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmoji, setProfileEmoji] = useState('🧑‍🚀');
  const [reminderAlerts, setReminderAlerts] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') === 'dark');
  const [dialogOpen, setDialogOpen] = useState(false);
  const dialogRef = useRef(null);
  const profileDialogRef = useRef(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [goal, setGoal] = useState('');
  const [scheduleDays, setScheduleDays] = useState(EVERY_DAY);
  const [reminderTimes, setReminderTimes] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const today = localDate();
  const unlocked = useMemo(() => new Set(BADGES.filter((b) => b.test({ xp, habits })).map((b) => b.id)), [xp, habits]);

  useEffect(() => { document.body.classList.toggle('dark-mode', theme); localStorage.setItem('theme', theme ? 'dark' : 'light'); }, [theme]);
  const toast = (message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items, { id, message, type }]);
    setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3000);
  };
  async function api(path, options = {}) {
    const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Something went wrong');
    return data;
  }
  async function load() {
    try { const data = await api(`/api/habits?today=${today}`); setHabits(data.habits); setXp(data.xp); }
    catch (error) { toast(error.message, 'error'); }
  }
  async function loadProgress(selectedMonth = month) {
    try { setProgress(await api(`/api/progress?today=${today}&month=${selectedMonth}`)); }
    catch (error) { toast(error.message, 'error'); }
  }
  useEffect(() => { load(); const refresh = () => { if (!document.hidden) { load(); loadProgress(); } }; document.addEventListener('visibilitychange', refresh); return () => document.removeEventListener('visibilitychange', refresh); }, []);
  useEffect(() => { loadProgress(month); }, [month]);
  useEffect(() => { if (dialogOpen && !dialogRef.current?.open) dialogRef.current?.showModal(); }, [dialogOpen]);
  useEffect(() => { if (profileOpen && !profileDialogRef.current?.open) profileDialogRef.current?.showModal(); }, [profileOpen]);
  useEffect(() => {
    if (!habits.some((habit) => habit.reminderTimes?.length)) return undefined;
    const checkReminders = () => {
      const now = new Date();
      const sentKey = `habit-reminders:${localDate()}`;
      const sent = new Set(JSON.parse(localStorage.getItem(sentKey) || '[]'));
      habits.filter((habit) => habit.reminderTimes?.length && !habit.doneToday && habit.scheduleDays?.includes(now.getDay())).forEach((habit) => {
        habit.reminderTimes.forEach((reminderTime) => {
          const reminderKey = `${habit.id}:${reminderTime}`;
          if (sent.has(reminderKey)) return;
          const [hours, minutes] = reminderTime.split(':').map(Number);
          const due = new Date(now);
          due.setHours(hours, minutes, 0, 0);
          const elapsed = now.getTime() - due.getTime();
          // A grace window lets a throttled or recently reopened tab catch the reminder.
          if (elapsed < 0 || elapsed > 15 * 60 * 1000) return;
          sent.add(reminderKey);
          const alert = { id: habit.id, reminderKey, name: habit.name, emoji: habit.emoji, goal: habit.goal || '', reminderTime };
          setReminderAlerts((items) => items.some((item) => item.reminderKey === reminderKey) ? items : [...items, alert]);
          const message = `${habit.emoji} Time for ${habit.name}`;
          const body = habit.goal || 'Open your habit tracker to mark it complete.';
          if (notificationPermission === 'granted' && 'Notification' in window) {
            try {
              const notification = new Notification(message, { body, tag: `habit-${habit.id}-${reminderTime}-${localDate()}` });
              notification.onclick = () => { window.focus(); notification.close(); };
            } catch { /* The in-app reminder banner remains available as a fallback. */ }
          }
        });
      });
      localStorage.setItem(sentKey, JSON.stringify([...sent]));
    };
    checkReminders();
    const timer = setInterval(checkReminders, 15000);
    const checkOnReturn = () => { if (!document.hidden) checkReminders(); };
    document.addEventListener('visibilitychange', checkOnReturn);
    window.addEventListener('focus', checkOnReturn);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', checkOnReturn); window.removeEventListener('focus', checkOnReturn); };
  }, [habits, notificationPermission]);

  async function toggleHabit(habit) {
    const beforeLevel = levelOf(xp); const beforeBadges = unlocked;
    try {
      const data = await api(`/api/habits/${habit.id}/toggle`, { method: 'POST', body: JSON.stringify({ date: today }) });
      setXp(data.xp); setHabits((items) => items.map((item) => item.id === habit.id ? data.habit : item));
      if (data.habit.doneToday) setReminderAlerts((items) => items.filter((item) => item.id !== habit.id));
      if (data.gained > 0) {
        const colors = ['#34d399', '#f59e0b', '#60a5fa', '#f472b6', '#a78bfa'];
        for (let i = 0; i < 40; i++) { const piece = document.createElement('i'); piece.className = 'confetti'; piece.style.left = `${Math.random() * 100}vw`; piece.style.background = colors[i % colors.length]; piece.style.animationDelay = `${Math.random() * .3}s`; piece.style.setProperty('--dx', `${Math.random() * 200 - 100}px`); document.body.appendChild(piece); setTimeout(() => piece.remove(), 2200); }
        toast(`+${data.gained} XP 🎉`, 'success');
        if (levelOf(data.xp) > beforeLevel) toast(`Level up! You're now level ${levelOf(data.xp)} ⭐`, 'success');
        BADGES.filter((b) => b.test({ xp: data.xp, habits: habits.map((h) => h.id === habit.id ? data.habit : h) }) && !beforeBadges.has(b.id)).forEach((b) => toast(`Badge unlocked: ${b.icon} ${b.name}`, 'success'));
      } else toast('Completion undone');
    } catch (error) { toast(error.message, 'error'); }
  }
  async function deleteHabit(habit) {
    if (!confirm(`Delete "${habit.name}"? Your earned XP is kept.`)) return;
    try { await api(`/api/habits/${habit.id}`, { method: 'DELETE' }); toast('Habit deleted'); load(); loadProgress(); }
    catch (error) { toast(error.message, 'error'); }
  }
  async function addHabit(event) {
    event.preventDefault();
    try {
      const payload = JSON.stringify({ name, emoji, goal, scheduleDays, reminderTimes: reminderTimes.filter(Boolean) });
      if (editingId) await api(`/api/habits/${editingId}?today=${today}`, { method: 'PUT', body: payload });
      else await api(`/api/habits?today=${today}`, { method: 'POST', body: payload });
      setDialogOpen(false); setName(''); setGoal(''); setScheduleDays(EVERY_DAY); setReminderTimes([]); setEditingId(null);
      toast(editingId ? 'Habit updated' : 'Habit added!', 'success'); load();
    }
    catch (error) { toast(error.message, 'error'); }
  }
  function openAdd() { setEditingId(null); setName(''); setEmoji(EMOJIS[0]); setGoal(''); setScheduleDays(EVERY_DAY); setReminderTimes([]); setDialogOpen(true); }
  function openEdit(habit) { setEditingId(habit.id); setName(habit.name); setEmoji(habit.emoji); setGoal(habit.goal || ''); setScheduleDays(habit.scheduleDays || EVERY_DAY); setReminderTimes(habit.reminderTimes || (habit.reminderTime ? [habit.reminderTime] : [])); setDialogOpen(true); }
  function addReminderTime() { setReminderTimes((items) => [...items, '']); }
  function updateReminderTime(index, value) { setReminderTimes((items) => items.map((item, i) => i === index ? value : item)); }
  function removeReminderTime(index) { setReminderTimes((items) => items.filter((_, i) => i !== index)); }
  function toggleScheduleDay(day) {
    setScheduleDays((items) => items.includes(day)
      ? items.length > 1 ? items.filter((item) => item !== day) : items
      : [...items, day].sort((a, b) => a - b));
  }
  function openProfile() { setProfileName(profile.name || ''); setProfileEmoji(profile.emoji || '🧑‍🚀'); setProfileOpen(true); }
  function saveProfile(event) {
    event.preventDefault();
    const next = { name: profileName.trim().slice(0, 40) || 'Habit Hero', emoji: profileEmoji };
    localStorage.setItem('habit-profile', JSON.stringify(next));
    setProfile(next); setProfileOpen(false); toast('Profile saved', 'success');
  }
  async function enableReminders() {
    if (!('Notification' in window)) { toast('This browser does not support notifications.', 'error'); return; }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      toast(permission === 'granted' ? 'Browser notifications enabled. Keep the tracker open for reminders.' : permission === 'denied' ? 'Notifications are blocked for this site. Allow them in your browser site settings.' : 'Notification permission was not granted.', permission === 'granted' ? 'success' : 'error');
    } catch { toast('Could not request notification permission. Check this site’s browser settings.', 'error'); }
  }
  function shiftMonth(amount) {
    const [year, monthNumber] = month.split('-').map(Number);
    const date = new Date(year, monthNumber - 1 + amount, 1);
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  const best = Math.max(0, ...habits.map((h) => h.best));
  return <>
    <main className="container">
      <header><h1>🎮 Gamified Habit Tracker</h1><div className="header-actions"><button aria-label="Toggle dark mode" aria-pressed={theme} onClick={() => setTheme((v) => !v)}>{theme ? '🌞' : '🌙'}</button><button onClick={openProfile}>{profile.emoji || '👤'} {profile.name || 'Profile'}</button><button className="primary-btn" onClick={openAdd}>+ Add Habit</button></div></header>
      <section className="card profile-summary"><div className="profile-avatar">{profile.emoji || '🧑‍🚀'}</div><div className="profile-details"><strong>{profile.name || 'Your profile'}</strong><span>Level {levelOf(xp)} · {xp} XP · best streak {best} days</span></div><button onClick={openProfile}>Edit profile</button></section>
      {!!reminderAlerts.length && <section className="reminder-alerts" aria-live="assertive" aria-atomic="false"><h2>⏰ Habit reminders</h2>{reminderAlerts.map((alert) => <div className="reminder-alert" key={alert.reminderKey}><div><strong>{alert.emoji} {alert.name}</strong><span>{alert.goal || `Scheduled for ${alert.reminderTime}`}</span></div><button className="primary-btn" onClick={() => { const habit = habits.find((item) => item.id === alert.id); if (habit) toggleHabit(habit); }}>Mark complete</button><button aria-label={`Dismiss reminder for ${alert.name}`} onClick={() => setReminderAlerts((items) => items.filter((item) => item.reminderKey !== alert.reminderKey))}>Dismiss</button></div>)}</section>}
      <section className="card stats" aria-label="Your habit statistics"><div className="level-badge" aria-label={`Level ${levelOf(xp)}`}>Lv <span>{levelOf(xp)}</span></div><div className="xp"><div className="xp-label"><span>Experience</span><span>{xp % XP_PER_LEVEL} / {XP_PER_LEVEL}</span></div><div className="progress-bar" role="meter" aria-label="Experience progress to next level" aria-valuemin="0" aria-valuemax={XP_PER_LEVEL} aria-valuenow={xp % XP_PER_LEVEL}><div className="progress-bar-fill" style={{ width: `${xp % XP_PER_LEVEL}%` }} /></div></div><div className="mini-stats"><div><strong>{habits.filter((h) => h.doneToday).length}/{habits.length}</strong><span>Done today</span></div><div><strong>{best}</strong><span>Best streak</span></div></div></section>
      <div id="habit-list" aria-label="Your habits">{habits.length ? habits.map((habit) => <section className={`card habit-card${habit.doneToday ? ' done' : ''}`} aria-labelledby={`habit-title-${habit.id}`} key={habit.id}>
        <div className="card-top"><span className="emoji" aria-hidden="true">{habit.emoji}</span><h3 id={`habit-title-${habit.id}`}>{habit.name}</h3><span className="streak">🔥 {habit.streak} day{habit.streak === 1 ? '' : 's'} · best {habit.best}</span></div>
        {habit.goal && <p className="habit-goal">{habit.goal}</p>}
        <p className="habit-schedule">{(habit.scheduleDays || EVERY_DAY).length === 7 ? 'Every day' : (habit.scheduleDays || EVERY_DAY).map((day) => DAY_NAMES[day].slice(0, 3)).join(', ')}</p>
        {!!habit.reminderTimes?.length && <p className="habit-reminder">🔔 {habit.reminderTimes.join(' · ')}</p>}
        <div className="week" role="group" aria-label={`${habit.name} completion history for the last seven days`}>{habit.week.map((day) => { const weekday = new Date(`${day.date}T00:00:00`).getDay(); const state = day.done ? 'completed' : day.scheduled ? 'scheduled, not completed' : 'not scheduled'; return <span className={`dot${day.done ? ' on' : ''}${day.scheduled ? '' : ' off-schedule'}`} aria-label={`${DAY_NAMES[weekday]} ${day.date}, ${state}`} title={`${day.date}: ${state}`} key={day.date}>{DAY_NAMES[weekday][0]}</span>; })}</div>
        <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${habit.progress}%` }} /></div><p className="progress-label">{habit.progress}% this week</p>
        <div className="card-actions"><button className={habit.doneToday ? '' : 'primary-btn'} disabled={!habit.scheduledToday && !habit.doneToday} aria-label={habit.scheduledToday ? `${habit.doneToday ? 'Undo' : 'Mark'} ${habit.name} complete today` : `${habit.name} is not scheduled today`} onClick={() => toggleHabit(habit)}>{habit.doneToday ? '↩ Undo' : habit.scheduledToday ? 'Mark Complete ✓' : 'Rest day'}</button><button onClick={() => openEdit(habit)} aria-label={`Edit ${habit.name}`}>Edit</button><button className="delete-btn" onClick={() => deleteHabit(habit)} aria-label={`Delete ${habit.name}`}>Delete</button></div>
      </section>) : <p className="empty">No habits yet. Add your first one to start earning XP!</p>}</div>
      <section className="card progress-card">
        <div className="progress-heading"><h2>Progress</h2>{habits.some((habit) => habit.reminderTimes?.length) && <button onClick={enableReminders}>{notificationPermission === 'granted' ? '🔔 Notifications allowed' : notificationPermission === 'denied' ? '🔔 Check browser settings' : 'Enable notifications'}</button>}</div>
        {progress && <>
          <div className="week-comparison"><div><span>This week</span><strong>{progress.currentWeek} completions</strong></div><div><span>Previous week</span><strong>{progress.previousWeek} completions</strong></div><div><span>Change</span><strong className={progress.weekChange >= 0 ? 'positive-change' : 'negative-change'}>{progress.weekChange > 0 ? '+' : ''}{progress.weekChange}</strong></div></div>
          <div className="month-heading"><button aria-label="Previous month" onClick={() => shiftMonth(-1)}>←</button><h3>{new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3><button aria-label="Next month" onClick={() => shiftMonth(1)}>→</button></div>
          <div className="month-grid" role="group" aria-label={`Completion calendar for ${new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`}>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => <span className="month-day-label" key={day}><span aria-hidden="true">{day[0]}</span><span className="sr-only">{day}</span></span>)}
            {Array.from({ length: new Date(`${month}-01T00:00:00`).getDay() }, (_, i) => <span className="month-day empty-day" key={`pad-${i}`} />)}
            {progress.daily.map((day) => <span className={`month-day${day.completed ? ' has-completions' : ''}`} aria-label={`${day.date}: ${day.completed} completion${day.completed === 1 ? '' : 's'}`} title={`${day.date}: ${day.completed} completion${day.completed === 1 ? '' : 's'}`} key={day.date}><strong>{Number(day.date.slice(-2))}</strong>{day.completed > 0 && <small aria-hidden="true">{day.completed}</small>}</span>)}
          </div>
          <p className="calendar-key"><span /> A marked day has one or more habit completions</p>
        </>}
      </section>
      {!!habits.length && <section className="card"><h2>Last 7 days</h2><div id="chart" role="group" aria-label="Completed habits each day for the last seven days">{habits[0].week.map((day, i) => { const count = habits.filter((h) => h.week[i].done).length; const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' }); return <div className="bar-col" role="group" aria-label={`${label}: ${count} completions`} key={day.date}><span className="bar-value" aria-hidden="true">{count}</span><div className="bar-track" aria-hidden="true"><div className="bar" style={{ height: `${count / habits.length * 100}%` }} /></div><span className="bar-label" aria-hidden="true">{label.slice(0, 3)}</span></div>; })}</div></section>}
      <section className="card"><h2>Badges</h2><div id="badges">{BADGES.map((badge) => <div className={`badge${unlocked.has(badge.id) ? '' : ' locked'}`} key={badge.id}><span className="icon" aria-hidden="true">{badge.icon}</span><strong>{badge.name}</strong><small>{unlocked.has(badge.id) ? badge.desc : `Locked · ${badge.desc}`}</small></div>)}</div></section>
    </main>
    {dialogOpen && <dialog ref={dialogRef} aria-labelledby="habit-dialog-title" onCancel={() => setDialogOpen(false)} onClick={(e) => { if (e.target === e.currentTarget) setDialogOpen(false); }}>
      <form onSubmit={addHabit}>
        <h2 id="habit-dialog-title">{editingId ? 'Edit habit' : 'New habit'}</h2>
        <label htmlFor="habit-name">Name</label><input id="habit-name" maxLength="40" required autoComplete="off" placeholder="e.g. Read" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="habit-goal">Goal or note</label><input id="habit-goal" maxLength="120" placeholder="e.g. Read 20 pages" value={goal} onChange={(e) => setGoal(e.target.value)} />
        <fieldset className="schedule-picker"><legend>Repeat on</legend><div className="schedule-days">{DAY_CHOICES.map(({ day, label }) => <button type="button" key={day} aria-pressed={scheduleDays.includes(day)} onClick={() => toggleScheduleDay(day)}>{label}</button>)}</div><p className="form-hint">Choose at least one day.</p></fieldset>
        <span id="habit-icon-label" className="field-label">Icon</span><div id="emoji-picker" role="group" aria-labelledby="habit-icon-label">{EMOJIS.map((item) => <button type="button" aria-label={`Use ${item} as the habit icon`} aria-pressed={emoji === item} className={emoji === item ? 'selected' : ''} key={item} onClick={() => setEmoji(item)}>{item}</button>)}</div>
        <fieldset className="reminder-picker"><legend>Daily reminders (optional)</legend>{reminderTimes.map((time, index) => <div className="reminder-time-row" key={index}><label htmlFor={`reminder-time-${index}`}>Reminder {index + 1}</label><input id={`reminder-time-${index}`} type="time" value={time} onChange={(e) => updateReminderTime(index, e.target.value)} /><button type="button" aria-label={`Remove reminder ${index + 1}`} onClick={() => removeReminderTime(index)}>Remove</button></div>)}<button type="button" onClick={addReminderTime}>+ Add reminder time</button><p className="form-hint">Notifications run while this tracker is open.</p></fieldset>
        <div className="actions"><button type="button" onClick={() => setDialogOpen(false)}>Cancel</button><button type="submit" className="primary-btn">{editingId ? 'Save changes' : 'Add'}</button></div>
      </form>
    </dialog>}
    {profileOpen && <dialog ref={profileDialogRef} className="profile-dialog" aria-labelledby="profile-dialog-title" onCancel={() => setProfileOpen(false)} onClick={(e) => { if (e.target === e.currentTarget) setProfileOpen(false); }}><form onSubmit={saveProfile}><h2 id="profile-dialog-title">Your profile</h2><label htmlFor="profile-name">Display name</label><input id="profile-name" maxLength="40" autoComplete="nickname" placeholder="Habit Hero" value={profileName} onChange={(e) => setProfileName(e.target.value)} /><span id="profile-avatar-label" className="field-label">Choose an avatar</span><div className="profile-emoji-picker" role="group" aria-labelledby="profile-avatar-label">{['🧑‍🚀', '🧑‍🎓', '🧑‍💻', '🧑‍🎨', '🦊', '🐼', '🐸', '🐯', '🐻', '🐧'].map((item) => <button type="button" aria-label={`Use ${item} as your avatar`} aria-pressed={profileEmoji === item} className={profileEmoji === item ? 'selected' : ''} key={item} onClick={() => setProfileEmoji(item)}>{item}</button>)}</div><p className="form-hint">This profile is saved in this browser on this device.</p><div className="actions"><button type="button" onClick={() => setProfileOpen(false)}>Cancel</button><button type="submit" className="primary-btn">Save profile</button></div></form></dialog>}
    <div id="toasts" aria-live="polite" aria-atomic="true">{toasts.map((item) => <div className={`toast ${item.type}`} key={item.id}>{item.message}</div>)}</div>
  </>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
