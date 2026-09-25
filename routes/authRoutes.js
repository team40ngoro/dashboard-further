const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// In open / no-login mode, redirect /login and /logout to /dashboard
router.get('/login', (req, res) => res.redirect('/dashboard'));
router.post('/login', authController.handleLogin);
router.get('/logout', (req, res) => res.redirect('/dashboard'));

module.exports = router;
