const realEstateStatusSchema = {
  type: 'object',
  properties: {
    type: {type: 'number', required: true},
    title: {
      type: 'string',
      required: true,
      description: 'title is type string',
    },
    isEditableRe: {type: 'boolean'},
    isDefault: {type: 'boolean'},
    isShowInternal: {type: 'boolean'},
    isAllowDuplicate: {type: 'boolean'},
    color: {type: 'string', required: true},
    status: {type: 'integer', description: 'status is type integer'},
  },
};

const isEditableRealEstateStatusSchema = {
  type: 'object',
  properties: {
    isEditableRe: {type: 'boolean', required: true},
  },
};

const isDefaultRealEstateStatusSchema = {
  type: 'object',
  properties: {
    isDefault: {type: 'boolean', required: true},
  },
};
const checkExistRealEstateStatusSchema = {
  type: 'object',
  properties: {
    title: {
      type: 'string',
      required: true,
      description: 'title is type string',
    },
    current_status_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'current_status_id is type string',
    },
  },
};
const activeDeActiveRealEstateStatusSchema = {
  type: 'object',
  properties: {
    status: {type: 'boolean', required: true},
  },
};

module.exports = {
  realEstateStatusSchema,
  isEditableRealEstateStatusSchema,
  isDefaultRealEstateStatusSchema,
  activeDeActiveRealEstateStatusSchema,
  checkExistRealEstateStatusSchema,
};
