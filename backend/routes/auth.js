const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
  console.log('Registration attempt:', req.body);
  try {
    const username = (req.body.username || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';
    const confirmPassword = req.body.confirmPassword || '';

    // Validate input
    if (!username || !email || !password || !confirmPassword) {
      console.log('Validation failed: missing fields');
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      console.log('Passwords do not match');
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    // Check if user exists
    console.log('Checking if user exists...');
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      console.log('User already exists');
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    console.log('Creating new user...');
    const newUser = new User({ username, email, password });
    await newUser.save();
    console.log('User saved successfully');

    // Set session
    req.session.userId = newUser._id;
    req.session.username = newUser.username;

    res.status(201).json({ 
      message: 'User registered successfully',
      user: { id: newUser._id, username: newUser.username, email: newUser.email }
    });
  } catch (err) {
    console.error('Registration error:', err);

    if (err && err.code === 11000) {
      return res.status(400).json({ message: 'User already exists' });
    }

    if (err && err.name === 'ValidationError') {
      const firstError = Object.values(err.errors || {})[0];
      return res.status(400).json({ message: firstError?.message || 'Invalid registration data' });
    }

    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    // Find user
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    // Set session
    req.session.userId = user._id;
    req.session.username = user.username;

    res.json({ 
      message: 'Logged in successfully',
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Could not log out' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Check current user
router.get('/current-user', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ 
      loggedIn: true,
      username: req.session.username,
      userId: req.session.userId
    });
  } else {
    res.json({ loggedIn: false });
  }
});

module.exports = router;
