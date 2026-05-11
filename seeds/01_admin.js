// Local dev admin seed — idempotent (re-run safe).
//   Username: admin@local.test
//   Password: Admin123  (FE regex yêu cầu uppercase+lowercase+digit, ≥6 chars)
//
// FE flow: CryptoJS.AES.encrypt(plaintext, secretKey) ở client →
// BE decrypt → SHA256(password + 'Eng') → users.password.
//   SHA256('Admin123' + 'Eng') = b4b42c1b36d24fe5751cf46a95a0cdbca49d4d24584880c890e4274d5e231211
//
// update_password = now() để bypass force-change-on-first-login flow.

const ADMIN_ID = 1;
const ROLE_ID = 1;
const BRANCH_ID = 1;
const SALE_ID = 1;
const PASSWORD_HASH = 'b4b42c1b36d24fe5751cf46a95a0cdbca49d4d24584880c890e4274d5e231211';

exports.seed = async (knex) => {
  // type=1 (Constants.ROLES_TYPE_ENUM.SUPER_ADMIN) → permissionServices.getPermissions
  // shortcut return {permission_data: true} → FE bypass 403 page.
  await knex.raw(
    `INSERT INTO roles (id, title, role, type, status)
     VALUES (?, 'Super Admin', 'super_admin', 1, 1)
     ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title,
           role  = EXCLUDED.role,
           type  = EXCLUDED.type`,
    [ROLE_ID],
  );
  await knex.raw(`SELECT setval('roles_id_seq', GREATEST((SELECT MAX(id) FROM roles), 1))`);

  await knex.raw(
    `INSERT INTO users (id, full_name, username, email, password, update_password, status)
     VALUES (?, 'Admin Local', 'admin@local.test', 'admin@local.test', ?, now(), 1)
     ON CONFLICT (id) DO UPDATE
       SET password        = EXCLUDED.password,
           update_password = EXCLUDED.update_password,
           status          = EXCLUDED.status`,
    [ADMIN_ID, PASSWORD_HASH],
  );
  await knex.raw(`SELECT setval('users_id_seq', GREATEST((SELECT MAX(id) FROM users), 1))`);

  // users_roles không có UNIQUE constraint → ON CONFLICT không xài.
  // Check trước rồi insert (race-free trong seed context vì single-shot).
  const userRoleExists = await knex('users_roles')
    .where({ user_id: ADMIN_ID, role_id: ROLE_ID })
    .first();
  if (!userRoleExists) {
    await knex('users_roles').insert({ user_id: ADMIN_ID, role_id: ROLE_ID });
  }

  // Branch + sale + sale_branch — FE cần admin gắn workspace để bypass
  // "Bạn không có quyền vào hệ thống này" (src/app.tsx:142). Logic:
  //   fetchUserInfo populate currentUser.currentWorkSpace từ branches_list
  //   ∩ user.branch_id; cả 2 đều phải non-empty.
  await knex.raw(
    `INSERT INTO branches (id, title, code, address, status)
     VALUES (?, 'Local Branch', 'CN1', 'Local dev', 1)
     ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title, code = EXCLUDED.code, status = EXCLUDED.status`,
    [BRANCH_ID],
  );
  await knex.raw(`SELECT setval('branches_id_seq', GREATEST((SELECT MAX(id) FROM branches), 1))`);

  await knex.raw(
    `INSERT INTO sales (id, user_id, status, type)
     VALUES (?, ?, 1, 'sale')
     ON CONFLICT (id) DO UPDATE
       SET user_id = EXCLUDED.user_id, status = EXCLUDED.status, type = EXCLUDED.type`,
    [SALE_ID, ADMIN_ID],
  );
  await knex.raw(`SELECT setval('sales_id_seq', GREATEST((SELECT MAX(id) FROM sales), 1))`);

  // sale_branch không có PK/UNIQUE → check-then-insert.
  const saleBranchExists = await knex('sale_branch')
    .where({ sale_id: SALE_ID, branch_id: BRANCH_ID })
    .first();
  if (!saleBranchExists) {
    await knex('sale_branch').insert({ sale_id: SALE_ID, branch_id: BRANCH_ID });
  }

  // domain_setting — auth/get-login-info intersect user.branch_id với
  // domainSetting.branches (super_admin: dùng nguyên domainSetting.branches).
  // domain_title match DOMAIN_URL env (default 'localhost:8000').
  // domain_setting không có PK/UNIQUE → DELETE-then-INSERT cho idempotent.
  const domainTitle = process.env.DOMAIN_URL || 'localhost:8000';
  await knex('domain_setting').where({ domain_title: domainTitle }).delete();
  await knex('domain_setting').insert({
    domain_title: domainTitle,
    branches: JSON.stringify([BRANCH_ID]),
  });
};
