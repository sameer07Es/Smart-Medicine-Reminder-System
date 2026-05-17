const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const { initMqtt } = require('./services/mqttService');
const MedicineIntake = require('./models/MedicineIntake');

const app = express();
const PORT = process.env.PORT || 3000;

async function cleanupDuplicateIntakes() {
  const duplicateGroups = await MedicineIntake.aggregate([
    {
      $group: {
        _id: {
          deviceId: '$deviceId',
          medicineId: '$medicineId',
          scheduledTime: '$scheduledTime'
        },
        ids: { $push: '$_id' },
        count: { $sum: 1 },
        latestCreatedAt: { $max: '$createdAt' }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]);

  if (!duplicateGroups.length) {
    return;
  }

  let removed = 0;
  for (const group of duplicateGroups) {
    const keep = await MedicineIntake.findOne({
      deviceId: group._id.deviceId,
      medicineId: group._id.medicineId,
      scheduledTime: group._id.scheduledTime
    })
      .sort({ createdAt: -1, _id: -1 })
      .select('_id')
      .lean();

    if (!keep) {
      continue;
    }

    const deleteResult = await MedicineIntake.deleteMany({
      deviceId: group._id.deviceId,
      medicineId: group._id.medicineId,
      scheduledTime: group._id.scheduledTime,
      _id: { $ne: keep._id }
    });

    removed += deleteResult.deletedCount || 0;
  }

  if (removed > 0) {
    console.log(`Removed ${removed} duplicate intake records`);
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://YOUR_MONGODB_HOST:27017/YOUR_DATABASE_NAME';
mongoose.connect(mongoUri, { family: 4 })
  .then(() => {
    console.log('MongoDB connected');
    return cleanupDuplicateIntakes();
  })
  .then(() => {
    initMqtt();
  })
  .catch(err => console.log('MongoDB connection error:', err));

// Import Routes
const authRoutes = require('./routes/auth');
const sensorRoutes = require('./routes/sensors');
const dashboardRoutes = require('./routes/dashboard');
const deviceRoutes = require('./routes/devices');
const medicineRoutes = require('./routes/medicines');
const intakeRoutes = require('./routes/intake');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/intake', intakeRoutes);

// Basic route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Access dashboard at http://localhost:${PORT}`);
  console.log(`Node-RED runs separately at http://localhost:1880`);
});

module.exports = app;
