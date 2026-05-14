const getBranchesListSchema = {
  type: 'object',
  properties: {
    province_city_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'province_city_id is type integer',
      maxLength: 10,
    },
    district_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'district_id is type integer',
      maxLength: 10,
    },
    ward_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'ward_id is type integer',
      maxLength: 10,
    },
    keyword: {
      type: 'string',
      description: 'keyword is type string',
      maxLength: 250,
    },
    limit: {
      type: 'integer',
      description: 'limit is type integer',
      maxLength: 20,
    },
    offset: {
      type: 'integer',
      description: 'offset is type integer',
      maxLength: 20,
    },
  },
};

const deletebranchByIdSchema = {
  type: 'object',
  properties: {
    id: {type: ['integer', 'string'], pattern: '^[0-9]+$', description: "id is type string"},
  },
};

const updatebranchByIdSchema = {
  type: 'object',
  properties: {
    province_city_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      required: true,
      description: 'province_city_id is type integer',
      maxLength: 10,
    },
    district_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      required: true,
      description: 'district_id is type integer',
      maxLength: 10,
    },
    ward_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      required: true,
      description: 'ward_id is type integer',
      maxLength: 10,
    },
    address: {
      type: 'string',
      description: 'address is type string',
      maxLength: 250,
    },
    title: {
      type: 'string',
      description: 'title is type string',
      maxLength: 250,
    },
    tax: {type: 'string', description: 'tax is type string', maxLength: 250},
    status: {
      type: 'integer',
      description: 'status is type integer',
      maxLength: 10,
    },
    id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'id is type string',
      required: true,
      maxLength: 250,
    },
  },
};

const createBranchSchema = {
  type: 'object',
  properties: {
    ...updatebranchByIdSchema.properties,
    id: {type: ['integer', 'string'], pattern: '^[0-9]+$', description: "id is type string"},
  },
};
const updateStatusById = {
  type: 'object',
  properties: {
    id: {type: ['integer', 'string'], pattern: '^[0-9]+$', description: "Id is type string"},
    status: {
      type: 'integer',
      description: 'status is type integer',
      maxLength: 10,
    },
  },
};
const checkCodeTax = {
  type: 'object',
  properties: {
    tax: {type: 'string', description: 'tax is type string', maxLength: 250},
  },
};
module.exports = {
  getBranchesListSchema,
  deletebranchByIdSchema,
  updatebranchByIdSchema,
  createBranchSchema,
  updateStatusById,
  checkCodeTax,
};
