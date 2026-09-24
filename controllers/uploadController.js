const fs = require('fs');
const { parseLppExcel } = require('../services/excelParser');
const { validateBatchData } = require('../services/validationService');
const { transaction, query } = require('../config/database');
const { ROLES } = require('../config/constants');

/**
 * Saves all batch records in an atomic database transaction
 */
async function saveBatchTransaction({ batchData, branchId, userId, ipAddress = null }) {
  return await transaction(async (conn) => {
    const { identity, materials, machineMetrics, rejects, outputs, fileHash, totalMaterialKg, outputGoodKg, totalRejectKg, calculatedRejectPct } = batchData;

    // 1. Insert production_batches
    const insertBatchSql = `
      INSERT INTO production_batches 
      (branch_id, file_hash, product_code, product_name, production_date, line, batch_number, work_hours, meat_percentage, form_reject_percentage, total_material_kg, output_good_kg, total_reject_kg, calculated_reject_pct, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const batchParams = [
      branchId,
      fileHash,
      identity.productCode,
      identity.productName,
      identity.productionDate,
      identity.line,
      identity.batchNumber,
      identity.workHours,
      identity.meatPercentage,
      identity.formRejectPercentage,
      totalMaterialKg,
      outputGoodKg,
      totalRejectKg,
      calculatedRejectPct,
      userId
    ];

    const [batchResult] = await conn.execute(insertBatchSql, batchParams);
    const batchId = batchResult.insertId;

    // 2. Insert batch_materials
    if (materials && materials.length > 0) {
      for (const m of materials) {
        const matSql = `
          INSERT INTO batch_materials (batch_id, category, item_name, batch_code, temperature_c, weight_kg)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        await conn.execute(matSql, [
          batchId,
          m.category,
          m.itemName,
          m.batchCode || null,
          m.temperatureC !== null && m.temperatureC !== undefined ? m.temperatureC : null,
          m.weightKg
        ]);
      }
    }

    // 3. Insert batch_machine_metrics (EAV)
    if (machineMetrics && machineMetrics.length > 0) {
      for (const mm of machineMetrics) {
        const metricSql = `
          INSERT INTO batch_machine_metrics (batch_id, machine_name, parameter_name, unit, metric_type, value_numeric, value_text)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await conn.execute(metricSql, [
          batchId,
          mm.machineName,
          mm.parameterName,
          mm.unit,
          mm.metricType || 'actual',
          mm.valueNumeric !== undefined ? mm.valueNumeric : null,
          mm.valueText || null
        ]);
      }
    }

    // 4. Insert batch_rejects
    if (rejects && rejects.length > 0) {
      for (const r of rejects) {
        const rejSql = `
          INSERT INTO batch_rejects (batch_id, stage, reject_type, weight_kg)
          VALUES (?, ?, ?, ?)
        `;
        await conn.execute(rejSql, [
          batchId,
          r.stage,
          r.rejectType,
          r.weightKg
        ]);
      }
    }

    // 5. Insert batch_outputs
    if (outputs && outputs.length > 0) {
      for (const o of outputs) {
        const outSql = `
          INSERT INTO batch_outputs (batch_id, pallet_no, box_count, weight_kg, bstb_no)
          VALUES (?, ?, ?, ?, ?)
        `;
        await conn.execute(outSql, [
          batchId,
          o.palletNo,
          o.boxCount || null,
          o.weightKg,
          o.bstbNo || null
        ]);
      }
    }

    // 6. Insert audit_logs
    const auditSql = `
      INSERT INTO audit_logs (batch_id, user_id, action, details, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `;
    const details = JSON.stringify({
      batch_number: identity.batchNumber,
      product: identity.productName,
      date: identity.productionDate,
      total_material_kg: totalMaterialKg,
      output_good_kg: outputGoodKg
    });
    await conn.execute(auditSql, [
      batchId,
      userId,
      'IMPORT_BATCH',
      details,
      ipAddress
    ]);

    return { success: true, batchId };
  });
}

const uploadController = {
  saveBatchTransaction,

  renderUploadForm: async (req, res) => {
    // If user is central admin/analyst, allow branch selection
    const branches = await query('SELECT id, code, name, city FROM branches ORDER BY name ASC');
    res.render('upload/form', {
      title: 'Unggah LPP Excel - CPI Food Division',
      user: req.session.user,
      branches,
      error: req.session.uploadError || null
    });
    delete req.session.uploadError;
  },

  handleUploadProcess: async (req, res) => {
    if (!req.file) {
      req.session.uploadError = 'Silakan pilih file Excel (.xlsx) terlebih dahulu.';
      return res.redirect('/upload');
    }

    const filePath = req.file.path;
    const user = req.session.user;
    const targetBranchId = (user.role === ROLES.ADMIN_PUSAT || user.role === ROLES.ANALIS_PUSAT)
      ? Number(req.body.branchId || user.branch_id || 1)
      : user.branch_id;

    try {
      // 1. Parse Excel
      const parsedData = await parseLppExcel(filePath);

      // 2. Validate
      const validation = await validateBatchData(parsedData, targetBranchId);

      // 3. Immediately delete temp file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Fetch branch name
      const branchRows = await query('SELECT name, code FROM branches WHERE id = ?', [targetBranchId]);
      const branchName = branchRows.length > 0 ? branchRows[0].name : 'Cabang';

      // 4. Save to session for preview confirmation
      req.session.pendingBatch = {
        data: parsedData,
        branchId: targetBranchId,
        branchName,
        validation,
        uploadedAt: new Date().toISOString()
      };

      res.redirect('/upload/preview');
    } catch (err) {
      console.error('Upload processing error:', err);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
      req.session.uploadError = `Gagal memproses file: ${err.message}`;
      res.redirect('/upload');
    }
  },

  renderPreview: (req, res) => {
    const pendingBatch = req.session.pendingBatch;
    if (!pendingBatch) {
      return res.redirect('/upload');
    }

    res.render('upload/preview', {
      title: 'Pratinjau Impor LPP - CPI Food Division',
      user: req.session.user,
      batch: pendingBatch.data,
      branchName: pendingBatch.branchName,
      branchId: pendingBatch.branchId,
      validation: pendingBatch.validation
    });
  },

  handleConfirmCommit: async (req, res) => {
    const pendingBatch = req.session.pendingBatch;
    if (!pendingBatch || !pendingBatch.validation.isValid) {
      req.session.uploadError = 'Data batch tidak valid atau sesi pratinjau telah kedaluwarsa.';
      return res.redirect('/upload');
    }

    try {
      const result = await saveBatchTransaction({
        batchData: pendingBatch.data,
        branchId: pendingBatch.branchId,
        userId: req.session.user.id,
        ipAddress: req.ip || req.connection.remoteAddress
      });

      delete req.session.pendingBatch;
      req.session.successMessage = `Batch ${pendingBatch.data.identity.batchNumber} berhasil diimpor dan disimpan ke database!`;
      res.redirect(`/batches/${result.batchId}`);
    } catch (err) {
      console.error('Error saving batch transaction:', err);
      req.session.uploadError = `Gagal menyimpan batch: ${err.message}`;
      res.redirect('/upload/preview');
    }
  },

  handleCancel: (req, res) => {
    delete req.session.pendingBatch;
    res.redirect('/upload');
  },

  downloadSampleTemplate: async (req, res) => {
    try {
      const { generateSampleExcelBuffer } = require('../services/sampleExcelGenerator');
      const todayStr = new Date().toISOString().split('T')[0];
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const buffer = await generateSampleExcelBuffer({
        productName: 'NUGGET AYAM 500G',
        productCode: 'NUG-500',
        productionDate: todayStr,
        line: 'Line 1',
        batchNumber: `BATCH-${todayStr.replace(/-/g, '')}-${randomSuffix}`
      });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="Contoh_LPP_FP_REV_2.xlsx"');
      res.send(buffer);
    } catch (err) {
      console.error('Error downloading sample template:', err);
      res.redirect('/upload');
    }
  }
};

module.exports = uploadController;
