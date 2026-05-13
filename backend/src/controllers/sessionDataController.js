const fs = require('fs');

const { PatientSession, PatientSessionData, User } = require('../models');
const { AppError } = require('../middleware/auth');
const { success } = require('../utils/response');
const { isValidId, equalIds } = require('../utils/ids');

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

      const activeStatuses = ['onboarded', 'in_transit', 'active'];
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
      if (!file) return next(new AppError('No file uploaded', 400));
      if (!isValidId(sessionId)) {
        try { fs.unlinkSync(file.path); } catch {}
        return next(new AppError('Invalid session id', 400));
      }

      const session = await PatientSession.findById(sessionId);
      if (!session) {
        try { fs.unlinkSync(file.path); } catch {}
        return next(new AppError('Session not found', 404));
      }

      const activeStatuses = ['onboarded', 'in_transit', 'active'];
      if (!activeStatuses.includes((session.status || '').toLowerCase())) {
        try { fs.unlinkSync(file.path); } catch {}
        return next(new AppError('Can only upload files to active sessions', 400));
      }

      const fileContent = {
        filename: file.originalname,
        filepath: file.path,
        relativePath: `/uploads/session-files/${file.filename}`,
        mimetype: file.mimetype,
        size: file.size,
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

      return success(res, 'File uploaded successfully', sessionData, 201);
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
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

      if (entry.data_type === 'file' && entry.content?.filepath) {
        try {
          if (fs.existsSync(entry.content.filepath)) fs.unlinkSync(entry.content.filepath);
        } catch (e) {
          console.error('Error deleting file:', e.message);
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

      const filepath = entry.content?.filepath;
      if (!filepath || !fs.existsSync(filepath)) return next(new AppError('File not found on server', 404));
      res.download(filepath, entry.content.filename);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = SessionDataController;
