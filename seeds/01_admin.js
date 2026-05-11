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
const PASSWORD_HASH = 'b4b42c1b36d24fe5751cf46a95a0cdbca49d4d24584880c890e4274d5e231211';

exports.seed = async (knex) => {
  await knex.raw(
    `INSERT INTO roles (id, title, role, status)
     VALUES (?, 'Super Admin', 'super_admin', 1)
     ON CONFLICT (id) DO UPDATE
       SET title = EXCLUDED.title,
           role  = EXCLUDED.role`,
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
  const exists = await knex('users_roles').where({ user_id: ADMIN_ID, role_id: ROLE_ID }).first();
  if (!exists) {
    await knex('users_roles').insert({ user_id: ADMIN_ID, role_id: ROLE_ID });
  }
};
