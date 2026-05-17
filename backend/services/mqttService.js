const mqtt = require('mqtt');
const Device = require('../models/Device');
const Medicine = require('../models/Medicine');
const MedicineIntake = require('../models/MedicineIntake');

let client = null;
let mqttReady = false;

const DEFAULT_BROKER = process.env.MQTT_BROKER_URL || 'mqtt://YOUR_MQTT_BROKER_HOST:1883';
const TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX || 'smsr';

function normalizeDeviceStatus(value) {
  const raw = String(value || '').toLowerCase();
  if (raw === 'online' || raw === 'active') return 'active';
  if (raw === 'inactive') return 'inactive';
  if (raw === 'offline') return 'offline';
  return 'active';
}

function getTopic(topicSuffix) {
  return `${TOPIC_PREFIX}/${topicSuffix}`;
}

function normalizeScheduledTime(input) {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  d.setSeconds(0, 0);
  return d;
}

function isConnected() {
  return mqttReady && client && client.connected;
}

async function publishScheduleForDeviceName(deviceName) {
  if (!isConnected()) {
    return false;
  }

  const device = await Device.findOne({ deviceName });
  if (!device) {
    return false;
  }

  const medicines = await Medicine.find({
    deviceId: device._id,
    active: true
  }).lean();

  const topic = getTopic(`device/${deviceName}/schedule`);
  client.publish(topic, JSON.stringify(medicines), { qos: 1, retain: false });
  return true;
}

async function publishScheduleForDeviceId(deviceId) {
  const device = await Device.findById(deviceId).lean();
  if (!device || !device.deviceName) {
    return false;
  }

  return publishScheduleForDeviceName(device.deviceName);
}

async function handleHeartbeat(deviceName, payload) {
  let device = await Device.findOne({ deviceName });
  const status = normalizeDeviceStatus(payload.status);

  if (!device) {
    device = new Device({
      userId: null,
      deviceName,
      nickname: deviceName,
      status,
      lastSeen: new Date()
    });
    await device.save();
    return;
  }

  device.status = status;
  device.lastSeen = new Date();
  await device.save();
}

async function handleIntake(deviceName, payload) {
  const { medicineId, status, scheduledTime, timestamp } = payload;
  if (!medicineId || !status || !scheduledTime) {
    return;
  }

  const device = await Device.findOne({ deviceName });
  if (!device) {
    return;
  }

  const scheduledAt = normalizeScheduledTime(scheduledTime);
  if (!scheduledAt) {
    return;
  }

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
    update.$set.takenTime = timestamp ? new Date(timestamp) : new Date();
  } else {
    update.$unset = { takenTime: 1 };
  }

  await MedicineIntake.findOneAndUpdate(query, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true
  });
}

async function handleScheduleRequest(deviceName) {
  await publishScheduleForDeviceName(deviceName);
}

async function handleTimeRequest(deviceName) {
  if (!isConnected()) {
    return;
  }

  const topic = getTopic(`device/${deviceName}/time`);
  const payload = {
    epoch: Math.floor(Date.now() / 1000),
    iso: new Date().toISOString()
  };

  client.publish(topic, JSON.stringify(payload), { qos: 1, retain: false });
}

async function onMessage(topic, rawMessage) {
  try {
    const parts = topic.split('/');
    if (parts.length < 4) {
      return;
    }

    const deviceName = parts[2];
    const action = parts[3];

    const messageText = rawMessage.toString();
    const payload = messageText ? JSON.parse(messageText) : {};

    if (action === 'heartbeat') {
      await handleHeartbeat(deviceName, payload);
      return;
    }

    if (action === 'intake') {
      await handleIntake(deviceName, payload);
      return;
    }

    if (action === 'schedule' && parts[4] === 'request') {
      await handleScheduleRequest(deviceName);
      return;
    }

    if (action === 'time' && parts[4] === 'request') {
      await handleTimeRequest(deviceName);
    }
  } catch (error) {
    console.error('MQTT message handling error:', error.message);
  }
}

function initMqtt() {
  if (client) {
    return client;
  }

  client = mqtt.connect(DEFAULT_BROKER, {
    reconnectPeriod: 2000,
    connectTimeout: 10000
  });

  client.on('connect', () => {
    mqttReady = true;
    console.log(`MQTT connected: ${DEFAULT_BROKER}`);

    client.subscribe(getTopic('device/+/heartbeat'), { qos: 1 });
    client.subscribe(getTopic('device/+/intake'), { qos: 1 });
    client.subscribe(getTopic('device/+/schedule/request'), { qos: 1 });
    client.subscribe(getTopic('device/+/time/request'), { qos: 1 });
  });

  client.on('reconnect', () => {
    console.log('MQTT reconnecting...');
  });

  client.on('close', () => {
    mqttReady = false;
    console.log('MQTT connection closed');
  });

  client.on('error', (error) => {
    console.error('MQTT error:', error.message);
  });

  client.on('message', (topic, message) => {
    onMessage(topic, message);
  });

  return client;
}

module.exports = {
  initMqtt,
  isConnected,
  publishScheduleForDeviceName,
  publishScheduleForDeviceId,
  getTopic
};
