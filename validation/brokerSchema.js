const getBrokerById = {
  type: 'object',
  properties: {
    id: {type: 'string', description: 'id is type string', format: 'uuid'},
  },
};

module.exports = {
  getBrokerById,
};
