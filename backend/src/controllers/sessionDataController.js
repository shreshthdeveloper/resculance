const fs = require('fs');

const { PatientSession, PatientSessionData, User } = require('../models');
const { AppError } = require('../middleware/auth');
const { success } = require('../utils/response');
const { isValidId, equalIds } = require('../utils/ids');
const storage = require('../services/storageService');
const log = require('../utils/logger').child('sessionData');

const VALID_TYPES = ['note', 'medication', 'file'];

async function loadEntryWithUser(id) {
  const row = await PatientSessionData.findById(id)
    .populate('added_by', 'first_name last_name email role')
    .lean();
  if (!row) return null;
  return {
    id: String(row._id),
    sessionId: String(row.session_id),
    dataType: row.data_type,
    content: row.content,
    addedBy: row.added_by ? {
      id: String(row.added_by._id),
      name: `${row.added_by.first_name} ${row.added_by.last_name}`,
      email: row.added_by.email,
      role: row.added_by.role
    } : null,
    addedAt: row.added_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class SessionDataController {
  static async addData(req, res, next) {
    try {
      const { sessionId } = req.params;
      const { dataType, content } = req.body;
      if (!isValidId(sessionId)) return next(new AppError('Invalid session id', 400));

      const session = await PatientSession.findById(sessionId);
      if (!session) return next(new AppError('Session not found', 404));

      const activeStatuses = ['onboarded', 'in_transit'];
      if (!activeStatuses.includes((session.status || '').toLowerCase())) {
        return next(new AppError('Can only add data to active sessions', 400));
      }
      if (!VALID_TYPES.includes(dataType)) {
        return next(new AppError('Invalid data type. Must be: note, medication, or file', 400));
      }

      const created = await PatientSessionData.create({
        session_id: sessionId,
        data_type: dataType,
        content,
        added_by: req.user.id
      });
      const sessionData = await loadEntryWithUser(created._id);

      const io = req.app.get('io');
      if (io) io.to(`session_${sessionId}`).emit('session_data_added', { sessionId, data: sessionData });

      return success(res, `${dataType} added successfully`, sessionData, 201);
    } catch (err) {
      next(err);
    }
  }

  static async uploadFile(req, res, next) {
    try {
      const { sessionId } = req.params;
      const file = req.file;
      // Multer is configured with memoryStorage, so `file.buffer` is set and
      // there's never a temp path to clean up on the API server.
      if (!file || !file.buffer) return next(new AppError('No file uploaded', 400));
      if (!isValidId(sessionId)) return next(new AppError('Invalid session id', 400));

      const session = await PatientSession.findById(sessionId);
      if (!session) return next(new AppError('Session not found', 404));

      const activeStatuses = ['onboarded', 'in_transit'];
      if (!activeStatuses.includes((session.status || '').toLowerCase())) {
        return next(new AppError('Can only upload files to active sessions', 400));
      }

      if (!storage.enabled()) {
        log.error('upload blocked: MinIO disabled', null, { sessionId });
        return next(new AppError('File storage is not configured. Please contact support.', 503));
      }

      const uploaded = await storage.uploadBuffer(
        `sessions/${sessionId}`,
        file.originalname,
        file.buffer,
        file.mimetype
      );

      // Store the opaque MinIO key alongside the friendly metadata. Old
      // rows still in the DB have `filepath` pointing at the previous
      // local-disk location — keep that path tolerated in the download
      // handler so legacy files don't break.
      const fileContent = {
        filename: file.originalname,
        storageKey: uploaded.key,
        storageBucket: uploaded.bucket,
        mimetype: uploaded.mimetype,
        size: uploaded.size,
        uploadedAt: new Date().toISOString()
      };

      const created = await PatientSessionData.create({
        session_id: sessionId,
        data_type: 'file',
        content: fileContent,
        added_by: req.user.id
      });
      const sessionData = await loadEntryWithUser(created._id);

      const io = req.app.get('io');
      if (io) io.to(`session_${sessionId}`).emit('session_data_added', { sessionId, data: sessionData });

      log.info('session file uploaded', {
        sessionId, dataId: String(created._id), key: uploaded.key, size: uploaded.size
      });
      return success(res, 'File uploaded successfully', sessionData, 201);
    } catch (err) {
      log.error('uploadFile failed', err, { sessionId: req.params.sessionId });
      next(err);
    }
  }

  static async getAllData(req, res, next) {
    try {
      const { sessionId } = req.params;
      if (!isValidId(sessionId)) return next(new AppError('Invalid session id', 400));

      const session = await PatientSession.findById(sessionId).lean();
      if (!session) return next(new AppError('Session not found', 404));

      const rows = await PatientSessionData.find({ session_id: sessionId })
        .populate('added_by', 'first_name last_name email role')
        .sort({ added_at: 1 })
        .lean();
      const mapped = rows.map((r) => ({
        id: String(r._id),
        sessionId: String(r.session_id),
        dataType: r.data_type,
        content: r.content,
        addedBy: r.added_by ? {
          id: String(r.added_by._id),
          name: `${r.added_by.first_name} ${r.added_by.last_name}`,
          email: r.added_by.email,
          role: r.added_by.role
        } : null,
        addedAt: r.added_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      const counts = { notes: 0, medications: 0, files: 0 };
      mapped.forEach((m) => {
        if (m.dataType === 'note') counts.notes++;
        else if (m.dataType === 'medication') counts.medications++;
        else if (m.dataType === 'file') counts.files++;
      });

      return success(res, 'OK', {
        notes: mapped.filter((m) => m.dataType === 'note'),
        medications: mapped.filter((m) => m.dataType === 'medication'),
        files: mapped.filter((m) => m.dataType === 'file'),
        counts
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDataByType(req, res, next) {
    try {
      const { sessionId, type } = req.params;
      if (!isValidId(sessionId)) return next(new AppError('Invalid session id', 400));
      if (!VALID_TYPES.includes(type)) {
        return next(new AppError('Invalid data type. Must be: note, medication, or file', 400));
      }
      const session = await PatientSession.findById(sessionId).lean();
      if (!session) return next(new AppError('Session not found', 404));

      const rows = await PatientSessionData.find({ session_id: sessionId, data_type: type })
        .populate('added_by', 'first_name last_name email role')
        .sort({ added_at: 1 })
        .lean();
      const items = rows.map((r) => ({
        id: String(r._id),
        sessionId: String(r.session_id),
        dataType: r.data_type,
        content: r.content,
        addedBy: r.added_by ? {
          id: String(r.added_by._id),
          name: `${r.added_by.first_name} ${r.added_by.last_name}`,
          email: r.added_by.email,
          role: r.added_by.role
        } : null,
        addedAt: r.added_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      return success(res, 'OK', { type, items, count: items.length });
    } catch (err) {
      next(err);
    }
  }

  static async deleteData(req, res, next) {
    try {
      const { sessionId, dataId } = req.params;
      if (!isValidId(sessionId) || !isValidId(dataId)) return next(new AppError('Invalid id', 400));

      const session = await PatientSession.findById(sessionId).lean();
      if (!session) return next(new AppError('Session not found', 404));

      const entry = await PatientSessionData.findById(dataId);
      if (!entry) return next(new AppError('Data entry not found', 404));

      const isSuperadmin = req.user.role === 'superadmin';
      const isAdmin = (req.user.role || '').includes('admin');
      const isOwner = equalIds(entry.added_by, req.user.id);
      if (!isSuperadmin && !isAdmin && !isOwner) {
        return next(new AppError('You can only delete your own entries', 403));
      }

      // Clean up the underlying blob if this is a file entry. New rows use
      // a MinIO `storageKey`; pre-migration rows kept the bytes on local
      // disk via `filepath`. Tolerate both so legacy data stays delete-able.
      if (entry.data_type === 'file') {
        const c = entry.content || {};
        if (c.storageKey) {
          await storage.deleteObject(c.storageKey).catch((e) => log.warn('legacy storage delete', { msg: e.message }));
        } else if (c.filepath) {
          try {
            if (fs.existsSync(c.filepath)) fs.unlinkSync(c.filepath);
          } catch (e) {
            log.warn('legacy filesystem delete failed', { path: c.filepath, msg: e.message });
          }
        }
      }
      await entry.deleteOne();

      const io = req.app.get('io');
      if (io) io.to(`session_${sessionId}`).emit('session_data_deleted', { sessionId, dataId });

      return success(res, 'Data entry deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  static async downloadFile(req, res, next) {
    try {
      const { dataId } = req.params;
      if (!isValidId(dataId)) return next(new AppError('Invalid id', 400));

      const entry = await PatientSessionData.findById(dataId).lean();
      if (!entry) return next(new AppError('File not found', 404));
      if (entry.data_type !== 'file') return next(new AppError('This entry is not a file', 400));

      const c = entry.content || {};

      // Preferred path: object lives in MinIO. We issue a short-lived
      // presigned URL and 302 the client to it — the bytes never re-stream
      // through the API server, and the URL carries the original filename
      // in Content-Disposition so the browser saves it correctly.
      if (c.storageKey) {
        try {
          const url = await storage.presignedDownloadUrl(c.storageKey, {
            downloadFilename: c.filename
          });
          if (!url) return next(new AppError('Storage not configured', 503));
          // Cache headers off — the URL is single-use-ish and Auth-derived.
          res.setHeader('Cache-Control', 'no-store');
          return res.redirect(302, url);
        } catch (err) {
          log.error('failed to presign download', err, { dataId, key: c.storageKey });
          return next(new AppError('Unable to generate download URL', 502));
        }
      }

      // Legacy fallback: very early uploads landed on local disk. Stream
      // them as-is so existing references don't 404.
      if (c.filepath && fs.existsSync(c.filepath)) {
        return res.download(c.filepath, c.filename);
      }

      return next(new AppError('File not found on server', 404));
    } catch (err) {
      log.error('downloadFile failed', err, { dataId: req.params.dataId });
      next(err);
    }
  }
}

module.exports = SessionDataController;
