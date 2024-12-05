const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

// Initial habits
let habits = [
  { id: 1, name: 'Exercise', progress: 10, completionDates: [], streak: 1 }
];

function calculateStreak(completionDates) {
  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;

  const sortedDates = [...completionDates].sort((a, b) => new Date(b) - new Date(a));

  for (let i = 0; i < sortedDates.length; i++) {
    const current = new Date(sortedDates[i]);
    const next = new Date(sortedDates[i + 1] || today);

    const difference = (current - next) / (1000 * 60 * 60 * 24);
    if (difference <= 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

app.get('/api/habits', (req, res) => {
  res.json(habits);
});

app.post('/api/habits', (req, res) => {
  const { name } = req.body;
  const newHabit = { id: Date.now(), name, progress: 0, completionDates: [], streak: 0 };
  habits.push(newHabit);
  res.json(newHabit);
});

app.put('/api/habits/:id', (req, res) => {
  const habitId = parseInt(req.params.id);
  const habit = habits.find(h => h.id === habitId);

  if (habit) {
    habit.progress = Math.min(habit.progress + 10, 100);
    res.json(habit);
  } else {
    res.status(404).send('Habit not found');
  }
});

app.post('/api/habits/:id/complete', (req, res) => {
  const habitId = parseInt(req.params.id);
  const habit = habits.find(habit => habit.id === habitId);

  if (habit) {
    const today = new Date().toISOString().slice(0, 10);

    if (!habit.completionDates.includes(today)) {
      habit.completionDates.push(today);
    }

    habit.streak = calculateStreak(habit.completionDates);
    res.status(200).json({ message: 'Habit completed and streak updated', habit });
  } else {
    res.status(404).json({ message: 'Habit not found' });
  }
});

app.delete('/api/habits/:id', (req, res) => {
  const habitId = parseInt(req.params.id);
  const index = habits.findIndex(habit => habit.id === habitId);

  if (index !== -1) {
    habits.splice(index, 1);
    res.status(200).json({ message: 'Habit and progress deleted successfully' });
  } else {
    res.status(404).json({ message: 'Habit not found' });
  }
});

app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});
