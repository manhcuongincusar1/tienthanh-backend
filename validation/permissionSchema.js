const getPermissionByIdSchema = {
  type: 'object',
  properties: {
    id: {type: 'string', description: 'id is type string', pattern: '^[0-9]+$'},
  },
};

const updatePermissionByIdSchema = {
  type: 'object',
  properties: {
    id: {type: 'string', description: 'id is type string', pattern: '^[0-9]+$'},
    title: {
      type: 'string',
      description: 'title is type string',
    },
  },
};

module.exports = {
  getPermissionByIdSchema,
  updatePermissionByIdSchema,
};
