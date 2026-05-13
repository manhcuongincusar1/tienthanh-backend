const updateAccountSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      required: true,
      description: 'id is type string',
    },
    status: {
      type: 'integer',
      required: true,
      description: 'status is type integer',
    },
    email: {
      type: 'string',
      required: true,
      description: 'email is type string',
    },
    raw_phone_number: {
      type: 'string',
      required: true,
      description: 'raw_phone_number is type string',
    },
    full_name: {
      type: 'string',
      required: true,
      description: 'full_name is type string',
    },
    role: {
      type: 'string',
      required: true,
      description: 'role is type string',
    },
    branch: {
      type: 'string',
      description: 'branch is type string',
    },
    districts: {
      type: 'array',
      items: {
        type: 'integer',
      },
      description: 'districts is type array of integer',
    },
    sell_price_range: {
      type: 'array',
      description: 'sell_price_range is type array',
    },
    rent_price_range: {
      type: 'array',
      description: 'rent_price_range is type array',
    },
  },
};

const updateStatusById = {
  type: 'object',
  properties: {
    id: {type: 'integer', description: 'Id is type integer'},
    status: {type: 'integer', description: 'status is type integer'},
  },
};

const getAccountByIdSchema = {
  type: 'object',
  properties: {
    id: {type: 'string', description: 'Id is type string', pattern: '^[0-9]+$'},
  },
};

const updatePasswordById = {
  type: 'object',
  properties: {
    id: {type: 'integer', description: 'Id is type integer'},
    status: {type: 'string', description: 'password is type string'},
  },
};

module.exports = {
  updateAccountSchema,
  updateStatusById,
  updatePasswordById,
  getAccountByIdSchema,
};
