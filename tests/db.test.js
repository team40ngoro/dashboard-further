const test = require('node:test');
const assert = require('node:assert/strict');

test('Database Configuration & Migration Test', async (t) => {
  const db = require('../config/database');
  assert.ok(db, 'database module should exist');
  assert.equal(typeof db.getDbPool, 'function', 'getDbPool should be a function');
  assert.equal(typeof db.runMigrations, 'function', 'runMigrations should be a function');
  assert.equal(typeof db.query, 'function', 'query should be a function');
  assert.equal(typeof db.transaction, 'function', 'transaction should be a function');
});
