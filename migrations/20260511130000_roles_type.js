// roles.type INTEGER — discriminator dùng cho super-admin shortcut.
// Source: schema/sql/7.alter_table_roles_add_column_type.sql + 8.insert_supper_admin_to_roles.sql.
//
// permissionServices.getPermissions(): nếu role.type === 1 → bypass role_permissions
// lookup, return {permission_data: true}. FE app.tsx dùng show403 = !permission_data.

exports.up = async (knex) => {
  await knex.raw(`ALTER TABLE roles ADD COLUMN IF NOT EXISTS type INTEGER DEFAULT NULL`);
};

exports.down = async (knex) => {
  await knex.raw(`ALTER TABLE roles DROP COLUMN IF EXISTS type`);
};
