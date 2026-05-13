/**
 * Multer middleware for session-file uploads.
 *
 * Uses `memoryStorage` because the eventual destination is MinIO (see
 * `services/storageService.js`). The controller pipes `req.file.buffer`
 * into MinIO and stores only the returned object key on the
 * PatientSessionData row — nothing is written to the API server's disk.
 */

const multer = require('multer');

const allowedTypes = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const fileFilter = (_req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Invalid file type. Only PDF, images, Word, and Excel files are allowed.'), false);
};

module.exports = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB — same as previous disk-based config
});
