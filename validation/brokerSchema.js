const getBrokerById = {
  type: 'object',
  properties: {
    id: {type: 'string', description: 'id is type string', pattern: '^[0-9]+$'},
  },
};

module.exports = {
  getBrokerById,
};
