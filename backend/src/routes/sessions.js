const express = require('express');
const SessionController = require('../controllers/sessionController');
const SessionDataController = require('../controllers/sessionDataController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/multerSessionFiles');

const router = express.Router();

router.use(authenticate);

router.get('/', SessionController.getAllSessions);
router.get('/stats', SessionController.getSessionStats);

// File download must be matched before /:sessionId/data/:type, so register it first.
router.get('/:sessionId/data/files/:dataId/download', SessionDataController.downloadFile);

router.post('/:sessionId/data/upload', upload.single('file'), SessionDataController.uploadFile);

router.post('/:sessionId/data', SessionDataController.addData);
router.get('/:sessionId/data', SessionDataController.getAllData);
router.get('/:sessionId/data/:type', SessionDataController.getDataByType);
router.delete('/:sessionId/data/:dataId', SessionDataController.deleteData);

router.get('/:sessionId', SessionController.getSessionMetadata);

module.exports = router;
