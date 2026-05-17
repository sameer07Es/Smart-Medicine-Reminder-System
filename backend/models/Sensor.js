const mongoose = require('mongoose');

const sensorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sensorName: {
    type: String,
    required: true
  },
  sensorType: {
    type: String,
    enum: ['temperature', 'humidity', 'pressure', 'motion', 'light', 'custom'],
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: 'Not specified'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'error'],
    default: 'active'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: Object,
    default: {}
  }
});

module.exports = mongoose.model('Sensor', sensorSchema);
