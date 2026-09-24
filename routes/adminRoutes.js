const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { ROLES } = require('../config/constants');

// Only admin_pusat can access admin routes
router.use(requireAuth, requireRole([ROLES.ADMIN_PUSAT]));

router.get('/admin/branches', adminController.renderBranches);
router.post('/admin/branches', adminController.handleCreateBranch);

router.get('/admin/users', adminController.renderUsers);
router.post('/admin/users', adminController.handleCreateUser);

module.exports = router;
