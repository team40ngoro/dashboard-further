const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const uploadMiddleware = require('../middleware/uploadMiddleware');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { ROLES } = require('../config/constants');

// Upload is allowed for admin_pusat and pengunggah_cabang
const uploadRoles = [ROLES.ADMIN_PUSAT, ROLES.PENGUNGGAH_CABANG];

router.get('/upload', requireAuth, requireRole(uploadRoles), uploadController.renderUploadForm);
router.get('/upload/sample-template', requireAuth, requireRole(uploadRoles), uploadController.downloadSampleTemplate);
router.post('/upload/process', requireAuth, requireRole(uploadRoles), uploadMiddleware.single('lppFile'), uploadController.handleUploadProcess);
router.get('/upload/preview', requireAuth, requireRole(uploadRoles), uploadController.renderPreview);
router.post('/upload/commit', requireAuth, requireRole(uploadRoles), uploadController.handleConfirmCommit);
router.post('/upload/cancel', requireAuth, requireRole(uploadRoles), uploadController.handleCancel);

module.exports = router;
