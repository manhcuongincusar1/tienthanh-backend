// 49 rows. Junction: user_id + role_id, both lookup id_map.
const run = require('./lib/runScript');
const {junction} = require('./lib/batch');
const idMap = require('./lib/idMap');

run(__filename, async () => {
  return junction({
    legacyTable: 'users_roles',
    targetTable: 'users_roles',
    conflictCols: ['user_id', 'role_id'],
    mapRow: async (r) => {
      const user_id = await idMap.get('users', r.user_id);
      const role_id = await idMap.get('roles', r.role_id);
      if (!user_id || !role_id) return null; // orphan → skip
      return {user_id, role_id};
    },
  });
});
