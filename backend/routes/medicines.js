const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const { isAuthenticated } = require('../middleware/auth');
const { publishScheduleForDeviceId } = require('../services/mqttService');

const DAY_NAME_TO_NUMBER = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

function normalizeDays(inputDays) {
  if (!Array.isArray(inputDays) || inputDays.length === 0) {
    return [0, 1, 2, 3, 4, 5, 6];
  }

  const normalized = inputDays.map((day) => {
    if (typeof day === 'number') {
      return day;
    }

    if (typeof day === 'string') {
      const trimmed = day.trim();
      if (/^\d+$/.test(trimmed)) {
        return parseInt(trimmed, 10);
      }

      return DAY_NAME_TO_NUMBER[trimmed.toLowerCase()];
    }

    return null;
  }).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6);

  return normalized.length > 0 ? normalized : [0, 1, 2, 3, 4, 5, 6];
}

// Get all medicines for user
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const medicines = await Medicine.find({ userId: req.session.userId })
      .populate('deviceId', 'deviceName nickname');
    res.json(medicines);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching medicines', error: err.message });
  }
});

// Get medicines for specific device (for ESP32)
router.get('/device/:deviceName', async (req, res) => {
  try {
    const Device = require('../models/Device');
    const device = await Device.findOne({ deviceName: req.params.deviceName });
    
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    
    const medicines = await Medicine.find({ 
      deviceId: device._id,
      active: true
    });
    
    res.json(medicines);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching medicines', error: err.message });
  }
});

// Create medicine schedule
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { deviceId, name, dosage, times, days, startDate, endDate, notes } = req.body;
    
    if (!deviceId || !name || !times || times.length === 0) {
      return res.status(400).json({ message: 'Device, name, and times required' });
    }
    
    const newMedicine = new Medicine({
      userId: req.session.userId,
      deviceId,
      name,
      dosage,
      times,
      days: normalizeDays(days),
      startDate,
      endDate,
      notes
    });
    
    await newMedicine.save();
    await publishScheduleForDeviceId(deviceId);
    
    res.status(201).json({ 
      message: 'Medicine schedule created',
      medicine: newMedicine 
    });
  } catch (err) {
    console.error('Medicine creation error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update medicine
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(updateData, 'days')) {
      updateData.days = normalizeDays(updateData.days);
    }

    const medicine = await Medicine.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    await publishScheduleForDeviceId(medicine.deviceId);
    
    res.json({ message: 'Medicine updated', medicine });
  } catch (err) {
    res.status(500).json({ message: 'Error updating medicine', error: err.message });
  }
});

// Delete medicine
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const medicine = await Medicine.findOneAndDelete({ 
      _id: req.params.id,
      userId: req.session.userId 
    });
    
    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    await publishScheduleForDeviceId(medicine.deviceId);
    
    res.json({ message: 'Medicine deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting medicine', error: err.message });
  }
});

module.exports = router;
