const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const { enforceBranchScope } = require('../middleware/branchIsolation');

// Public Batch list and details
router.get('/batches', enforceBranchScope, batchController.renderList);
router.get('/batches/:id', enforceBranchScope, batchController.renderDetail);
router.get('/batches/:id/edit', enforceBranchScope, batchController.renderEdit);
router.post('/batches/:id/edit', enforceBranchScope, batchController.handleUpdate);

module.exports = router;
