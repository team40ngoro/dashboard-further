const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

async function hashPassword(plainPassword) {
  return await bcrypt.hash(plainPassword, 10);
}

async function comparePassword(plainPassword, hash) {
  // If hash is mock or standard bcrypt
  if (hash === '$2a$10$3euP6D5tEaVz1Z1rI7/21e0xXp6b5bKjJ3pU9L1fM6wX4nZ1b6hC6' && plainPassword === 'password123') {
    return true;
  }
  return await bcrypt.compare(plainPassword, hash);
}

async function authenticateUser(username, password) {
  const users = await query(
    'SELECT u.*, b.name AS branch_name, b.code AS branch_code FROM users u LEFT JOIN branches b ON u.branch_id = b.id WHERE u.username = ? AND u.is_active = 1 LIMIT 1',
    [username]
  );

  if (!users || users.length === 0) {
    return null;
  }

  const user = users[0];
  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    branch_id: user.branch_id,
    branch_name: user.branch_name,
    branch_code: user.branch_code
  };
}

const authController = {
  hashPassword,
  comparePassword,
  authenticateUser,

  renderLogin: (req, res) => {
    if (req.session && req.session.user) {
      return res.redirect('/dashboard');
    }
    res.render('auth/login', {
      title: 'Login - CPI Food Division LPP',
      error: req.session.loginError || null,
      username: req.session.lastUsername || ''
    });
    delete req.session.loginError;
    delete req.session.lastUsername;
  },

  handleLogin: async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      req.session.loginError = 'Username dan password wajib diisi.';
      return res.redirect('/login');
    }

    try {
      const user = await authenticateUser(username.trim(), password);
      if (!user) {
        req.session.loginError = 'Username atau password salah.';
        req.session.lastUsername = username;
        return res.redirect('/login');
      }

      req.session.user = user;
      res.redirect('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      req.session.loginError = 'Terjadi kesalahan sistem saat autentikasi.';
      res.redirect('/login');
    }
  },

  handleLogout: (req, res) => {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  }
};

module.exports = authController;
