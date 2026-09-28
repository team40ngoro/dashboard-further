const test = require('node:test');
const assert = require('node:assert/strict');

test('Branch & User Admin Management Test', async (t) => {
  const { createBranch, updateBranch, deleteBranch, getBranchById, createUser, listBranches, listUsers, getCityAbbreviation, generateNextBranchCode } = require('../controllers/adminController');
  const { saveBatchTransaction } = require('../controllers/uploadController');

  let testBranchId = null;

  await t.test('city abbreviation and automatic branch code generation', async () => {
    assert.equal(getCityAbbreviation('Palembang'), 'PLM');
    assert.equal(getCityAbbreviation('Semarang'), 'SMG');
    assert.equal(getCityAbbreviation('Kota Surabaya'), 'SBY');
    assert.equal(getCityAbbreviation('Denpasar'), 'DPS');
    assert.equal(getCityAbbreviation('Makassar'), 'MKS');
    assert.equal(getCityAbbreviation('Jayapura'), 'JPR');

    const autoCode = await generateNextBranchCode('Palembang', 'CPI Food Palembang');
    assert.equal(autoCode, 'PLM-01');

    // Create branch without specifying code -> auto generated
    const created = await createBranch({
      name: 'CPI Food Palembang',
      city: 'Palembang',
      accessCode: '1234'
    });
    assert.ok(created.insertId > 0);

    const branches = await listBranches();
    const plm = branches.find(b => b.name === 'CPI Food Palembang');
    assert.ok(plm);
    assert.equal(plm.code, 'PLM-01');

    // Next Palembang branch should auto-increment to PLM-02
    const nextPlm = await generateNextBranchCode('Palembang');
    assert.equal(nextPlm, 'PLM-02');
  });

  await t.test('create and list branches', async () => {
    const newBranch = await createBranch({
      code: 'BDG-01',
      name: 'CPI Food Bandung',
      city: 'Bandung',
      accessCode: '4321'
    });
    assert.ok(newBranch.insertId > 0);
    testBranchId = newBranch.insertId;

    const branches = await listBranches();
    const bdg = branches.find(b => b.code === 'BDG-01');
    assert.ok(bdg, 'Newly created branch should be listed');
    assert.equal(bdg.name, 'CPI Food Bandung');
    assert.equal(bdg.access_code, '4321');
  });

  await t.test('update branch details and PIN', async () => {
    assert.ok(testBranchId);
    const updated = await updateBranch(testBranchId, {
      code: 'BDG-02',
      name: 'CPI Food Bandung Barat',
      city: 'Padalarang',
      accessCode: '9999'
    });

    assert.equal(updated.code, 'BDG-02');
    assert.equal(updated.name, 'CPI Food Bandung Barat');
    assert.equal(updated.city, 'Padalarang');
    assert.equal(updated.access_code, '9999');

    const branch = await getBranchById(testBranchId);
    assert.equal(branch.code, 'BDG-02');
    assert.equal(branch.access_code, '9999');
  });

  await t.test('delete branch without batches succeeds', async () => {
    assert.ok(testBranchId);
    const result = await deleteBranch(testBranchId);
    assert.equal(result.success, true);

    const branch = await getBranchById(testBranchId);
    assert.equal(branch, null, 'Deleted branch should no longer exist');
  });

  await t.test('prevent delete branch with existing batches', async () => {
    const { mockStorage } = require('../config/database');
    mockStorage.production_batches.push({
      id: 9999,
      branch_id: 1,
      batch_number: 'TEST-BATCH-DEL-01'
    });

    await assert.rejects(
      async () => {
        await deleteBranch(1);
      },
      /tidak dapat dihapus karena memiliki/
    );

    // Clean up
    mockStorage.production_batches = mockStorage.production_batches.filter(b => b.id !== 9999);
  });

  await t.test('create and list user accounts with hashed password', async () => {
    const newUser = await createUser({
      username: 'uploader.bandung',
      password: 'password123',
      fullName: 'Operator LPP Bandung',
      role: 'pengunggah_cabang',
      branchId: 1
    });
    assert.ok(newUser.insertId > 0);

    const users = await listUsers();
    const createdUser = users.find(u => u.username === 'uploader.bandung');
    assert.ok(createdUser, 'Created user should be listed');
    assert.notEqual(createdUser.password_hash, 'password123', 'Password must be hashed');
  });
});
