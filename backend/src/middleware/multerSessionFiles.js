const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'session-files');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const sessionId = req.params.sessionId || 'unknown';
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${sessionId}-${ts}-${safe}`);
  }
});

const allowedTypes = [
  'application/pdf',
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
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
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});
