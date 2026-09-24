const test = require('node:test');
const assert = require('node:assert/strict');

test('Authentication & RBAC / Branch Isolation Test', async (t) => {
  const { authenticateUser, hashPassword, comparePassword } = require('../controllers/authController');
  const { requireAuth, requireRole } = require('../middleware/authMiddleware');
  const { enforceBranchScope } = require('../middleware/branchIsolation');

  await t.test('password hashing & verification works', async () => {
    const raw = 'secretPass123';
    const hashed = await hashPassword(raw);
    assert.notEqual(raw, hashed);
    const isValid = await comparePassword(raw, hashed);
    assert.equal(isValid, true);
    const isInvalid = await comparePassword('wrongPass', hashed);
    assert.equal(isInvalid, false);
  });

  await t.test('authenticates valid seed user', async () => {
    const user = await authenticateUser('admin.pusat', 'password123');
    assert.ok(user, 'Admin pusat should be authenticated');
    assert.equal(user.username, 'admin.pusat');
    assert.equal(user.role, 'admin_pusat');

    const branchUser = await authenticateUser('uploader.cikande', 'password123');
    assert.ok(branchUser, 'Branch user should be authenticated');
    assert.equal(branchUser.branch_id, 1);
    assert.equal(branchUser.role, 'pengunggah_cabang');

    const badLogin = await authenticateUser('admin.pusat', 'wrongpassword');
    assert.equal(badLogin, null, 'Invalid password should fail');
  });

  await t.test('enforces branch isolation for branch users', () => {
    const reqBranch = {
      session: {
        user: { id: 3, username: 'uploader.cikande', role: 'pengunggah_cabang', branch_id: 1 }
      },
      query: { branchId: '2' }, // Trying to access branch 2
      body: { branchId: 2 }
    };
    const res = {
      status: (code) => ({ json: (data) => ({ code, data }), render: () => {} })
    };
    let nextCalled = false;
    enforceBranchScope(reqBranch, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    // Crucial: Branch user must be forced to their own branch (branch_id = 1)
    assert.equal(reqBranch.effectiveBranchId, 1, 'Branch user must be locked to own branch');
  });

  await t.test('allows cross-branch access for central analyst/admin', () => {
    const reqCentral = {
      session: {
        user: { id: 2, username: 'analis.pusat', role: 'analis_pusat', branch_id: null }
      },
      query: { branchId: '2' },
      body: {}
    };
    let nextCalled = false;
    enforceBranchScope(reqCentral, {}, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    // Central user can view requested branch 2 or all branches (null)
    assert.equal(reqCentral.effectiveBranchId, 2, 'Central analyst can view requested branch');
  });
});
