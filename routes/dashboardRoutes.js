const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { enforceBranchScope } = require('../middleware/branchIsolation');

// Public Dashboard with optional branch filter
router.get('/dashboard', enforceBranchScope, dashboardController.renderDashboard);
router.get('/api/dashboard/metrics', enforceBranchScope, dashboardController.getMetricsApi);

// Default redirect root to dashboard
router.get('/', (req, res) => {
  res.redirect('/dashboard');
});

module.exports = router;
