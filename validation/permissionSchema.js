const getPermissionByIdSchema = {
  type: 'object',
  properties: {
    id: {type: ['integer', 'string'], pattern: '^[0-9]+$', description: "id is type string"},
  },
};

const updatePermissionByIdSchema = {
  type: 'object',
  properties: {
    id: {type: ['integer', 'string'], pattern: '^[0-9]+$', description: "id is type string"},
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
