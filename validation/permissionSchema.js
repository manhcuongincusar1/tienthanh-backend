const getPermissionByIdSchema = {
  type: 'object',
  properties: {
    id: {type: 'string', description: 'id is type string', format: 'uuid'},
  },
};

const updatePermissionByIdSchema = {
  type: 'object',
  properties: {
    id: {type: 'string', description: 'id is type string', format: 'uuid'},
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
