// Global state
let currentView = 'devices';
let allDevices = [];
let allMedicines = [];
let discoveredDevices = [];
let selectedDeviceId = null;
const ACTIVE_THRESHOLD_MS = 2 * 60 * 1000;
const DASHBOARD_REFRESH_MS = 10000;

// Initialize dashboard
window.addEventListener('load', async () => {
  if (document.getElementById('dashboard').style.display !== 'none') {
    await initDashboard();
  }
});

async function initDashboard() {
  await loadDevices();
  await loadDiscoveredDevices();
  await loadMedicines();
  updateSummary();
  setupNavigation();
  setupModals();
  setupForms();
  
  // Refresh data frequently so device heartbeat updates appear quickly.
  setInterval(async () => {
    await loadDevices();
    await loadDiscoveredDevices();
    await loadMedicines();
    updateSummary();
    if (currentView === 'weekly') {
      await loadWeeklyReport();
    }
  }, DASHBOARD_REFRESH_MS);
}

// Navigation
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      switchView(view);
      
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function switchView(view) {
  currentView = view;
  
  document.getElementById('devices-view').style.display = view === 'devices' ? 'block' : 'none';
  document.getElementById('medicines-view').style.display = view === 'medicines' ? 'block' : 'none';
  document.getElementById('weekly-view').style.display = view === 'weekly' ? 'block' : 'none';
  
  if (view === 'devices') {
    renderDevices();
  } else if (view === 'medicines') {
    renderMedicines();
  } else if (view === 'weekly') {
    loadWeeklyReport();
  }
}

// Update summary cards
function updateSummary() {
  const totalDevices = allDevices.length;
  const activeDevices = allDevices.filter(d => getDeviceStatus(d) === 'active').length;
  
  // Count today's medicines
  const today = new Date().getDay();
  const todayMedicines = allMedicines.filter(m => 
    m.active && m.days.includes(today)
  );
  const todayDoses = todayMedicines.reduce((sum, m) => sum + m.times.length, 0);
  
  document.getElementById('total-devices-count').textContent = totalDevices;
  document.getElementById('active-devices-count').textContent = activeDevices;
  document.getElementById('today-medicines-count').textContent = todayDoses;
}

function getDeviceStatus(device) {
  if (!device.lastSeen) {
    return 'inactive';
  }

  const lastSeenTime = new Date(device.lastSeen).getTime();
  if (Number.isNaN(lastSeenTime)) {
    return 'inactive';
  }

  const ageMs = Date.now() - lastSeenTime;
  return ageMs <= ACTIVE_THRESHOLD_MS ? 'active' : 'offline';
}

// ============== DEVICES ==============

async function loadDevices() {
  try {
    const response = await fetch('/api/devices');
    if (!response.ok) throw new Error('Failed to load devices');
    
    allDevices = await response.json();
    renderDevices();
    renderConnectedDevices();
    updateDeviceSelectors();
  } catch (err) {
    console.error('Error loading devices:', err);
    document.getElementById('devices-list').innerHTML = '<p class="error">Error loading devices</p>';
    const connectedList = document.getElementById('connected-devices-list');
    if (connectedList) {
      connectedList.innerHTML = '<p class="error">Error loading connected devices</p>';
    }
  }
}

async function loadDiscoveredDevices() {
  try {
    const response = await fetch('/api/devices/discovered');
    if (!response.ok) throw new Error('Failed to load discovered devices');

    discoveredDevices = await response.json();
    renderConnectedDevices();
  } catch (err) {
    console.error('Error loading discovered devices:', err);
    const connectedList = document.getElementById('connected-devices-list');
    if (connectedList) {
      connectedList.innerHTML = '<p class="error">Error loading connected devices</p>';
    }
  }
}

function renderDevices() {
  const devicesList = document.getElementById('devices-list');
  
  if (allDevices.length === 0) {
    devicesList.innerHTML = '<p>No devices registered yet. Click "Register Device" to add your first device.</p>';
    return;
  }
  
  devicesList.innerHTML = allDevices.map(device => {
    const status = getDeviceStatus(device);
    const statusColor = status === 'active' ? '#4CAF50' : 
                       status === 'offline' ? '#f44336' : '#ff9800';
    
    const lastSeen = device.lastSeen ? 
      `Last seen: ${new Date(device.lastSeen).toLocaleString()}` : 
      'Never connected';
    
    return `
      <div class="item-card device-card">
        <div class="card-header">
          <h3>${device.nickname}</h3>
          <span class="status-badge" style="background: ${statusColor}">${status}</span>
        </div>
        <div class="card-body">
          <p><strong>Device Name:</strong> ${device.deviceName}</p>
          <p><strong>Status:</strong> ${lastSeen}</p>
        </div>
        <div class="card-actions">
          <button class="btn-edit" onclick="editDevice('${device._id}')">Edit</button>
          <button class="btn-delete" onclick="deleteDevice('${device._id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderConnectedDevices() {
  const connectedList = document.getElementById('connected-devices-list');
  if (!connectedList) return;

  const registeredActive = allDevices.filter(device => getDeviceStatus(device) === 'active');
  const discoveredActive = discoveredDevices.filter(device => getDeviceStatus(device) === 'active');

  const mergedByName = new Map();
  [...registeredActive, ...discoveredActive].forEach(device => {
    if (!mergedByName.has(device.deviceName)) {
      mergedByName.set(device.deviceName, device);
    }
  });

  const connectedDevices = Array.from(mergedByName.values())
    .sort((a, b) => new Date(b.lastSeen || 0) - new Date(a.lastSeen || 0));

  if (connectedDevices.length === 0) {
    connectedList.innerHTML = '<p>No devices are currently online.</p>';
    return;
  }

  connectedList.innerHTML = connectedDevices.map(device => {
    const lastSeen = device.lastSeen ? new Date(device.lastSeen).toLocaleString() : 'Unknown';
    const unassigned = !device.userId;
    return `
      <div class="item-card device-card">
        <div class="card-header">
          <h3>${device.nickname}</h3>
          <span class="status-badge" style="background: #4CAF50">online</span>
        </div>
        <div class="card-body">
          <p><strong>Device Name:</strong> ${device.deviceName}</p>
          ${unassigned ? '<p><strong>Status:</strong> Unassigned</p>' : ''}
          <p><strong>Last Seen:</strong> ${lastSeen}</p>
        </div>
      </div>
    `;
  }).join('');
}

function updateDeviceSelectors() {
  const selectors = [
    document.getElementById('device-filter'),
    document.getElementById('report-device-filter'),
    document.getElementById('medicine-device')
  ];
  
  selectors.forEach(selector => {
    if (!selector) return;
    
    const currentValue = selector.value;
    const isMedicineSelector = selector.id === 'medicine-device';
    
    selector.innerHTML = isMedicineSelector ? 
      '<option value="">Select Device</option>' :
      '<option value="">All Devices</option>';
    
    allDevices.forEach(device => {
      const option = document.createElement('option');
      option.value = device._id;
      option.textContent = `${device.nickname} (${device.deviceName})`;
      selector.appendChild(option);
    });
    
    if (currentValue) selector.value = currentValue;
  });
}

// Device form handling
document.getElementById('add-device-btn').addEventListener('click', () => {
  selectedDeviceId = null;
  document.getElementById('device-modal-title').textContent = 'Register Device';
  document.getElementById('device-form').reset();
  document.getElementById('device-id').value = '';
  document.getElementById('device-modal').style.display = 'block';
});

function editDevice(deviceId) {
  const device = allDevices.find(d => d._id === deviceId);
  if (!device) return;
  
  selectedDeviceId = deviceId;
  document.getElementById('device-modal-title').textContent = 'Edit Device';
  document.getElementById('device-id').value = deviceId;
  document.getElementById('device-name').value = device.deviceName;
  document.getElementById('device-nickname').value = device.nickname;
  document.getElementById('device-modal').style.display = 'block';
}

document.getElementById('device-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const deviceId = document.getElementById('device-id').value;
  const deviceData = {
    deviceName: document.getElementById('device-name').value,
    nickname: document.getElementById('device-nickname').value
  };
  
  try {
    const url = deviceId ? `/api/devices/${deviceId}` : '/api/devices';
    const method = deviceId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deviceData)
    });
    
    if (response.ok) {
      alert(deviceId ? 'Device updated!' : 'Device registered!');
      document.getElementById('device-modal').style.display = 'none';
      await loadDevices();
      updateSummary();
    } else {
      const error = await response.json();
      alert('Error: ' + error.message);
    }
  } catch (err) {
    alert('Error saving device: ' + err.message);
  }
});

async function deleteDevice(deviceId) {
  if (!confirm('Delete this device? All associated medicines will also be deleted.')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/devices/${deviceId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      alert('Device deleted');
      await loadDevices();
      await loadMedicines();
      updateSummary();
    } else {
      alert('Error deleting device');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ============== MEDICINES ==============

async function loadMedicines() {
  try {
    const response = await fetch('/api/medicines');
    if (!response.ok) throw new Error('Failed to load medicines');
    
    allMedicines = await response.json();
    renderMedicines();
  } catch (err) {
    console.error('Error loading medicines:', err);
    document.getElementById('medicines-list').innerHTML = '<p class="error">Error loading medicines</p>';
  }
}

function renderMedicines() {
  const medicinesList = document.getElementById('medicines-list');
  const filterDeviceId = document.getElementById('device-filter').value;
  
  let filteredMedicines = allMedicines;
  if (filterDeviceId) {
    filteredMedicines = allMedicines.filter(m => m.deviceId._id === filterDeviceId);
  }
  
  if (filteredMedicines.length === 0) {
    medicinesList.innerHTML = '<p>No medicines scheduled yet. Click "Add Medicine" to create a schedule.</p>';
    return;
  }
  
  medicinesList.innerHTML = filteredMedicines.map(medicine => {
    const device = medicine.deviceId;
    const times = medicine.times.map(t => 
      `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`
    ).join(', ');
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = medicine.days.map(d => dayNames[d]).join(', ');
    
    return `
      <div class="item-card medicine-card">
        <div class="card-header">
          <h3>${medicine.name}</h3>
          <span class="status-badge" style="background: ${medicine.active ? '#4CAF50' : '#999'}">
            ${medicine.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <div class="card-body">
          <p><strong>Device:</strong> ${device.nickname}</p>
          <p><strong>Dosage:</strong> ${medicine.dosage}</p>
          <p><strong>Times:</strong> ${times}</p>
          <p><strong>Days:</strong> ${days}</p>
        </div>
        <div class="card-actions">
          <button class="btn-edit" onclick="editMedicine('${medicine._id}')">Edit</button>
          <button class="btn-delete" onclick="deleteMedicine('${medicine._id}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

// Device filter
document.getElementById('device-filter').addEventListener('change', renderMedicines);

// Medicine form handling
document.getElementById('add-medicine-btn').addEventListener('click', () => {
  if (allDevices.length === 0) {
    alert('Please register a device first before adding medicines.');
    return;
  }
  
  selectedDeviceId = null;
  document.getElementById('medicine-modal-title').textContent = 'Add Medicine';
  document.getElementById('medicine-form').reset();
  document.getElementById('medicine-id').value = '';
  document.getElementById('medicine-active').checked = true;
  
  // Reset times to one input
  const timesContainer = document.getElementById('times-container');
  timesContainer.innerHTML = `
    <div class="time-input-group">
      <input type="time" class="medicine-time" required>
      <button type="button" class="btn-remove-time">Remove</button>
    </div>
  `;
  
  // Check all days by default
  document.querySelectorAll('.day-checkbox').forEach(cb => cb.checked = true);
  
  document.getElementById('medicine-modal').style.display = 'block';
});

function editMedicine(medicineId) {
  const medicine = allMedicines.find(m => m._id === medicineId);
  if (!medicine) return;
  
  selectedDeviceId = medicineId;
  document.getElementById('medicine-modal-title').textContent = 'Edit Medicine';
  document.getElementById('medicine-id').value = medicineId;
  document.getElementById('medicine-device').value = medicine.deviceId._id;
  document.getElementById('medicine-name').value = medicine.name;
  document.getElementById('medicine-dosage').value = medicine.dosage;
  document.getElementById('medicine-active').checked = medicine.active;
  
  // Set times
  const timesContainer = document.getElementById('times-container');
  timesContainer.innerHTML = medicine.times.map(t => {
    const timeStr = `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
    return `
      <div class="time-input-group">
        <input type="time" class="medicine-time" value="${timeStr}" required>
        <button type="button" class="btn-remove-time">Remove</button>
      </div>
    `;
  }).join('');
  
  // Set days
  document.querySelectorAll('.day-checkbox').forEach(cb => {
    cb.checked = medicine.days.includes(parseInt(cb.value));
  });
  
  document.getElementById('medicine-modal').style.display = 'block';
}

// Add time button
document.getElementById('add-time-btn').addEventListener('click', () => {
  const timesContainer = document.getElementById('times-container');
  const timeGroup = document.createElement('div');
  timeGroup.className = 'time-input-group';
  timeGroup.innerHTML = `
    <input type="time" class="medicine-time" required>
    <button type="button" class="btn-remove-time">Remove</button>
  `;
  timesContainer.appendChild(timeGroup);
});

// Remove time buttons (event delegation)
document.getElementById('times-container').addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-remove-time')) {
    const timesContainer = document.getElementById('times-container');
    if (timesContainer.children.length > 1) {
      e.target.parentElement.remove();
    } else {
      alert('At least one time is required');
    }
  }
});

document.getElementById('medicine-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const medicineId = document.getElementById('medicine-id').value;
  
  // Collect times
  const timeInputs = document.querySelectorAll('.medicine-time');
  const times = Array.from(timeInputs).map(input => {
    const [hour, minute] = input.value.split(':');
    return { hour: parseInt(hour), minute: parseInt(minute) };
  });
  
  // Collect active days
  const dayCheckboxes = document.querySelectorAll('.day-checkbox:checked');
  const days = Array.from(dayCheckboxes).map(cb => parseInt(cb.value));
  
  if (days.length === 0) {
    alert('Please select at least one day');
    return;
  }
  
  const medicineData = {
    deviceId: document.getElementById('medicine-device').value,
    name: document.getElementById('medicine-name').value,
    dosage: document.getElementById('medicine-dosage').value,
    times: times,
    days: days,
    active: document.getElementById('medicine-active').checked
  };
  
  try {
    const url = medicineId ? `/api/medicines/${medicineId}` : '/api/medicines';
    const method = medicineId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(medicineData)
    });
    
    if (response.ok) {
      alert(medicineId ? 'Medicine updated!' : 'Medicine added!');
      document.getElementById('medicine-modal').style.display = 'none';
      await loadMedicines();
      updateSummary();
    } else {
      const error = await response.json();
      alert('Error: ' + error.message);
    }
  } catch (err) {
    alert('Error saving medicine: ' + err.message);
  }
});

async function deleteMedicine(medicineId) {
  if (!confirm('Delete this medicine schedule?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/medicines/${medicineId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      alert('Medicine deleted');
      await loadMedicines();
      updateSummary();
    } else {
      alert('Error deleting medicine');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ============== WEEKLY REPORT ==============

async function loadWeeklyReport() {
  const deviceId = document.getElementById('report-device-filter').value;
  
  try {
    // Load weekly stats
    const statsUrl = deviceId ? 
      `/api/intake/stats/weekly?deviceId=${deviceId}` : 
      '/api/intake/stats/weekly';
    
    const statsResponse = await fetch(statsUrl);
    if (!statsResponse.ok) throw new Error('Failed to load stats');
    const stats = await statsResponse.json();
    
    // Load intake history
    const historyUrl = deviceId ?
      `/api/intake/history?deviceId=${deviceId}` :
      '/api/intake/history';
    
    const historyResponse = await fetch(historyUrl);
    if (!historyResponse.ok) throw new Error('Failed to load history');
    const history = await historyResponse.json();
    
    renderWeeklyStats(stats);
    renderIntakeHistory(history);
  } catch (err) {
    console.error('Error loading weekly report:', err);
    document.getElementById('weekly-stats').innerHTML = '<p class="error">Error loading report</p>';
  }
}

function renderWeeklyStats(stats) {
  const statsContainer = document.getElementById('weekly-stats');
  
  const adherencePercent = stats.totalScheduled > 0 ?
    ((stats.totalTaken / stats.totalScheduled) * 100).toFixed(1) : 0;
  
  statsContainer.innerHTML = `
    <div class="stats-cards">
      <div class="stat-card">
        <h3>Total Scheduled</h3>
        <p class="stat-value">${stats.totalScheduled}</p>
      </div>
      <div class="stat-card success">
        <h3>Taken</h3>
        <p class="stat-value">${stats.totalTaken}</p>
      </div>
      <div class="stat-card warning">
        <h3>Missed</h3>
        <p class="stat-value">${stats.totalMissed}</p>
      </div>
      <div class="stat-card info">
        <h3>Pending</h3>
        <p class="stat-value">${stats.totalPending}</p>
      </div>
      <div class="stat-card highlight">
        <h3>Adherence Rate</h3>
        <p class="stat-value">${adherencePercent}%</p>
      </div>
    </div>
  `;
}

function renderIntakeHistory(history) {
  const historyList = document.getElementById('history-list');

  const safeHistory = (history || []).filter(record => record && record.medicineId && record.deviceId);
  
  if (safeHistory.length === 0) {
    historyList.innerHTML = '<p>No intake history yet</p>';
    return;
  }
  
  historyList.innerHTML = safeHistory.map(record => {
    const statusColor = record.status === 'taken' ? '#4CAF50' :
                       record.status === 'missed' ? '#f44336' : '#ff9800';
    
    const scheduledTime = new Date(record.scheduledTime).toLocaleString();
    const takenTime = record.takenTime ? 
      new Date(record.takenTime).toLocaleString() : '-';
    
    return `
      <div class="history-item">
        <div class="history-header">
          <strong>${record.medicineId.name}</strong>
          <span class="status-badge" style="background: ${statusColor}">${record.status}</span>
        </div>
        <div class="history-details">
          <p><strong>Device:</strong> ${record.deviceId.nickname}</p>
          <p><strong>Dosage:</strong> ${record.medicineId.dosage}</p>
          <p><strong>Scheduled:</strong> ${scheduledTime}</p>
          ${record.status === 'taken' ? `<p><strong>Taken:</strong> ${takenTime}</p>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Weekly report device filter
document.getElementById('report-device-filter').addEventListener('change', loadWeeklyReport);

// ============== MODAL SETUP ==============

function setupModals() {
  // Close buttons
  document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
      const modalAttr = closeBtn.getAttribute('data-modal');
      if (modalAttr === 'device') {
        document.getElementById('device-modal').style.display = 'none';
      } else if (modalAttr === 'medicine') {
        document.getElementById('medicine-modal').style.display = 'none';
      }
    });
  });
  
  // Click outside to close
  window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
      event.target.style.display = 'none';
    }
  });
}

function setupForms() {
  // Forms are set up with their respective event listeners above
}

