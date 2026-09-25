const { query, transaction } = require('../config/database');
const { ROLES } = require('../config/constants');

/**
 * Get batch with all related tables respecting branch isolation
 */
async function getBatchById(batchId, effectiveBranchId = null) {
  let batchSql = `
    SELECT b.*, br.name AS branch_name, br.code AS branch_code, u.full_name AS creator_name
    FROM production_batches b
    JOIN branches br ON b.branch_id = br.id
    LEFT JOIN users u ON b.created_by = u.id
    WHERE b.id = ?
  `;
  const params = [batchId];

  if (effectiveBranchId) {
    batchSql += ' AND b.branch_id = ?';
    params.push(effectiveBranchId);
  }

  const batches = await query(batchSql, params);
  if (!batches || batches.length === 0) {
    return null;
  }

  const batch = batches[0];

  // Fetch related records
  const [materials, machineMetrics, rejects, outputs, auditLogs] = await Promise.all([
    query('SELECT * FROM batch_materials WHERE batch_id = ? ORDER BY id ASC', [batchId]),
    query('SELECT * FROM batch_machine_metrics WHERE batch_id = ? ORDER BY id ASC', [batchId]),
    query('SELECT * FROM batch_rejects WHERE batch_id = ? ORDER BY id ASC', [batchId]),
    query('SELECT * FROM batch_outputs WHERE batch_id = ? ORDER BY id ASC', [batchId]),
    query(`
      SELECT a.*, u.full_name AS user_name, u.role AS user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.batch_id = ?
      ORDER BY a.created_at DESC
    `, [batchId])
  ]);

  return {
    ...batch,
    materials: materials || [],
    machineMetrics: machineMetrics || [],
    rejects: rejects || [],
    outputs: outputs || [],
    auditLogs: auditLogs || []
  };
}

/**
 * List batches with filters and pagination
 */
async function listBatches(filters = {}, effectiveBranchId = null) {
  let sql = `
    SELECT b.*, br.name AS branch_name, br.code AS branch_code, u.full_name AS creator_name
    FROM production_batches b
    JOIN branches br ON b.branch_id = br.id
    LEFT JOIN users u ON b.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  const targetBranch = effectiveBranchId || filters.branchId;
  if (targetBranch) {
    sql += ' AND b.branch_id = ?';
    params.push(Number(targetBranch));
  }

  if (filters.startDate) {
    sql += ' AND b.production_date >= ?';
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    sql += ' AND b.production_date <= ?';
    params.push(filters.endDate);
  }

  if (filters.productCode) {
    sql += ' AND (b.product_code LIKE ? OR b.product_name LIKE ?)';
    params.push(`%${filters.productCode}%`, `%${filters.productCode}%`);
  }

  if (filters.line) {
    sql += ' AND b.line = ?';
    params.push(filters.line);
  }

  sql += ' ORDER BY b.production_date DESC, b.created_at DESC LIMIT 100';

  return await query(sql, params);
}

/**
 * Update batch and write audit log
 */
async function updateBatch(batchId, updateData, userId, ipAddress = null) {
  const currentBatch = await getBatchById(batchId, null);
  if (!currentBatch) {
    throw new Error('Batch tidak ditemukan.');
  }

  return await transaction(async (conn) => {
    const updateSql = `
      UPDATE production_batches 
      SET product_name = ?, line = ?, work_hours = ?, meat_percentage = ?
      WHERE id = ?
    `;
    await conn.execute(updateSql, [
      updateData.productName || currentBatch.product_name,
      updateData.line || currentBatch.line,
      updateData.workHours !== undefined ? updateData.workHours : currentBatch.work_hours,
      updateData.meatPercentage !== undefined ? updateData.meatPercentage : currentBatch.meat_percentage,
      batchId
    ]);

    const auditSql = `
      INSERT INTO audit_logs (batch_id, user_id, action, details, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `;
    const details = JSON.stringify({
      changes: {
        product_name: { old: currentBatch.product_name, new: updateData.productName },
        line: { old: currentBatch.line, new: updateData.line },
        work_hours: { old: currentBatch.work_hours, new: updateData.workHours },
        meat_percentage: { old: currentBatch.meat_percentage, new: updateData.meatPercentage }
      },
      reason: updateData.reason || 'Koreksi data batch oleh pengguna berwenang'
    });

    await conn.execute(auditSql, [batchId, userId, 'UPDATE_BATCH', details, ipAddress]);

    return { success: true };
  });
}

const batchController = {
  getBatchById,
  listBatches,
  updateBatch,

  renderList: async (req, res) => {
    const filters = {
      branchId: req.query.branchId || null,
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      productCode: req.query.productCode || '',
      line: req.query.line || ''
    };

    const [batches, branches] = await Promise.all([
      listBatches(filters, req.effectiveBranchId),
      query('SELECT id, code, name FROM branches ORDER BY name ASC')
    ]);

    res.render('batches/list', {
      title: 'Daftar Batch Produksi LPP - CPI Food Division',
      user: req.session.user,
      batches,
      branches,
      filters,
      successMessage: req.session.successMessage || null,
      errorMessage: req.session.errorMessage || null
    });
    delete req.session.successMessage;
    delete req.session.errorMessage;
  },

  renderDetail: async (req, res) => {
    const batchId = Number(req.params.id);
    const batch = await getBatchById(batchId, req.effectiveBranchId);

    if (!batch) {
      req.session.errorMessage = 'Data batch tidak ditemukan atau anda tidak memiliki izin akses.';
      return res.redirect('/batches');
    }

    res.render('batches/detail', {
      title: `Detail Batch ${batch.batch_number} - CPI Food Division`,
      user: req.session.user,
      batch,
      successMessage: req.session.successMessage || null,
      errorMessage: req.session.errorMessage || null
    });
    delete req.session.successMessage;
    delete req.session.errorMessage;
  },

  renderEdit: async (req, res) => {
    const batchId = Number(req.params.id);
    const batch = await getBatchById(batchId, req.effectiveBranchId);

    if (!batch) {
      req.session.errorMessage = 'Data batch tidak ditemukan.';
      return res.redirect('/batches');
    }

    res.render('batches/edit', {
      title: `Koreksi Batch ${batch.batch_number} - CPI Food Division`,
      user: req.session.user,
      batch,
      errorMessage: req.session.errorMessage || null
    });
    delete req.session.errorMessage;
  },

  handleUpdate: async (req, res) => {
    const batchId = Number(req.params.id);
    const { productName, line, workHours, meatPercentage, reason } = req.body;

    if (!reason || reason.trim() === '') {
      req.session.errorMessage = 'Alasan koreksi data batch wajib diisi untuk catatan audit.';
      return res.redirect(`/batches/${batchId}/edit`);
    }

    try {
      await updateBatch(batchId, {
        productName,
        line,
        workHours: parseFloat(workHours),
        meatPercentage: parseFloat(meatPercentage),
        reason
      }, req.session?.user?.id || null, req.ip || req.connection.remoteAddress);

      req.session.successMessage = `Batch ${batchId} berhasil diperbarui dan dicatat dalam audit trail.`;
      res.redirect(`/batches/${batchId}`);
    } catch (err) {
      console.error('Batch update error:', err);
      req.session.errorMessage = `Gagal mengupdate batch: ${err.message}`;
      res.redirect(`/batches/${batchId}/edit`);
    }
  }
};

module.exports = batchController;
