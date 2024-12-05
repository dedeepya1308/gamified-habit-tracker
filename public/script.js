const habitList = document.getElementById('habit-list');
const addHabitBtn = document.getElementById('add-habit-btn');
const toggleDarkModeBtn = document.getElementById('toggle-dark-mode');
const body = document.body;

// Dark Mode Toggle
toggleDarkModeBtn.addEventListener('click', () => {
  body.classList.toggle('dark-mode');
  const currentMode = body.classList.contains('dark-mode') ? '🌞 Light Mode' : '🌙 Dark Mode';
  toggleDarkModeBtn.textContent = currentMode;
});

// Fetch existing habits from the server
async function fetchHabits() {
  try {
    const response = await fetch('/api/habits');
    if (response.ok) {
      const habits = await response.json();
      renderHabits(habits);
    } else {
      const errorData = await response.json();
      console.error('Error fetching habits:', errorData.message);
      alert('Error loading habits. Please try again later.');
    }
  } catch (error) {
    console.error('Error fetching habits:', error);
    alert('An unexpected error occurred while fetching habits.');
  }
}


// Function to render the habit list dynamically
function renderHabits(habits) {
  habitList.innerHTML = ''; // Clear existing content
  habits.forEach((habit) => {
    const habitCard = document.createElement('div');
    habitCard.classList.add('habit-card');

    const habitName = document.createElement('h3');
    habitName.textContent = habit.name;

    const streakDisplay = document.createElement('p');
    streakDisplay.textContent = `🔥 Streak: ${habit.streak} days`;

    const progressBar = document.createElement('div');
    progressBar.classList.add('progress-bar');

    const progressBarFill = document.createElement('div');
    progressBarFill.classList.add('progress-bar-fill');
    progressBarFill.style.width = `${habit.progress}%`;

    progressBar.appendChild(progressBarFill);

    const completeButton = document.createElement('button');
    completeButton.textContent = 'Mark Complete';
    completeButton.addEventListener('click', () => markHabitComplete(habit.id));
      
    // Create Delete Button
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.classList.add('delete-btn');
    deleteButton.addEventListener('click', () => deleteHabit(habit.id));

    habitCard.appendChild(habitName);
    habitCard.appendChild(streakDisplay);
    habitCard.appendChild(progressBar);
    habitCard.appendChild(completeButton);
    habitCard.appendChild(deleteButton);  // Append delete button to habit card
    habitList.appendChild(habitCard);
  });
  renderProgressChart(habits);  // Render progress chart with updated data
}

// Function to mark a habit as complete
async function markHabitComplete(habitId) {
  try {
    const response = await fetch(`/api/habits/${habitId}/complete`, {
      method: 'POST',
    });

    if (response.ok) {
      const { message } = await response.json();
      console.log(message); // Log success message from server
      fetchHabits(); // Refresh the habits list
    } else {
      const errorData = await response.json();
      console.error('Error:', errorData.message);
      alert(`Error: ${errorData.message}`);
    }
  } catch (error) {
    console.error('Error completing habit:', error);
    alert('An unexpected error occurred while marking the habit complete.');
  }
}

// Update habit progress
async function updateProgress(habitId) {
  try {
    const response = await fetch(`/api/habits/${habitId}`, { method: 'PUT' });
    const updatedHabit = await response.json();
    fetchHabits();  // Re-fetch habits after updating progress
  } catch (error) {
    console.error('Error updating habit progress:', error);
  }
}

// Add a new habit
addHabitBtn.addEventListener('click', async () => {
  const newHabitName = prompt('Enter the name of the new habit:');
  if (!newHabitName) {
    alert('Habit name cannot be empty.');
    return;
  }

  try {
    const response = await fetch('/api/habits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newHabitName }),
    });

    if (response.ok) {
      const newHabit = await response.json();
      console.log('New habit added:', newHabit);
      fetchHabits(); // Refresh habit list after adding the new habit
    } else {
      const errorData = await response.json();
      console.error('Error adding habit:', errorData.message);
      alert(`Error adding habit: ${errorData.message}`);
    }
  } catch (error) {
    console.error('Error adding habit:', error);
    alert('An unexpected error occurred while adding the habit.');
  }
});


// Function to handle deleting a habit
async function deleteHabit(habitId) {
  try {
    const response = await fetch(`/api/habits/${habitId}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      alert('Habit and progress deleted successfully');
      fetchHabits(); // Re-fetch habits after deleting
    } else {
      const errorData = await response.json();
      console.error('Error:', errorData.message);
      alert(`Error deleting habit: ${errorData.message}`);
    }
  } catch (error) {
    console.error('Error deleting habit:', error);
    alert('An unexpected error occurred while deleting the habit.');
  }
}

  

// Render progress chart with Chart.js
let chartInstance = null;

function renderProgressChart(habits) {
  const ctx = document.getElementById('progress-chart').getContext('2d');
  const habitNames = habits.map(h => h.name);
  const habitProgress = habits.map(h => h.progress);

  // Destroy existing chart to prevent overlaps
  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: habitNames,
      datasets: [{
        label: 'Habit Progress (%)',
        data: habitProgress,
        backgroundColor: ['#76c893', '#5da77a', '#4b9b6d', '#3d7d55'],
      }],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
        },
      },
    },
  });
}


// Initial render
fetchHabits();
