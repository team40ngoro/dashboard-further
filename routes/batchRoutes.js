const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { enforceBranchScope } = require('../middleware/branchIsolation');
const { ROLES } = require('../config/constants');

// View batch list and details: all authenticated users with branch isolation
router.get('/batches', requireAuth, enforceBranchScope, batchController.renderList);
router.get('/batches/:id', requireAuth, enforceBranchScope, batchController.renderDetail);

// Edit/Correction allowed for admin_pusat and pengunggah_cabang
const editRoles = [ROLES.ADMIN_PUSAT, ROLES.PENGUNGGAH_CABANG];
router.get('/batches/:id/edit', requireAuth, requireRole(editRoles), enforceBranchScope, batchController.renderEdit);
router.post('/batches/:id/edit', requireAuth, requireRole(editRoles), enforceBranchScope, batchController.handleUpdate);

module.exports = router;
