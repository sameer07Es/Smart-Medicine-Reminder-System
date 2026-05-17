const express = require('express');
const router = express.Router();
const Sensor = require('../models/Sensor');
const { isAuthenticated } = require('../middleware/auth');

// Get all sensors for logged-in user
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const sensors = await Sensor.find({ userId: req.session.userId })
      .sort({ timestamp: -1 });
    
    res.json(sensors);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching sensors', error: err.message });
  }
});

// Get sensor by ID
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const sensor = await Sensor.findOne({ 
      _id: req.params.id,
      userId: req.session.userId 
    });

    if (!sensor) {
      return res.status(404).json({ message: 'Sensor not found' });
    }

    res.json(sensor);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching sensor', error: err.message });
  }
});

// Create new sensor data
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { sensorName, sensorType, value, unit, location, metadata } = req.body;

    const newSensor = new Sensor({
      userId: req.session.userId,
      sensorName,
      sensorType,
      value,
      unit,
      location,
      metadata: metadata || {}
    });

    await newSensor.save();

    res.status(201).json({ 
      message: 'Sensor data created',
      sensor: newSensor 
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating sensor', error: err.message });
  }
});

// Update sensor
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const sensor = await Sensor.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!sensor) {
      return res.status(404).json({ message: 'Sensor not found' });
    }

    res.json({ message: 'Sensor updated', sensor });
  } catch (err) {
    res.status(500).json({ message: 'Error updating sensor', error: err.message });
  }
});

// Delete sensor
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const sensor = await Sensor.findOneAndDelete({ 
      _id: req.params.id,
      userId: req.session.userId 
    });

    if (!sensor) {
      return res.status(404).json({ message: 'Sensor not found' });
    }

    res.json({ message: 'Sensor deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting sensor', error: err.message });
  }
});

module.exports = router;
