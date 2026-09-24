const { query } = require('../config/database');
const { hashPassword } = require('./authController');
const { ROLES, ROLE_LABELS } = require('../config/constants');

async function listBranches() {
  return await query('SELECT * FROM branches ORDER BY id ASC');
}

async function createBranch({ code, name, city }) {
  const res = await query(
    'INSERT INTO branches (code, name, city) VALUES (?, ?, ?)',
    [code.trim().toUpperCase(), name.trim(), city ? city.trim() : null]
  );
  return res;
}

async function listUsers() {
  return await query(`
    SELECT u.id, u.branch_id, u.username, u.password_hash, u.full_name, u.role, u.is_active, u.created_at,
           b.name AS branch_name, b.code AS branch_code
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
    ORDER BY u.id ASC
  `);
}

async function createUser({ username, password, fullName, role, branchId = null }) {
  const passwordHash = await hashPassword(password);
  const branchVal = branchId ? Number(branchId) : null;
  const res = await query(
    'INSERT INTO users (branch_id, username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    [branchVal, username.trim(), passwordHash, fullName.trim(), role, 1]
  );
  return res;
}

const adminController = {
  listBranches,
  createBranch,
  listUsers,
  createUser,

  renderBranches: async (req, res) => {
    const branches = await listBranches();
    res.render('admin/branches', {
      title: 'Manajemen Cabang - Admin Pusat',
      user: req.session.user,
      branches,
      successMessage: req.session.successMessage || null,
      errorMessage: req.session.errorMessage || null
    });
    delete req.session.successMessage;
    delete req.session.errorMessage;
  },

  handleCreateBranch: async (req, res) => {
    const { code, name, city } = req.body;
    if (!code || !name) {
      req.session.errorMessage = 'Kode dan Nama cabang wajib diisi.';
      return res.redirect('/admin/branches');
    }

    try {
      await createBranch({ code, name, city });
      req.session.successMessage = `Cabang ${name} (${code}) berhasil ditambahkan.`;
      res.redirect('/admin/branches');
    } catch (err) {
      console.error('Create branch error:', err);
      req.session.errorMessage = `Gagal membuat cabang: ${err.message}`;
      res.redirect('/admin/branches');
    }
  },

  renderUsers: async (req, res) => {
    const [users, branches] = await Promise.all([
      listUsers(),
      listBranches()
    ]);

    res.render('admin/users', {
      title: 'Manajemen Pengguna - Admin Pusat',
      user: req.session.user,
      users,
      branches,
      roles: ROLES,
      roleLabels: ROLE_LABELS,
      successMessage: req.session.successMessage || null,
      errorMessage: req.session.errorMessage || null
    });
    delete req.session.successMessage;
    delete req.session.errorMessage;
  },

  handleCreateUser: async (req, res) => {
    const { username, password, fullName, role, branchId } = req.body;
    if (!username || !password || !fullName || !role) {
      req.session.errorMessage = 'Seluruh field wajib diisi.';
      return res.redirect('/admin/users');
    }

    try {
      await createUser({ username, password, fullName, role, branchId: branchId || null });
      req.session.successMessage = `Pengguna ${username} (${fullName}) berhasil dibuat.`;
      res.redirect('/admin/users');
    } catch (err) {
      console.error('Create user error:', err);
      req.session.errorMessage = `Gagal membuat pengguna: ${err.message}`;
      res.redirect('/admin/users');
    }
  }
};

module.exports = adminController;
