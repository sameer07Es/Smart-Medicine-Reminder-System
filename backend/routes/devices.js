const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const { isAuthenticated } = require('../middleware/auth');

function normalizeDeviceStatus(value) {
  const raw = String(value || '').toLowerCase();
  if (raw === 'online' || raw === 'active') return 'active';
  if (raw === 'inactive') return 'inactive';
  if (raw === 'offline') return 'offline';
  return 'active';
}

// Get all devices for user
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const devices = await Device.find({ userId: req.session.userId });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching devices', error: err.message });
  }
});

// Get discovered (unassigned) devices
router.get('/discovered', isAuthenticated, async (req, res) => {
  try {
    const devices = await Device.find({ userId: null }).sort({ lastSeen: -1 });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching discovered devices', error: err.message });
  }
});

// Get device by name (for ESP32)
router.get('/name/:deviceName', async (req, res) => {
  try {
    const device = await Device.findOne({ deviceName: req.params.deviceName });
    
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    
    // Update last seen
    device.lastSeen = new Date();
    device.status = 'active';
    await device.save();
    
    res.json(device);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching device', error: err.message });
  }
});

// Get current server time for ESP32 sync (LAN, no internet NTP required).
router.get('/time', async (req, res) => {
  try {
    const now = new Date();
    res.json({
      epoch: Math.floor(now.getTime() / 1000),
      iso: now.toISOString()
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching server time', error: err.message });
  }
});

// Heartbeat update (for ESP32)
router.post('/heartbeat', async (req, res) => {
  try {
    const { deviceName, status } = req.body;
    const normalizedStatus = normalizeDeviceStatus(status);

    if (!deviceName) {
      return res.status(400).json({ message: 'Device name required' });
    }

    let device = await Device.findOne({ deviceName });
    if (!device) {
      device = new Device({
        userId: null,
        deviceName,
        nickname: deviceName,
        status: normalizedStatus,
        lastSeen: new Date()
      });
      await device.save();
      return res.json({ message: 'Device auto-registered', device });
    }

    device.lastSeen = new Date();
    device.status = normalizedStatus;
    await device.save();

    res.json({ message: 'Heartbeat received', device });
  } catch (err) {
    res.status(500).json({ message: 'Error updating heartbeat', error: err.message });
  }
});

// Register new device
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { deviceName, nickname } = req.body;
    
    if (!deviceName || !nickname) {
      return res.status(400).json({ message: 'Device name and nickname required' });
    }
    
    // Check if device already exists
    const existing = await Device.findOne({ deviceName });
    if (existing) {
      if (!existing.userId) {
        existing.userId = req.session.userId;
        existing.nickname = nickname;
        existing.status = 'active';
        existing.lastSeen = new Date();
        await existing.save();
        return res.status(200).json({
          message: 'Device claimed successfully',
          device: existing
        });
      }
      return res.status(400).json({ message: 'Device name already exists' });
    }
    
    const newDevice = new Device({
      userId: req.session.userId,
      deviceName,
      nickname
    });
    
    await newDevice.save();
    
    res.status(201).json({ 
      message: 'Device registered successfully',
      device: newDevice  
    });
  } catch (err) {
    console.error('Device registration error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update device
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const device = await Device.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    
    res.json({ message: 'Device updated', device });
  } catch (err) {
    res.status(500).json({ message: 'Error updating device', error: err.message });
  }
});

// Delete device
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const device = await Device.findOneAndDelete({ 
      _id: req.params.id,
      userId: req.session.userId 
    });
    
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    
    res.json({ message: 'Device deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting device', error: err.message });
  }
});

module.exports = router;
