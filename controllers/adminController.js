const { query } = require('../config/database');
const { hashPassword } = require('./authController');
const { ROLES, ROLE_LABELS } = require('../config/constants');

async function listBranches() {
  return await query('SELECT * FROM branches ORDER BY id ASC');
}

async function getBranchById(id) {
  const rows = await query('SELECT * FROM branches WHERE id = ?', [Number(id)]);
  return rows[0] || null;
}

async function createBranch({ code, name, city, accessCode = '1234' }) {
  const res = await query(
    'INSERT INTO branches (code, name, city, access_code) VALUES (?, ?, ?, ?)',
    [code.trim().toUpperCase(), name.trim(), city ? city.trim() : null, (accessCode || '1234').trim()]
  );
  return res;
}

async function updateBranch(id, { code, name, city, accessCode }) {
  const branchId = Number(id);
  const existing = await getBranchById(branchId);
  if (!existing) {
    throw new Error('Cabang tidak ditemukan.');
  }

  const newCode = (code !== undefined ? code : existing.code).trim().toUpperCase();
  const newName = (name !== undefined ? name : existing.name).trim();
  const newCity = city !== undefined ? (city ? city.trim() : null) : existing.city;
  const newPin = (accessCode !== undefined ? accessCode : existing.access_code).trim();

  await query(
    'UPDATE branches SET code = ?, name = ?, city = ?, access_code = ? WHERE id = ?',
    [newCode, newName, newCity, newPin, branchId]
  );
  return { id: branchId, code: newCode, name: newName, city: newCity, access_code: newPin };
}

async function deleteBranch(id) {
  const branchId = Number(id);
  const existing = await getBranchById(branchId);
  if (!existing) {
    throw new Error('Cabang tidak ditemukan.');
  }

  // Cek apakah ada data batch yang terhubung ke cabang ini
  const batchCountRows = await query('SELECT COUNT(*) as count FROM production_batches WHERE branch_id = ?', [branchId]);
  const batchCount = batchCountRows[0] ? (Number(batchCountRows[0].count) || Number(batchCountRows[0].total) || 0) : 0;
  if (batchCount > 0) {
    throw new Error(`Cabang "${existing.name}" (${existing.code}) tidak dapat dihapus karena memiliki ${batchCount} riwayat data batch produksi.`);
  }

  // Set users branch_id to null jika ada user yang terhubung
  await query('UPDATE users SET branch_id = NULL WHERE branch_id = ?', [branchId]);

  // Hapus cabang
  await query('DELETE FROM branches WHERE id = ?', [branchId]);
  return { success: true, message: `Cabang ${existing.name} (${existing.code}) berhasil dihapus.` };
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
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
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
    const { code, name, city, accessCode } = req.body;
    if (!code || !name) {
      req.session.errorMessage = 'Kode dan Nama cabang wajib diisi.';
      return res.redirect('/admin/branches');
    }

    try {
      await createBranch({ code, name, city, accessCode: accessCode || '1234' });
      req.session.successMessage = `Cabang ${name} (${code}) dengan PIN ${accessCode || '1234'} berhasil ditambahkan.`;
      res.redirect('/admin/branches');
    } catch (err) {
      console.error('Create branch error:', err);
      req.session.errorMessage = `Gagal membuat cabang: ${err.message}`;
      res.redirect('/admin/branches');
    }
  },

  handleUpdateBranch: async (req, res) => {
    const { id } = req.params;
    const { code, name, city, accessCode } = req.body;

    if (!code || !name) {
      req.session.errorMessage = 'Kode dan Nama cabang wajib diisi.';
      return res.redirect('/admin/branches');
    }

    try {
      await updateBranch(id, { code, name, city, accessCode });
      req.session.successMessage = `Cabang ${name} (${code}) berhasil diperbarui.`;
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({ success: true, message: req.session.successMessage });
      }
      res.redirect('/admin/branches');
    } catch (err) {
      console.error('Update branch error:', err);
      req.session.errorMessage = `Gagal memperbarui cabang: ${err.message}`;
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, message: err.message });
      }
      res.redirect('/admin/branches');
    }
  },

  handleDeleteBranch: async (req, res) => {
    const { id } = req.params;
    try {
      const result = await deleteBranch(id);
      req.session.successMessage = result.message;
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({ success: true, message: result.message });
      }
      res.redirect('/admin/branches');
    } catch (err) {
      console.error('Delete branch error:', err);
      req.session.errorMessage = err.message;
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, message: err.message });
      }
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
