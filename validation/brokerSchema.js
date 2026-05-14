const getBrokerById = {
  type: 'object',
  properties: {
    id: {type: ['integer', 'string'], pattern: '^[0-9]+$', description: "id is type string"},
  },
};

module.exports = {
  getBrokerById,
};
