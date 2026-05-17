const mongoose = require('mongoose');

const medicineIntakeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  medicineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medicine',
    required: true
  },
  scheduledTime: {
    type: Date,
    required: true
  },
  takenTime: {
    type: Date
  },
  status: {
    type: String,
    enum: ['taken', 'missed', 'pending'],
    default: 'pending'
  },
  notes: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
medicineIntakeSchema.index({ userId: 1, scheduledTime: -1 });
medicineIntakeSchema.index({ deviceId: 1, status: 1 });
medicineIntakeSchema.index(
  { deviceId: 1, medicineId: 1, scheduledTime: 1 },
  { unique: true }
);

module.exports = mongoose.model('MedicineIntake', medicineIntakeSchema);
