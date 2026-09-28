const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const uploadMiddleware = require('../middleware/uploadMiddleware');

// Public upload flow with Plant PIN access code verification
router.get('/upload', uploadController.renderUploadForm);
router.get('/upload/sample-template', uploadController.downloadSampleTemplate);
router.post('/upload/process', uploadMiddleware.single('lppFile'), uploadController.handleUploadProcess);
router.post('/upload/process-queue-item', uploadMiddleware.single('lppFile'), uploadController.handleProcessQueueItem);
router.get('/upload/preview', uploadController.renderPreview);
router.post('/upload/commit', uploadController.handleConfirmCommit);
router.post('/upload/cancel', uploadController.handleCancel);

module.exports = router;
