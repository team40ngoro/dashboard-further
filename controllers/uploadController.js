const fs = require('fs');
const { parseLppExcel } = require('../services/excelParser');
const { validateBatchData } = require('../services/validationService');
const { transaction, query } = require('../config/database');

/**
 * Saves all batch records in an atomic database transaction
 */
async function saveBatchTransaction({ batchData, branchId, userId = null, ipAddress = null }) {
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
      output_good_kg: outputGoodKg,
      source: 'PLANT_PIN_UPLOAD'
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
    const branches = await query('SELECT id, code, name, city FROM branches ORDER BY name ASC');
    res.render('upload/form', {
      title: 'Unggah LPP Excel - CPI Food Division',
      branches,
      error: req.session.uploadError || null
    });
    delete req.session.uploadError;
  },

  handleUploadProcess: async (req, res) => {
    const isAjax = req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest' || (req.headers.accept && req.headers.accept.includes('application/json'));

    if (!req.file) {
      const errMsg = 'Silakan pilih berkas Excel (.xlsx) terlebih dahulu.';
      if (isAjax) return res.status(400).json({ success: false, message: errMsg, errors: [errMsg] });
      req.session.uploadError = errMsg;
      return res.redirect('/upload');
    }

    const filePath = req.file.path;
    const branchId = req.body.branchId ? Number(req.body.branchId) : null;
    const accessCode = req.body.accessCode ? String(req.body.accessCode).trim() : '';

    if (!branchId) {
      if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
      const errMsg = 'Silakan pilih Cabang / Plant terlebih dahulu.';
      if (isAjax) return res.status(400).json({ success: false, message: errMsg, errors: [errMsg] });
      req.session.uploadError = errMsg;
      return res.redirect('/upload');
    }

    if (!accessCode) {
      if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
      const errMsg = 'Silakan masukkan Kode Akses / PIN Cabang.';
      if (isAjax) return res.status(400).json({ success: false, message: errMsg, errors: [errMsg] });
      req.session.uploadError = errMsg;
      return res.redirect('/upload');
    }

    try {
      // 1. Validate Branch & Access Code
      const branchRows = await query('SELECT id, code, name, city, access_code FROM branches WHERE id = ?', [branchId]);
      if (!branchRows || branchRows.length === 0) {
        if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
        const errMsg = 'Cabang yang dipilih tidak ditemukan di sistem.';
        if (isAjax) return res.status(404).json({ success: false, message: errMsg, errors: [errMsg] });
        req.session.uploadError = errMsg;
        return res.redirect('/upload');
      }

      const branch = branchRows[0];
      const validCode = branch.access_code ? String(branch.access_code).trim() : '1234';
      const masterCode = process.env.MASTER_ACCESS_CODE ? String(process.env.MASTER_ACCESS_CODE).trim() : '8888';

      if (accessCode !== validCode && accessCode !== masterCode) {
        if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
        const errMsg = `Kode Akses / PIN untuk cabang ${branch.name} salah. (Default PIN: 1234)`;
        if (isAjax) return res.status(403).json({ success: false, message: errMsg, errors: [errMsg] });
        req.session.uploadError = errMsg;
        return res.redirect('/upload');
      }

      // 2. Parse Excel
      const parsedData = await parseLppExcel(filePath);

      // 3. Validate Batch Data
      const validation = await validateBatchData(parsedData, branch.id);

      // 4. Immediately delete temp file
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }

      // 5. Check if Excel has validation errors
      if (!validation.isValid && isAjax) {
        return res.status(422).json({
          success: false,
          message: 'Validasi data Excel menemukan ketidaksesuaian.',
          errors: validation.errors,
          warnings: validation.warnings
        });
      }

      // 6. Save to session for preview confirmation
      req.session.pendingBatch = {
        data: parsedData,
        branchId: branch.id,
        branchName: branch.name,
        branchCode: branch.code,
        accessCode,
        validation,
        uploadedAt: new Date().toISOString()
      };

      if (isAjax) {
        return res.json({
          success: true,
          message: 'Berkas Excel berhasil diekstrak dan divalidasi!',
          redirectUrl: '/upload/preview',
          summary: {
            batchNumber: parsedData.identity.batchNumber,
            productName: parsedData.identity.productName,
            productionDate: parsedData.identity.productionDate,
            line: parsedData.identity.line,
            totalMaterialKg: parsedData.totalMaterialKg,
            outputGoodKg: parsedData.outputGoodKg,
            calculatedRejectPct: parsedData.calculatedRejectPct
          },
          warnings: validation.warnings || []
        });
      }

      res.redirect('/upload/preview');
    } catch (err) {
      console.error('Upload processing error:', err);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
      const errMsg = `Gagal memproses file: ${err.message}`;
      if (isAjax) return res.status(500).json({ success: false, message: errMsg, errors: [err.message] });
      req.session.uploadError = errMsg;
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
      batch: pendingBatch.data,
      branchName: pendingBatch.branchName,
      branchCode: pendingBatch.branchCode,
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
        userId: null,
        ipAddress: req.ip || req.connection.remoteAddress
      });

      delete req.session.pendingBatch;
      req.session.successMessage = `Batch ${pendingBatch.data.identity.batchNumber} berhasil diimpor dan disimpan ke database untuk cabang ${pendingBatch.branchName}!`;
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
  },

  handleProcessQueueItem: async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Berkas tidak ditemukan.',
        errors: ['Berkas Excel (.xlsx) tidak terlampir.']
      });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname || require('path').basename(filePath);
    const branchId = req.body.branchId ? Number(req.body.branchId) : null;
    const accessCode = req.body.accessCode ? String(req.body.accessCode).trim() : '';

    if (!branchId) {
      if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
      return res.status(400).json({
        success: false,
        fileName,
        message: 'Cabang / Plant belum dipilih.',
        errors: ['Pilih Cabang / Plant terlebih dahulu.']
      });
    }

    if (!accessCode) {
      if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
      return res.status(400).json({
        success: false,
        fileName,
        message: 'Kode Akses / PIN belum diisi.',
        errors: ['Masukkan Kode Akses / PIN Plant.']
      });
    }

    try {
      // 1. Verify Branch & Access Code
      const branchRows = await query('SELECT id, code, name, city, access_code FROM branches WHERE id = ?', [branchId]);
      if (!branchRows || branchRows.length === 0) {
        if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
        return res.status(404).json({
          success: false,
          fileName,
          message: 'Cabang tidak ditemukan.',
          errors: ['Cabang yang dipilih tidak ditemukan di basis data.']
        });
      }

      const branch = branchRows[0];
      const validCode = branch.access_code ? String(branch.access_code).trim() : '1234';
      const masterCode = process.env.MASTER_ACCESS_CODE ? String(process.env.MASTER_ACCESS_CODE).trim() : '8888';

      if (accessCode !== validCode && accessCode !== masterCode) {
        if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (_) {}
        return res.status(403).json({
          success: false,
          fileName,
          message: 'Kode Akses / PIN salah.',
          errors: [`Kode Akses / PIN untuk cabang ${branch.name} tidak sesuai. (Default PIN: 1234)`]
        });
      }

      // 2. Parse Excel
      const parsedData = await parseLppExcel(filePath);

      // 3. Validate against rules & duplicates
      const validation = await validateBatchData(parsedData, branch.id);

      // 4. Cleanup temp file
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }

      // 5. If invalid -> return structured error list without saving
      if (!validation.isValid) {
        return res.status(422).json({
          success: false,
          fileName,
          message: `Validasi berkas "${fileName}" menemukan ketidaksesuaian.`,
          errors: validation.errors,
          warnings: validation.warnings || []
        });
      }

      // 6. If valid -> commit directly to database
      const result = await saveBatchTransaction({
        batchData: parsedData,
        branchId: branch.id,
        userId: null,
        ipAddress: req.ip || req.connection.remoteAddress
      });

      return res.json({
        success: true,
        fileName,
        batchId: result.batchId,
        batchNumber: parsedData.identity.batchNumber,
        productName: parsedData.identity.productName,
        line: parsedData.identity.line,
        productionDate: parsedData.identity.productionDate,
        totalMaterialKg: parsedData.totalMaterialKg,
        outputGoodKg: parsedData.outputGoodKg,
        calculatedRejectPct: parsedData.calculatedRejectPct,
        branchName: branch.name,
        branchCode: branch.code,
        warnings: validation.warnings || []
      });
    } catch (err) {
      console.error('Queue item processing error:', err);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
      return res.status(500).json({
        success: false,
        fileName,
        message: err.message,
        errors: [err.message]
      });
    }
  }
};

module.exports = uploadController;
