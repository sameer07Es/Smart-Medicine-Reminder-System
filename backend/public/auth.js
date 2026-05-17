// Check if user is already logged in
document.addEventListener('DOMContentLoaded', async () => {
  const response = await fetch('/api/auth/current-user');
  const data = await response.json();
  
  if (data.loggedIn) {
    showDashboard(data.username);
  } else {
    showAuthForm();
  }
});

let isLoginMode = true;

// Toggle between login and register
document.getElementById('toggle-form') && document.getElementById('toggle-form').addEventListener('click', () => {
  isLoginMode = !isLoginMode;
  updateFormDisplay();
});

function updateFormDisplay() {
  const emailInput = document.getElementById('email');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const formTitle = document.getElementById('form-title');
  const submitBtn = document.getElementById('submit-btn');
  const toggleForm = document.getElementById('toggle-form');

  if (isLoginMode) {
    emailInput.style.display = 'none';
    confirmPasswordInput.style.display = 'none';
    formTitle.textContent = 'Login';
    submitBtn.textContent = 'Login';
    toggleForm.innerHTML = "Don't have an account? <a href='#'>Register</a>";
  } else {
    emailInput.style.display = 'block';
    confirmPasswordInput.style.display = 'block';
    formTitle.textContent = 'Register';
    submitBtn.textContent = 'Register';
    toggleForm.innerHTML = 'Already have an account? <a href="#">Login</a>';
  }
}

// Handle authentication form submission
document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
  const body = isLoginMode 
    ? { username, password }
    : { username, email, password, confirmPassword };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (response.ok) {
      alert(data.message);
      showDashboard(data.user.username);
    } else {
      const errorText = data.error ? `${data.message} (${data.error})` : data.message;
      alert('Error: ' + errorText);
    }
  } catch (err) {
    alert('Server error: ' + err.message);
  }
});

function showAuthForm() {
  document.getElementById('auth-section').style.display = 'block';
  document.getElementById('dashboard').style.display = 'none';
}

async function showDashboard(username) {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('welcome-text').textContent = `Welcome, ${username}!`;
  
  // Initialize dashboard if function exists
  if (typeof initDashboard === 'function') {
    await initDashboard();
  }
}

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  const response = await fetch('/api/auth/logout', { method: 'POST' });
  
  if (response.ok) {
    alert('Logged out successfully');
    showAuthForm();
    document.getElementById('auth-form').reset();
    isLoginMode = true;
    updateFormDisplay();
  }
});
