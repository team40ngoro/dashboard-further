/**
 * Authentication and Role-Based Access Control Middleware
 */

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    res.locals.currentUser = req.session.user;
    return next();
  }
  if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(401).json({ error: 'Sesi anda telah berakhir. Silakan login kembali.' });
  }
  return res.redirect('/login');
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/login');
    }
    const userRole = req.session.user.role;
    if (allowedRoles.includes(userRole)) {
      return next();
    }
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(403).json({ error: 'Akses ditolak. Anda tidak memiliki izin.' });
    }
    return res.status(403).render('errors/403', {
      title: 'Akses Ditolak',
      message: 'Anda tidak memiliki hak akses untuk halaman ini.'
    });
  };
}

module.exports = {
  requireAuth,
  requireRole
};
