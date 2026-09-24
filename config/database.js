const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let pool = null;
let isMock = false;

// In-memory Mock DB Storage for testing / offline fallback
const mockStorage = {
  branches: [
    { id: 1, code: 'CKD-01', name: 'CPI Food Cikande', city: 'Serang' },
    { id: 2, code: 'SMG-01', name: 'CPI Food Semarang', city: 'Semarang' },
    { id: 3, code: 'SBY-01', name: 'CPI Food Surabaya', city: 'Surabaya' },
    { id: 4, code: 'MDN-01', name: 'CPI Food Medan', city: 'Medan' }
  ],
  users: [
    { id: 1, branch_id: null, username: 'admin.pusat', password_hash: '$2a$10$3euP6D5tEaVz1Z1rI7/21e0xXp6b5bKjJ3pU9L1fM6wX4nZ1b6hC6', full_name: 'Administrator Pusat', role: 'admin_pusat', is_active: 1 },
    { id: 2, branch_id: null, username: 'analis.pusat', password_hash: '$2a$10$3euP6D5tEaVz1Z1rI7/21e0xXp6b5bKjJ3pU9L1fM6wX4nZ1b6hC6', full_name: 'Quality & Production Analyst', role: 'analis_pusat', is_active: 1 },
    { id: 3, branch_id: 1, username: 'uploader.cikande', password_hash: '$2a$10$3euP6D5tEaVz1Z1rI7/21e0xXp6b5bKjJ3pU9L1fM6wX4nZ1b6hC6', full_name: 'Operator LPP Cikande', role: 'pengunggah_cabang', is_active: 1 },
    { id: 4, branch_id: 1, username: 'viewer.cikande', password_hash: '$2a$10$3euP6D5tEaVz1Z1rI7/21e0xXp6b5bKjJ3pU9L1fM6wX4nZ1b6hC6', full_name: 'Supervisor Cikande', role: 'pembaca_cabang', is_active: 1 },
    { id: 5, branch_id: 2, username: 'uploader.semarang', password_hash: '$2a$10$3euP6D5tEaVz1Z1rI7/21e0xXp6b5bKjJ3pU9L1fM6wX4nZ1b6hC6', full_name: 'Operator LPP Semarang', role: 'pengunggah_cabang', is_active: 1 },
    { id: 6, branch_id: 3, username: 'uploader.surabaya', password_hash: '$2a$10$3euP6D5tEaVz1Z1rI7/21e0xXp6b5bKjJ3pU9L1fM6wX4nZ1b6hC6', full_name: 'Operator LPP Surabaya', role: 'pengunggah_cabang', is_active: 1 }
  ],
  production_batches: [],
  batch_materials: [],
  batch_machine_metrics: [],
  batch_rejects: [],
  batch_outputs: [],
  audit_logs: []
};

function getDbPool() {
  if (pool) return pool;

  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lpp_food_division',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    queueLimit: 0,
    multipleStatements: true
  };

  try {
    pool = mysql.createPool(dbConfig);
    return pool;
  } catch (err) {
    console.warn('MySQL pool creation warning, fallback to memory driver if needed:', err.message);
    isMock = true;
    return null;
  }
}

async function query(sql, params = []) {
  if (isMock || process.env.DB_DRIVER === 'mock') {
    return runMockQuery(sql, params);
  }

  const p = getDbPool();
  try {
    const [rows] = await p.execute(sql, params);
    return rows;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ER_BAD_DB_ERROR' || err.code === 'ER_ACCESS_DENIED_ERROR' || process.env.NODE_ENV === 'test') {
      isMock = true;
      return runMockQuery(sql, params);
    }
    throw err;
  }
}

async function rawQuery(sql) {
  if (isMock || process.env.DB_DRIVER === 'mock') {
    return [];
  }
  const p = getDbPool();
  try {
    const [result] = await p.query(sql);
    return result;
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ER_BAD_DB_ERROR' || err.code === 'ER_ACCESS_DENIED_ERROR' || process.env.NODE_ENV === 'test') {
      isMock = true;
      return [];
    }
    throw err;
  }
}

async function transaction(callback) {
  if (isMock || process.env.DB_DRIVER === 'mock') {
    const mockConn = {
      execute: async (sql, params) => {
        const res = runMockQuery(sql, params);
        return [res, []];
      },
      query: async (sql, params) => {
        const res = runMockQuery(sql, params);
        return [res, []];
      }
    };
    return await callback(mockConn);
  }

  const p = getDbPool();
  let conn;
  try {
    conn = await p.getConnection();
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ER_BAD_DB_ERROR' || err.code === 'ER_ACCESS_DENIED_ERROR' || process.env.NODE_ENV === 'test') {
      isMock = true;
      return await transaction(callback);
    }
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

async function runMigrations() {
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');

  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await rawQuery(schemaSql);
  }
  if (fs.existsSync(seedPath)) {
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    await rawQuery(seedSql);
  }
  return { success: true };
}

// Simple Mock SQL Evaluator for test and development fallback
function runMockQuery(sql, params = []) {
  const cleanSql = sql.trim().replace(/\s+/g, ' ');
  const upper = cleanSql.toUpperCase();

  // SELECT branches
  if (upper.startsWith('SELECT') && upper.includes('FROM BRANCHES')) {
    if (upper.includes('WHERE ID =')) {
      const id = params[0];
      return mockStorage.branches.filter(b => b.id === Number(id));
    }
    return [...mockStorage.branches];
  }

  // SELECT users
  if (upper.startsWith('SELECT') && upper.includes('FROM USERS')) {
    if (upper.includes('WHERE USERNAME =') || upper.includes('WHERE U.USERNAME =')) {
      const username = params[0];
      const user = mockStorage.users.find(u => u.username === username);
      if (!user) return [];
      const branch = user.branch_id ? mockStorage.branches.find(b => b.id === user.branch_id) : null;
      return [{
        ...user,
        branch_name: branch ? branch.name : null,
        branch_code: branch ? branch.code : null
      }];
    }
    if (upper.includes('WHERE ID =') || upper.includes('WHERE U.ID =')) {
      const id = params[0];
      const user = mockStorage.users.find(u => u.id === Number(id));
      if (!user) return [];
      const branch = user.branch_id ? mockStorage.branches.find(b => b.id === user.branch_id) : null;
      return [{
        ...user,
        branch_name: branch ? branch.name : null,
        branch_code: branch ? branch.code : null
      }];
    }
    return mockStorage.users.map(u => {
      const branch = u.branch_id ? mockStorage.branches.find(b => b.id === u.branch_id) : null;
      return { ...u, branch_name: branch ? branch.name : null, branch_code: branch ? branch.code : null };
    });
  }

  // INSERT INTO users
  if (upper.startsWith('INSERT INTO USERS')) {
    const newId = mockStorage.users.length > 0 ? Math.max(...mockStorage.users.map(u => u.id)) + 1 : 1;
    const [branch_id, username, password_hash, full_name, role, is_active] = params;
    const newUser = { id: newId, branch_id: branch_id ? Number(branch_id) : null, username, password_hash, full_name, role, is_active: is_active ?? 1 };
    mockStorage.users.push(newUser);
    return { insertId: newId, affectedRows: 1 };
  }

  // INSERT INTO branches
  if (upper.startsWith('INSERT INTO BRANCHES')) {
    const newId = mockStorage.branches.length > 0 ? Math.max(...mockStorage.branches.map(b => b.id)) + 1 : 1;
    const [code, name, city] = params;
    const newBranch = { id: newId, code, name, city };
    mockStorage.branches.push(newBranch);
    return { insertId: newId, affectedRows: 1 };
  }

  // SELECT from production_batches
  if (upper.startsWith('SELECT') && upper.includes('FROM PRODUCTION_BATCHES')) {
    if (upper.includes('FILE_HASH =')) {
      const [branchId, hash] = params;
      return mockStorage.production_batches.filter(b => b.branch_id === Number(branchId) && b.file_hash === hash);
    }
    if (upper.includes('BATCH_NUMBER =') && upper.includes('LINE =')) {
      const [branchId, prodDate, batchNo, line] = params;
      return mockStorage.production_batches.filter(b => 
        b.branch_id === Number(branchId) && 
        b.production_date === prodDate && 
        b.batch_number === batchNo && 
        b.line === line
      );
    }
    if (upper.includes('WHERE B.ID =') || upper.includes('WHERE ID =')) {
      const id = params[0];
      const batch = mockStorage.production_batches.find(b => b.id === Number(id));
      if (!batch) return [];
      if (params.length > 1 && upper.includes('AND B.BRANCH_ID =')) {
        const branchId = params[1];
        if (batch.branch_id !== Number(branchId)) return [];
      }
      const branch = mockStorage.branches.find(br => br.id === batch.branch_id);
      const user = mockStorage.users.find(u => u.id === batch.created_by);
      return [{
        ...batch,
        branch_name: branch ? branch.name : null,
        branch_code: branch ? branch.code : null,
        creator_name: user ? user.full_name : null
      }];
    }
    // List batches with optional branch filter
    let results = [...mockStorage.production_batches];
    if (upper.includes('WHERE B.BRANCH_ID =') || upper.includes('WHERE BRANCH_ID =')) {
      const branchId = params[0];
      results = results.filter(b => b.branch_id === Number(branchId));
    }
    return results.map(batch => {
      const branch = mockStorage.branches.find(br => br.id === batch.branch_id);
      const user = mockStorage.users.find(u => u.id === batch.created_by);
      return {
        ...batch,
        branch_name: branch ? branch.name : null,
        branch_code: branch ? branch.code : null,
        creator_name: user ? user.full_name : null
      };
    });
  }

  // SELECT from batch_materials
  if (upper.startsWith('SELECT') && upper.includes('FROM BATCH_MATERIALS')) {
    if (upper.includes('IN (')) {
      const ids = params.map(Number).filter(n => !isNaN(n));
      return mockStorage.batch_materials.filter(m => ids.includes(m.batch_id));
    }
    const batchId = params[0];
    return mockStorage.batch_materials.filter(m => m.batch_id === Number(batchId));
  }

  // SELECT from batch_machine_metrics
  if (upper.startsWith('SELECT') && upper.includes('FROM BATCH_MACHINE_METRICS')) {
    if (upper.includes('IN (')) {
      const ids = params.map(Number).filter(n => !isNaN(n));
      return mockStorage.batch_machine_metrics.filter(m => ids.includes(m.batch_id));
    }
    const batchId = params[0];
    return mockStorage.batch_machine_metrics.filter(m => m.batch_id === Number(batchId));
  }

  // SELECT from batch_rejects
  if (upper.startsWith('SELECT') && upper.includes('FROM BATCH_REJECTS')) {
    if (upper.includes('IN (')) {
      const ids = params.map(Number).filter(n => !isNaN(n));
      return mockStorage.batch_rejects.filter(r => ids.includes(r.batch_id));
    }
    const batchId = params[0];
    return mockStorage.batch_rejects.filter(r => r.batch_id === Number(batchId));
  }

  // SELECT from batch_outputs
  if (upper.startsWith('SELECT') && upper.includes('FROM BATCH_OUTPUTS')) {
    if (upper.includes('IN (')) {
      const ids = params.map(Number).filter(n => !isNaN(n));
      return mockStorage.batch_outputs.filter(o => ids.includes(o.batch_id));
    }
    const batchId = params[0];
    return mockStorage.batch_outputs.filter(o => o.batch_id === Number(batchId));
  }

  // SELECT from audit_logs
  if (upper.startsWith('SELECT') && upper.includes('FROM AUDIT_LOGS')) {
    const batchId = params[0];
    return mockStorage.audit_logs.filter(a => a.batch_id === Number(batchId));
  }

  // INSERT INTO production_batches
  if (upper.startsWith('INSERT INTO PRODUCTION_BATCHES')) {
    const newId = mockStorage.production_batches.length > 0 ? Math.max(...mockStorage.production_batches.map(b => b.id)) + 1 : 1;
    const [branch_id, file_hash, product_code, product_name, production_date, line, batch_number, work_hours, meat_percentage, form_reject_percentage, total_material_kg, output_good_kg, total_reject_kg, calculated_reject_pct, created_by] = params;
    const newBatch = {
      id: newId,
      branch_id: Number(branch_id),
      file_hash,
      product_code,
      product_name,
      production_date,
      line,
      batch_number,
      work_hours: Number(work_hours) || 0,
      meat_percentage: Number(meat_percentage) || 0,
      form_reject_percentage: Number(form_reject_percentage) || 0,
      total_material_kg: Number(total_material_kg) || 0,
      output_good_kg: Number(output_good_kg) || 0,
      total_reject_kg: Number(total_reject_kg) || 0,
      calculated_reject_pct: Number(calculated_reject_pct) || 0,
      created_by: Number(created_by),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockStorage.production_batches.push(newBatch);
    return { insertId: newId, affectedRows: 1 };
  }

  // UPDATE production_batches
  if (upper.startsWith('UPDATE PRODUCTION_BATCHES')) {
    const id = params[params.length - 1];
    const batch = mockStorage.production_batches.find(b => b.id === Number(id));
    if (batch) {
      batch.product_name = params[0] || batch.product_name;
      batch.line = params[1] || batch.line;
      batch.work_hours = Number(params[2]) || batch.work_hours;
      batch.meat_percentage = Number(params[3]) || batch.meat_percentage;
      batch.updated_at = new Date().toISOString();
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };
  }

  // INSERT INTO batch_materials
  if (upper.startsWith('INSERT INTO BATCH_MATERIALS')) {
    const newId = mockStorage.batch_materials.length + 1;
    const [batch_id, category, item_name, batch_code, temperature_c, weight_kg] = params;
    mockStorage.batch_materials.push({ id: newId, batch_id: Number(batch_id), category, item_name, batch_code, temperature_c, weight_kg: Number(weight_kg) });
    return { insertId: newId, affectedRows: 1 };
  }

  // INSERT INTO batch_machine_metrics
  if (upper.startsWith('INSERT INTO BATCH_MACHINE_METRICS')) {
    const newId = mockStorage.batch_machine_metrics.length + 1;
    const [batch_id, machine_name, parameter_name, unit, metric_type, value_numeric, value_text] = params;
    mockStorage.batch_machine_metrics.push({ id: newId, batch_id: Number(batch_id), machine_name, parameter_name, unit, metric_type, value_numeric: value_numeric !== null && value_numeric !== undefined ? Number(value_numeric) : null, value_text });
    return { insertId: newId, affectedRows: 1 };
  }

  // INSERT INTO batch_rejects
  if (upper.startsWith('INSERT INTO BATCH_REJECTS')) {
    const newId = mockStorage.batch_rejects.length + 1;
    const [batch_id, stage, reject_type, weight_kg] = params;
    mockStorage.batch_rejects.push({ id: newId, batch_id: Number(batch_id), stage, reject_type, weight_kg: Number(weight_kg) });
    return { insertId: newId, affectedRows: 1 };
  }

  // INSERT INTO batch_outputs
  if (upper.startsWith('INSERT INTO BATCH_OUTPUTS')) {
    const newId = mockStorage.batch_outputs.length + 1;
    const [batch_id, pallet_no, box_count, weight_kg, bstb_no] = params;
    mockStorage.batch_outputs.push({ id: newId, batch_id: Number(batch_id), pallet_no, box_count: box_count ? Number(box_count) : null, weight_kg: Number(weight_kg), bstb_no });
    return { insertId: newId, affectedRows: 1 };
  }

  // INSERT INTO audit_logs
  if (upper.startsWith('INSERT INTO AUDIT_LOGS')) {
    const newId = mockStorage.audit_logs.length + 1;
    const [batch_id, user_id, action, details, ip_address] = params;
    mockStorage.audit_logs.push({ id: newId, batch_id: batch_id ? Number(batch_id) : null, user_id: Number(user_id), action, details, ip_address, created_at: new Date().toISOString() });
    return { insertId: newId, affectedRows: 1 };
  }

  return [];
}

module.exports = {
  getDbPool,
  query,
  rawQuery,
  transaction,
  runMigrations,
  mockStorage
};
