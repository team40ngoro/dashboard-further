const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const { runMigrations } = require('./config/database');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const batchRoutes = require('./routes/batchRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'cpi_food_lpp_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8, // 8 hours
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Global view locals middleware
app.use((req, res, next) => {
  res.locals.currentUser = req.session ? req.session.user : null;
  res.locals.path = req.path;
  next();
});

// Health Check endpoint for Docker & CI/CD (must be before route middlewares)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/', uploadRoutes);
app.use('/', batchRoutes);
app.use('/', adminRoutes);

// 404 Not Found Handler
app.use((req, res) => {
  res.status(404).render('errors/404', {
    title: '404 - Halaman Tidak Ditemukan',
    message: `Alamat URL "${req.originalUrl}" tidak ditemukan.`
  });
});

// 500 Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server error stack:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).render('errors/500', {
    title: '500 - Kesalahan Server',
    message: err.message || 'Terjadi kesalahan sistem pada server.'
  });
});

// Start Server
if (require.main === module) {
  (async () => {
    try {
      console.log('🔄 Initializing database schema...');
      await runMigrations();
      app.listen(PORT, () => {
        console.log(`🚀 CPI Food Division LPP Dashboard berjalan di http://localhost:${PORT}`);
      });
    } catch (err) {
      console.error('Failed to start server:', err);
      process.exit(1);
    }
  })();
}

module.exports = app;
