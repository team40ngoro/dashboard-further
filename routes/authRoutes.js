const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Authentication routes
router.get('/login', authController.renderLogin);
router.post('/login', authController.handleLogin);
router.get('/logout', authController.handleLogout);

module.exports = router;
