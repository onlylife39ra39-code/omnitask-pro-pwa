// State Management & LocalStorage Persistence
let tasks = JSON.parse(localStorage.getItem('omni_tasks') || '[]');
let activeStatusFilter = 'all';
let activeTagFilter = 'all';
let editingTaskId = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  updateCurrentDate();
  renderTasks();
  initAlarmChecker();
  registerServiceWorker();
  setInterval(updateCurrentDate, 30000);
});

function updateCurrentDate() {
  const dateEl = document.getElementById('currentDateDisplay');
  const now = new Date();
  const options = { month: 'short', day: 'numeric', weekday: 'short' };
  if (dateEl) dateEl.textContent = now.toLocaleDateString('ja-JP', options);
  
  const widgetClock = document.getElementById('widgetClock');
  if (widgetClock) widgetClock.textContent = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function saveTasks() {
  localStorage.setItem('omni_tasks', JSON.stringify(tasks));
  renderTasks();
}

// Task CRUD
function handleTaskSubmit(e) {
  e.preventDefault();
  const titleInput = document.getElementById('taskTitle');
  const priorityInput = document.getElementById('taskPriority');
  const tagInput = document.getElementById('taskTag');
  const alarmInput = document.getElementById('taskAlarmTime');
  const repeatInput = document.getElementById('taskRepeat');

  const title = titleInput.value.trim();
  if (!title) return;

  const tags = tagInput.value ? tagInput.value.split(',').map(t => t.trim()).filter(Boolean) : ['全般'];

  if (editingTaskId) {
    tasks = tasks.map(t => t.id === editingTaskId ? {
      ...t,
      title,
      priority: priorityInput.value,
      tags,
      alarmTime: alarmInput.value || null,
      repeat: repeatInput.value
    } : t);
    editingTaskId = null;
  } else {
    const newTask = {
      id: 'task_' + Date.now(),
      title,
      status: 'pending', // pending, in_progress, completed
      priority: priorityInput.value,
      tags,
      alarmTime: alarmInput.value || null,
      repeat: repeatInput.value,
      createdAt: new Date().toISOString(),
      alarmTriggered: false
    };
    tasks.unshift(newTask);
  }

  // Reset Form
  titleInput.value = '';
  alarmInput.value = '';
  tagInput.value = '';
  priorityInput.value = 'medium';
  repeatInput.value = 'none';
  document.getElementById('expandedOptions').classList.add('hidden');

  saveTasks();
  requestNotificationPermission();
}

function toggleTaskStatus(id) {
  tasks = tasks.map(t => {
    if (t.id === id) {
      let nextStatus = 'pending';
      if (t.status === 'pending') nextStatus = 'in_progress';
      else if (t.status === 'in_progress') nextStatus = 'completed';
      else if (t.status === 'completed') nextStatus = 'pending';
      
      // Handle Auto Repeat Task logic when marked completed
      if (nextStatus === 'completed' && t.repeat !== 'none') {
        handleRepeatTask(t);
      }
      return { ...t, status: nextStatus };
    }
    return t;
  });
  saveTasks();
}

function handleRepeatTask(task) {
  if (!task.alarmTime) return;
  const currentAlarm = new Date(task.alarmTime);
  if (isNaN(currentAlarm.getTime())) return;

  let nextDate = new Date(currentAlarm);
  if (task.repeat === 'daily') nextDate.setDate(nextDate.getDate() + 1);
  else if (task.repeat === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
  else if (task.repeat === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);

  const nextTask = {
    ...task,
    id: 'task_' + Date.now(),
    status: 'pending',
    alarmTime: nextDate.toISOString().slice(0, 16),
    alarmTriggered: false
  };
  tasks.unshift(nextTask);
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
}

function clearCompletedTasks() {
  tasks = tasks.filter(t => t.status !== 'completed');
  saveTasks();
}

// UI Filter Actions
function setStatusFilter(status) {
  activeStatusFilter = status;
  ['All', 'Pending', 'InProgress', 'Completed'].forEach(s => {
    const btn = document.getElementById(`btnFilter${s}`);
    if (btn) {
      if (s.toLowerCase() === status || (s === 'InProgress' && status === 'in_progress')) {
        btn.className = 'px-3 py-1 rounded-lg transition bg-indigo-600 text-white shadow-sm';
      } else {
        btn.className = 'px-3 py-1 rounded-lg text-slate-400 hover:text-white transition';
      }
    }
  });
  renderTasks();
}

function setTagFilter(tag) {
  activeTagFilter = tag;
  renderTasks();
}

function toggleMoreTaskOptions() {
  const el = document.getElementById('expandedOptions');
  el.classList.toggle('hidden');
}

// Render Dynamic Task List
function renderTasks() {
  const listContainer = document.getElementById('taskList');
  const priorityFilter = document.getElementById('priorityFilter').value;
  
  // Filter Logic
  let filtered = tasks.filter(t => {
    if (activeStatusFilter !== 'all' && t.status !== activeStatusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (activeTagFilter !== 'all' && !t.tags.includes(activeTagFilter)) return false;
    return true;
  });

  // Update Counters
  document.getElementById('pendingCount').