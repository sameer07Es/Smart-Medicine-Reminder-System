const express = require('express');
const router = express.Router();
const Sensor = require('../models/Sensor');
const { isAuthenticated } = require('../middleware/auth');

// Get dashboard summary
router.get('/summary', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId;

    // Get latest sensor readings
    const latestSensors = await Sensor.find({ userId })
      .sort({ timestamp: -1 })
      .limit(10);

    // Get active sensors count
    const activeSensorsCount = await Sensor.countDocuments({ 
      userId,
      status: 'active'
    });

    // Get sensor types breakdown
    const sensorTypes = await Sensor.aggregate([
      { $match: { userId: require('mongoose').Types.ObjectId(userId) } },
      { $group: { _id: '$sensorType', count: { $sum: 1 } } }
    ]);

    res.json({
      activeSensors: activeSensorsCount,
      recentReadings: latestSensors,
      sensorTypeBreakdown: sensorTypes,
      lastUpdated: new Date()
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching dashboard', error: err.message });
  }
});

// Get sensor statistics
router.get('/stats/:sensorType', isAuthenticated, async (req, res) => {
  try {
    const { sensorType } = req.params;
    const userId = req.session.userId;

    const stats = await Sensor.aggregate([
      { 
        $match: { 
          userId: require('mongoose').Types.ObjectId(userId),
          sensorType: sensorType
        }
      },
      {
        $group: {
          _id: null,
          average: { $avg: '$value' },
          min: { $min: '$value' },
          max: { $max: '$value' },
          latest: { $max: '$timestamp' },
          count: { $sum: 1 }
        }
      }
    ]);

    if (!stats.length) {
      return res.json({ message: 'No data for this sensor type' });
    }

    res.json(stats[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching stats', error: err.message });
  }
});

module.exports = router;
