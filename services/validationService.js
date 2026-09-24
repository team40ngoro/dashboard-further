const { query } = require('../config/database');

/**
 * Validates parsed batch data and performs duplicate detection against branch database
 */
async function validateBatchData(parsedData, branchId) {
  const errors = [...(parsedData.errors || [])];
  const warnings = [...(parsedData.warnings || [])];

  if (!branchId) {
    errors.push('Branch ID tidak valid.');
  }

  const identity = parsedData.identity || {};

  // 1. Mandatory Identity Checks
  if (!identity.productName || identity.productName.trim() === '') {
    errors.push('Nama Produk wajib diisi.');
  }
  if (!identity.productCode || identity.productCode.trim() === '') {
    errors.push('Kode Produk wajib diisi.');
  }
  if (!identity.productionDate) {
    errors.push('Tanggal Produksi wajib diisi dengan format yang benar.');
  }
  if (!identity.line || identity.line.trim() === '') {
    errors.push('Line produksi wajib diisi.');
  }
  if (!identity.batchNumber || identity.batchNumber.trim() === '') {
    errors.push('Nomor Batch wajib diisi.');
  }

  // 2. Numeric Range & Sanity Checks
  if (identity.workHours !== null && identity.workHours !== undefined) {
    if (identity.workHours < 0 || identity.workHours > 24) {
      warnings.push(`Waktu kerja (${identity.workHours} jam) berada di luar batas wajar (0 - 24 jam).`);
    }
  }

  if (identity.meatPercentage !== null && identity.meatPercentage !== undefined) {
    if (identity.meatPercentage < 0 || identity.meatPercentage > 100) {
      warnings.push(`Persentase total meat (${identity.meatPercentage}%) berada di luar rentang (0 - 100%).`);
    }
  }

  // Material weights validation
  const materials = parsedData.materials || [];
  for (const m of materials) {
    if (m.weightKg === null || m.weightKg === undefined || m.weightKg <= 0) {
      errors.push(`Berat bahan "${m.itemName}" tidak boleh negatif atau nol.`);
    }
  }

  // Rejects validation
  const rejects = parsedData.rejects || [];
  for (const r of rejects) {
    if (r.weightKg < 0) {
      errors.push(`Berat rijek "${r.rejectType}" tidak boleh bernilai negatif.`);
    }
  }

  // Outputs validation
  const outputs = parsedData.outputs || [];
  for (const o of outputs) {
    if (o.weightKg <= 0) {
      errors.push(`Berat output produk pada ${o.palletNo} tidak boleh negatif atau nol.`);
    }
  }

  // 3. Duplicate Detection via Database
  if (branchId && identity.batchNumber && identity.productionDate && identity.line) {
    try {
      // Check duplicate batch identity in branch
      const existingBatch = await query(
        'SELECT id, batch_number, production_date, line FROM production_batches WHERE branch_id = ? AND production_date = ? AND batch_number = ? AND line = ? LIMIT 1',
        [branchId, identity.productionDate, identity.batchNumber, identity.line]
      );

      if (existingBatch && existingBatch.length > 0) {
        errors.push(`Batch "${identity.batchNumber}" untuk line "${identity.line}" pada tanggal ${identity.productionDate} sudah pernah diimpor sebelumnya.`);
      }

      // Check duplicate file hash in branch
      if (parsedData.fileHash) {
        const existingHash = await query(
          'SELECT id, batch_number FROM production_batches WHERE branch_id = ? AND file_hash = ? LIMIT 1',
          [branchId, parsedData.fileHash]
        );
        if (existingHash && existingHash.length > 0) {
          warnings.push(`File Excel ini identik dengan batch "${existingHash[0].batch_number}" yang sudah tersimpan.`);
        }
      }
    } catch (dbErr) {
      console.warn('Duplicate check warning:', dbErr.message);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedData: {
      ...parsedData,
      branchId: Number(branchId),
      errors,
      warnings
    }
  };
}

module.exports = {
  validateBatchData
};
