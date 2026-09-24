const test = require('node:test');
const assert = require('node:assert/strict');

test('Branch & User Admin Management Test', async (t) => {
  const { createBranch, createUser, listBranches, listUsers } = require('../controllers/adminController');

  await t.test('create and list branches', async () => {
    const newBranch = await createBranch({
      code: 'BDG-01',
      name: 'CPI Food Bandung',
      city: 'Bandung'
    });
    assert.ok(newBranch.insertId > 0);

    const branches = await listBranches();
    const bdg = branches.find(b => b.code === 'BDG-01');
    assert.ok(bdg, 'Newly created branch should be listed');
    assert.equal(bdg.name, 'CPI Food Bandung');
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
