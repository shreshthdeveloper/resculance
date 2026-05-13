const axios = require('axios');
const https = require('https');

const { Ambulance, AmbulanceDevice } = require('../models');
const { AppError } = require('../middleware/auth');
const { success } = require('../utils/response');
const { isValidId, equalIds } = require('../utils/ids');

// External device API (vehicleview.live) often uses self-signed certs
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

const DEVICE_TYPES = ['CAMERA', 'LIVE_LOCATION', 'ECG', 'VITAL_MONITOR', 'GPS_TRACKER'];

function shapeDevice(doc) {
  if (!doc) return null;
  const d = doc.toObject ? doc.toObject() : doc;
  return { ...d, id: String(d._id || d.id), ambulance_id: String(d.ambulance_id) };
}

// Empty strings from form inputs should not overwrite stored credentials.
// React forms commonly send `''` for unset optional fields; treat those as
// "not provided" so a subsequent update doesn't clobber a real username /
// password / api url with a blank.
function cleanOptional(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

// Ensure the caller is allowed to mutate devices on this ambulance.
// Superadmin: pass. Otherwise the caller's organization must either own the
// ambulance, or (for hospital staff) currently be the locked hospital for an
// active partnership-based run.
async function userCanManageAmbulance(req, ambulance) {
  if (!req?.user) return false;
  if (req.user.role === 'superadmin') return true;
  if (!ambulance) return false;

  if (equalIds(ambulance.organization_id, req.user.organizationId)) return true;

  if (req.user.organizationType === 'hospital'
      && ambulance.current_hospital_id
      && equalIds(ambulance.current_hospital_id, req.user.organizationId)) {
    return true;
  }
  return false;
}

class AmbulanceDeviceController {
  static async create(req, res, next) {
    try {
      const { ambulanceId } = req.params;
      const { deviceName, deviceType, deviceId, deviceUsername, devicePassword, deviceApi, manufacturer, model } = req.body;

      if (!deviceName || !deviceType || !deviceId) {
        return next(new AppError('Device name, type, and ID are required', 400));
      }
      if (!DEVICE_TYPES.includes(deviceType)) {
        return next(new AppError(`Invalid device type. Must be one of: ${DEVICE_TYPES.join(', ')}`, 400));
      }
      if (!isValidId(ambulanceId)) return next(new AppError('Invalid ambulance id', 400));

      const ambulance = await Ambulance.findById(ambulanceId).lean();
      if (!ambulance) return next(new AppError('Ambulance not found', 404));

      if (!(await userCanManageAmbulance(req, ambulance))) {
        return next(new AppError('You do not have permission to manage devices on this ambulance', 403));
      }

      // Same ambulance + same device_id is an upsert by design: the device
      // is a physical asset and the user is re-saving its config. We keep
      // pre-existing credentials when the new payload leaves them blank so
      // a typo on the "Device Username" field doesn't wipe stored secrets.
      const existing = await AmbulanceDevice.findOne({ ambulance_id: ambulanceId, device_id: deviceId });
      if (existing) {
        existing.device_name = deviceName;
        existing.device_type = deviceType;
        const newUsername = cleanOptional(deviceUsername);
        const newPassword = cleanOptional(devicePassword);
        const newApi = cleanOptional(deviceApi);
        if (newUsername !== undefined) existing.device_username = newUsername;
        if (newPassword !== undefined) existing.device_password = newPassword;
        if (newApi !== undefined) existing.device_api = newApi;
        if (manufacturer !== undefined) existing.manufacturer = cleanOptional(manufacturer) ?? null;
        if (model !== undefined) existing.model = cleanOptional(model) ?? null;
        await existing.save();
        return success(res, 'Device already exists, updated successfully', shapeDevice(existing));
      }

      const created = await AmbulanceDevice.create({
        ambulance_id: ambulanceId,
        device_name: deviceName,
        device_type: deviceType,
        device_id: deviceId,
        device_username: cleanOptional(deviceUsername),
        device_password: cleanOptional(devicePassword),
        device_api: cleanOptional(deviceApi),
        manufacturer: cleanOptional(manufacturer),
        model: cleanOptional(model)
      });

      return success(res, 'Device added successfully', shapeDevice(created), 201);
    } catch (err) {
      next(err);
    }
  }

  static async getByAmbulance(req, res, next) {
    try {
      const { ambulanceId } = req.params;
      if (!isValidId(ambulanceId)) return next(new AppError('Invalid ambulance id', 400));
      const ambulance = await Ambulance.findById(ambulanceId);
      if (!ambulance) return next(new AppError('Ambulance not found', 404));
      const devices = await AmbulanceDevice.find({ ambulance_id: ambulanceId }).sort({ created_at: -1 }).lean();
      return success(res, 'OK', devices.map(shapeDevice));
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid device id', 400));
      const device = await AmbulanceDevice.findById(id).lean();
      if (!device) return next(new AppError('Device not found', 404));
      return success(res, 'OK', shapeDevice(device));
    } catch (err) {
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid device id', 400));

      const device = await AmbulanceDevice.findById(id);
      if (!device) return next(new AppError('Device not found', 404));

      const ambulance = await Ambulance.findById(device.ambulance_id).lean();
      if (!ambulance) return next(new AppError('Ambulance not found', 404));
      if (!(await userCanManageAmbulance(req, ambulance))) {
        return next(new AppError('You do not have permission to manage devices on this ambulance', 403));
      }

      // Required-string fields can be set with any non-empty value; optional
      // fields go through cleanOptional so blanks don't wipe stored secrets.
      const requiredMap = {
        deviceName: 'device_name',
        deviceType: 'device_type',
        deviceId: 'device_id'
      };
      const optionalMap = {
        deviceUsername: 'device_username',
        devicePassword: 'device_password',
        deviceApi: 'device_api',
        manufacturer: 'manufacturer',
        model: 'model'
      };

      for (const [camel, snake] of Object.entries(requiredMap)) {
        const raw = req.body[camel] !== undefined ? req.body[camel] : req.body[snake];
        if (raw !== undefined) {
          if (typeof raw === 'string' && raw.trim() === '') {
            return next(new AppError(`${snake.replace(/_/g, ' ')} cannot be empty`, 400));
          }
          device[snake] = raw;
        }
      }
      for (const [camel, snake] of Object.entries(optionalMap)) {
        const raw = req.body[camel] !== undefined ? req.body[camel] : req.body[snake];
        if (raw !== undefined) {
          const cleaned = cleanOptional(raw);
          if (cleaned !== undefined) device[snake] = cleaned;
        }
      }
      if (req.body.status !== undefined) device.status = req.body.status;

      if (device.device_type && !DEVICE_TYPES.includes(device.device_type)) {
        return next(new AppError(`Invalid device type. Must be one of: ${DEVICE_TYPES.join(', ')}`, 400));
      }
      await device.save();

      return success(res, 'Device updated successfully', shapeDevice(device));
    } catch (err) {
      next(err);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid device id', 400));
      const device = await AmbulanceDevice.findById(id);
      if (!device) return next(new AppError('Device not found', 404));

      const ambulance = await Ambulance.findById(device.ambulance_id).lean();
      if (!ambulance) return next(new AppError('Ambulance not found', 404));
      if (!(await userCanManageAmbulance(req, ambulance))) {
        return next(new AppError('You do not have permission to manage devices on this ambulance', 403));
      }

      await device.deleteOne();
      return success(res, 'Device deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  static async getDeviceLocation(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid device id', 400));

      const device = await AmbulanceDevice.findById(id).lean();
      if (!device) return next(new AppError('Device not found', 404));

      if (!['GPS_TRACKER', 'LIVE_LOCATION'].includes(device.device_type)) {
        return next(new AppError('Device is not a GPS tracker', 400));
      }
      if (!device.device_id) return next(new AppError('Device ID not configured', 400));

      return success(res, 'OK', {
        deviceId: device.device_id,
        jsession: device.device_password || device.device_username || '',
        apiUrl: 'https://vehicleview.live/808gps/StandardApiAction_getDeviceStatus.action'
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAmbulanceDevicesLocation(req, res, next) {
    try {
      const { ambulanceId } = req.params;
      if (!isValidId(ambulanceId)) return next(new AppError('Invalid ambulance id', 400));

      const devices = await AmbulanceDevice.find({ ambulance_id: ambulanceId }).lean();
      const gpsDevices = devices.filter((d) =>
        ['GPS_TRACKER', 'LIVE_LOCATION'].includes(d.device_type) && d.status === 'active' && d.device_id
      );
      if (gpsDevices.length === 0) return success(res, 'OK', []);

      const apiUrl = 'https://vehicleview.live/808gps/StandardApiAction_getDeviceStatus.action';
      const results = await Promise.all(gpsDevices.map(async (device) => {
        try {
          const response = await axios.get(apiUrl, {
            params: {
              jsession: device.device_password || device.device_username || '',
              devIdno: device.device_id,
              toMap: '1',
              language: 'zh'
            },
            timeout: 10000,
            httpsAgent
          });
          return {
            deviceId: String(device._id),
            deviceName: device.device_name,
            deviceIdno: device.device_id,
            location: response.data
          };
        } catch (e) {
          return {
            deviceId: String(device._id),
            deviceName: device.device_name,
            deviceIdno: device.device_id,
            error: e.message
          };
        }
      }));

      return success(res, 'OK', results);
    } catch (err) {
      next(err);
    }
  }

  static async getDeviceStream(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid device id', 400));

      const device = await AmbulanceDevice.findById(id).lean();
      if (!device) return next(new AppError('Device not found', 404));
      if (device.device_type !== 'CAMERA') return next(new AppError('Device is not a camera', 400));
      if (!device.device_id || !device.device_username || !device.device_password) {
        return next(new AppError('Device credentials not configured', 400));
      }

      const apiBase = device.device_api || 'https://vehicleview.live/808gps';
      return success(res, 'OK', {
        deviceId: device.device_id,
        deviceName: device.device_name,
        username: device.device_username,
        password: device.device_password,
        apiBase,
        loginUrl: `${apiBase}/StandardApiAction_login.action`
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDeviceData(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid device id', 400));

      const device = await AmbulanceDevice.findById(id).lean();
      if (!device) return next(new AppError('Device not found', 404));

      switch (device.device_type) {
        case 'GPS_TRACKER':
        case 'LIVE_LOCATION': {
          try {
            const apiUrl = 'https://vehicleview.live/808gps/StandardApiAction_getDeviceStatus.action';
            const response = await axios.get(apiUrl, {
              params: {
                jsession: device.device_password || device.device_username || '',
                devIdno: device.device_id,
                toMap: '1',
                language: 'zh'
              },
              timeout: 10000,
              httpsAgent
            });
            return res.json({ success: true, deviceType: device.device_type, data: response.data });
          } catch (apiErr) {
            return next(new AppError('Failed to fetch GPS data: ' + apiErr.message, 500));
          }
        }
        case 'CAMERA': {
          try {
            const apiBase = device.device_api || 'https://vehicleview.live/808gps';
            const loginUrl = `${apiBase}/StandardApiAction_login.action`;
            const response = await axios.get(loginUrl, {
              params: { account: device.device_username, password: device.device_password },
              timeout: 10000,
              httpsAgent
            });
            if (response.data?.result !== 0) {
              const errorMsg = response.data?.message || 'Authentication failed';
              return next(new AppError(`Camera authentication failed: ${errorMsg}. Please check device username and password.`, 401));
            }
            const jsession = response.data?.jsession || response.data?.JSESSIONID;
            if (!jsession) return next(new AppError('Failed to obtain camera session', 500));
            // apiBase already contains /808gps (e.g. https://vehicleview.live/808gps);
            // the player path is /open/player/video.html relative to that base.
            const streamUrl = `${apiBase}/open/player/video.html?lang=en&devIdno=${encodeURIComponent(device.device_id)}&jsession=${encodeURIComponent(jsession)}`;
            return res.json({
              success: true,
              deviceType: device.device_type,
              data: { streamUrl, jsession, deviceId: device.device_id }
            });
          } catch (apiErr) {
            return next(new AppError('Failed to fetch camera data: ' + apiErr.message, 500));
          }
        }
        case 'ECG':
        case 'VITAL_MONITOR':
          return res.json({
            success: true,
            deviceType: device.device_type,
            data: {
              deviceId: device.device_id,
              deviceName: device.device_name,
              status: device.status,
              message: 'Real-time data streaming requires device-specific integration'
            }
          });
        default:
          return next(new AppError('Unknown device type', 400));
      }
    } catch (err) {
      next(err);
    }
  }

  static async authenticate(req, res, next) {
    try {
      const { id } = req.params;
      if (!isValidId(id)) return next(new AppError('Invalid device id', 400));

      const device = await AmbulanceDevice.findById(id);
      if (!device) return next(new AppError('Device not found', 404));
      if (!device.device_username || !device.device_password) {
        return next(new AppError('Device authentication credentials not configured', 400));
      }

      const apiBase = device.device_api || 'https://vehicleview.live/808gps';
      const loginUrl = `${apiBase}/StandardApiAction_login.action`;
      try {
        const response = await axios.get(loginUrl, {
          params: { account: device.device_username, password: device.device_password },
          timeout: 10000,
          httpsAgent
        });
        const jsession = response.data?.jsession;
        if (!jsession) return next(new AppError('Failed to obtain session from device API', 500));

        device.jsession = jsession;
        device.last_sync = new Date();
        await device.save();

        return success(res, 'Device authenticated successfully', {
          jsession,
          deviceId: device.device_id,
          // apiBase already contains /808gps (e.g. https://vehicleview.live/808gps),
          // so we only need to append /open/player/video.html (no extra /808gps).
          videoUrl: `${apiBase}/open/player/video.html?lang=en&devIdno=${device.device_id}&jsession=${jsession}`
        });
      } catch (apiErr) {
        return next(new AppError('Failed to authenticate with device API: ' + (apiErr.message || 'Unknown error'), 500));
      }
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AmbulanceDeviceController;
