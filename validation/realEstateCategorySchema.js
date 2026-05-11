const realEstateCategorySchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      required: true,
      description: 'title is type string',
    },
    status: {type: 'integer', description: 'status is type integer'},
  },
};

const activeDeActiveRealEstateCategorySchema = {
  type: 'object',
  properties: {
    status: {type: 'boolean', required: true},
  },
};

const checkDuplicateRealEstateCategorySchema = {
  type: 'object',
  properties: {
    current_category_id: {
      type: 'string',
      description: 'current_category_id is type string',
    },
    title: {
      type: 'string',
      required: true,
      description: 'current_category_id is type string',
    },
  },
};

module.exports = {
  realEstateCategorySchema,
  activeDeActiveRealEstateCategorySchema,
  checkDuplicateRealEstateCategorySchema,
};
