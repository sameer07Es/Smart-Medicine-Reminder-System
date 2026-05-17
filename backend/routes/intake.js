const express = require('express');
const router = express.Router();
const MedicineIntake = require('../models/MedicineIntake');
const Medicine = require('../models/Medicine');
const Device = require('../models/Device');
const { isAuthenticated } = require('../middleware/auth');

function normalizeScheduledTime(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  d.setSeconds(0, 0);
  return d;
}

function buildSlotKey(record) {
  const deviceId = record.deviceId && record.deviceId._id ? String(record.deviceId._id) : String(record.deviceId || '');
  const medicineId = record.medicineId && record.medicineId._id ? String(record.medicineId._id) : String(record.medicineId || '');
  const scheduled = new Date(record.scheduledTime).toISOString();
  return `${deviceId}|${medicineId}|${scheduled}`;
}

// Get intake history (last 7 days)
router.get('/history', isAuthenticated, async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const query = {
      userId: req.session.userId,
      scheduledTime: { $gte: sevenDaysAgo }
    };

    if (req.query.deviceId) {
      query.deviceId = req.query.deviceId;
    }
    
    const intakes = await MedicineIntake.find(query)
    .populate('deviceId', 'deviceName nickname')
    .populate('medicineId', 'name dosage')
    .sort({ scheduledTime: -1, createdAt: -1 });

    // Hide historical duplicate rows for same medicine slot.
    const deduped = [];
    const seen = new Set();
    for (const record of intakes) {
      const key = buildSlotKey(record);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(record);
    }
    
    res.json(deduped);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching history', error: err.message });
  }
});

// Get today's pending medicines
router.get('/pending', isAuthenticated, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const pending = await MedicineIntake.find({
      userId: req.session.userId,
      scheduledTime: { $gte: today, $lt: tomorrow },
      status: 'pending'
    })
    .populate('deviceId', 'deviceName nickname')
    .populate('medicineId', 'name dosage')
    .sort({ scheduledTime: 1 });
    
    res.json(pending);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching pending', error: err.message });
  }
});

// Log medicine intake (for ESP32)
router.post('/log', async (req, res) => {
  try {
    const { deviceName, medicineId, status, scheduledTime, actualTakenTime } = req.body;
    
    if (!deviceName || !medicineId || !status) {
      return res.status(400).json({ message: 'Device, medicine, and status required' });
    }
    
    // Find device
    const device = await Device.findOne({ deviceName });
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const scheduledAt = normalizeScheduledTime(scheduledTime || new Date());
    if (!scheduledAt) {
      return res.status(400).json({ message: 'Invalid scheduledTime' });
    }

    const providedTakenAt = actualTakenTime ? new Date(actualTakenTime) : null;
    const realTakenAt = providedTakenAt && !Number.isNaN(providedTakenAt.getTime())
      ? providedTakenAt
      : new Date();

    const query = {
      deviceId: device._id,
      medicineId,
      scheduledTime: scheduledAt
    };

    const update = {
      $set: {
        userId: device.userId,
        deviceId: device._id,
        medicineId,
        scheduledTime: scheduledAt,
        status
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    };

    if (status === 'taken') {
      update.$set.takenTime = realTakenAt;
    } else {
      update.$unset = { takenTime: 1 };
    }

    const intake = await MedicineIntake.findOneAndUpdate(query, update, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    });
    
    res.json({ 
      message: 'Intake logged successfully',
      intake 
    });
  } catch (err) {
    console.error('Intake logging error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get weekly statistics
router.get('/stats/weekly', isAuthenticated, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const match = {
      userId: new mongoose.Types.ObjectId(req.session.userId),
      scheduledTime: { $gte: sevenDaysAgo }
    };

    if (req.query.deviceId && mongoose.Types.ObjectId.isValid(req.query.deviceId)) {
      match.deviceId = new mongoose.Types.ObjectId(req.query.deviceId);
    }
    
    const stats = await MedicineIntake.aggregate([
      {
        $match: match
      },
      {
        $sort: { scheduledTime: -1, createdAt: -1 }
      },
      {
        // Dedupe same medicine slot and keep the latest status.
        $group: {
          _id: {
            deviceId: '$deviceId',
            medicineId: '$medicineId',
            scheduledTime: '$scheduledTime'
          },
          status: { $first: '$status' }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Format response
    const result = {
      totalTaken: 0,
      totalMissed: 0,
      totalPending: 0,
      totalScheduled: 0,
      adherenceRate: 0
    };
    
    stats.forEach(stat => {
      if (stat._id === 'taken') result.totalTaken = stat.count;
      if (stat._id === 'missed') result.totalMissed = stat.count;
      if (stat._id === 'pending') result.totalPending = stat.count;
    });

    result.totalScheduled = result.totalTaken + result.totalMissed + result.totalPending;
    
    const decided = result.totalTaken + result.totalMissed;
    if (decided > 0) {
      result.adherenceRate = Number(((result.totalTaken / decided) * 100).toFixed(1));
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching stats', error: err.message });
  }
});

module.exports = router;
