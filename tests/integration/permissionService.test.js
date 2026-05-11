const knexPg = require('../../db/connectKnex');
const permissionService = require('../../services/permissionServices');

describe('PermissionService (PG-backed)', () => {
  beforeAll(async () => {
    await knexPg.raw('DROP TABLE IF EXISTS role_permissions CASCADE');
    await knexPg.raw('DROP TABLE IF EXISTS roles CASCADE');

    await knexPg.schema.createTable('roles', (t) => {
      t.bigIncrements('id').primary();
      t.text('role');
      t.text('title');
      t.smallint('type');
      t.smallint('status');
    });

    await knexPg.schema.createTable('role_permissions', (t) => {
      t.bigInteger('role_id')
        .primary()
        .references('id')
        .inTable('roles')
        .onDelete('CASCADE');
      t.text('title');
      t.jsonb('permission_data').notNullable().defaultTo('{}');
      t.timestamp('updated_at', {useTz: true})
        .notNullable()
        .defaultTo(knexPg.fn.now());
    });

    // Seed
    await knexPg('roles').insert([
      {id: 1, role: 'super_admin', title: 'Super', type: 1, status: 1},
      {id: 2, role: 'admin', title: 'Admin', type: 2, status: 1},
      {id: 3, role: 'sale', title: 'Sale', type: 2, status: 1},
    ]);
  });

  afterAll(async () => {
    await knexPg.schema.dropTableIfExists('role_permissions');
    await knexPg.schema.dropTableIfExists('roles');
  });

  beforeEach(async () => {
    await knexPg('role_permissions').del();
  });

  it('getPermissions super_admin → permission_data: true', async () => {
    const res = await permissionService.getPermissions('super_admin');
    expect(res).toEqual({permission_data: true});
  });

  it('updatePermission upsert + getPermissions backward-compat shape', async () => {
    await permissionService.updatePermission(
      {id: 2, title: 'Admin'},
      {real_estate: ['view', 'update'], customer: ['view']},
    );
    const res = await permissionService.getPermissions('admin');
    expect(res.role_id).toBeTruthy();
    expect(Number(res.role_id)).toBe(2);
    expect(res.permission_data.real_estate).toContain('view');
    expect(res.permission_data.customer).toEqual(['view']);
  });

  it('updatePermission lần 2 → override permission_data', async () => {
    await permissionService.updatePermission({id: 2, title: 'Admin'}, {a: ['x']});
    await permissionService.updatePermission({id: 2, title: 'Admin'}, {b: ['y']});
    const res = await permissionService.getPermissions('admin');
    expect(res.permission_data.a).toBeUndefined();
    expect(res.permission_data.b).toEqual(['y']);
  });

  it('checkExistRoleByRoleId', async () => {
    expect(await permissionService.checkExistRoleByRoleId(2)).toBe(false);
    await permissionService.updatePermission({id: 2, title: 'Admin'}, {a: ['x']});
    expect(await permissionService.checkExistRoleByRoleId(2)).toBe(true);
  });

  it('permissionAccess: super_admin always true', async () => {
    expect(
      await permissionService.permissionAccess(1, 'real_estate', 'view'),
    ).toBe(true);
  });

  it('permissionAccess: check feature_key membership', async () => {
    await permissionService.updatePermission(
      {id: 2, title: 'Admin'},
      {real_estate: ['view', 'update']},
    );
    expect(
      await permissionService.permissionAccess(2, 'real_estate', 'view'),
    ).toBe(true);
    expect(
      await permissionService.permissionAccess(2, 'real_estate', 'delete'),
    ).toBe(false);
    expect(
      await permissionService.permissionAccess(2, 'customer', 'view'),
    ).toBe(false);
  });

  it('getPermissionsList tổng amount', async () => {
    await permissionService.updatePermission(
      {id: 2, title: 'Admin'},
      {real_estate: ['view', 'update'], customer: ['view']}, // 3
    );
    await permissionService.updatePermission(
      {id: 3, title: 'Sale'},
      {real_estate: ['view']}, // 1
    );

    const list = await permissionService.getPermissionsList();
    const admin = list.find((r) => Number(r.id) === 2);
    const sale = list.find((r) => Number(r.id) === 3);
    expect(admin.amount).toBe(3);
    expect(sale.amount).toBe(1);
  });
});
