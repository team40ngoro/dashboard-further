const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/authMiddleware');
const { enforceBranchScope } = require('../middleware/branchIsolation');

router.get('/dashboard', requireAuth, enforceBranchScope, dashboardController.renderDashboard);
router.get('/api/dashboard/metrics', requireAuth, enforceBranchScope, dashboardController.getMetricsApi);

// Default redirect root to dashboard
router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

module.exports = router;
