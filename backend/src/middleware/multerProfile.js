/**
 * Multer middleware for profile-image uploads.
 *
 * Switched from `diskStorage` to `memoryStorage` when we migrated profile
 * pictures to MinIO. The controller picks the buffer up from `req.file.buffer`
 * and hands it to `storageService.uploadBuffer('profiles', ...)`.
 *
 * Keep the same size/mime constraints — those are pure validation and
 * happen before the buffer is allocated, so a hostile client can't push
 * 100 MB into memory hoping to OOM the API server.
 */

const multer = require('multer');

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only JPG/PNG/WebP/HEIC images are allowed'), false);
};

module.exports = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2 MB cap — profile photos shouldn't be bigger than that
});
