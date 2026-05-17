const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null
  },
  deviceName: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  nickname: {
    type: String,
    required: true
  },
  deviceType: {
    type: String,
    default: 'medicine_reminder'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'offline'],
    default: 'active'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Device', deviceSchema);
