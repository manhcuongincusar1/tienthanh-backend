const realEstateFilterSchema = {
  type: 'object',
  properties: {
    status: {
      type: ['array', 'string'],
      description: 'status is type array or string',
      items: {
        type: 'string',
      },
    },
    myRecord: {
      type: 'boolean',
      description: 'type is type boolean',
    },
  },
};
const insertRealEstateSchema = {
  type: 'object',
  properties: {
    creator_sale_id: {type: ['integer', 'string'], pattern: '^[0-9]+$', description: "creator_sale_id is integer (users.id)"},
    address: {
      type: 'string',
      description: 'address is type string',
      maxLength: 250,
    },
    broker_full_name: {
      type: 'string',
      description: 'broker_full_name is type string',
      maxLength: 250,
    },
    broker_phone_number: {
      type: 'string',
      description: 'broker_phone_number is type string',
      maxLength: 10,
    },
    note_change: {
      type: 'string',
      description: 'note_change is type string',
      maxLength: 250,
    },
    saler_phone_number: {
      type: 'string',
      description: 'saler_phone_number is type string',
      maxLength: 10,
    },
    saler_full_name: {
      type: 'string',
      description: 'saler_full_name is type string',
      maxLength: 250,
    },
    full_name: {
      type: 'string',
      description: 'full_name is type string',
      maxLength: 250,
    },
    structure: {
      type: 'string',
      description: 'structure is type string',
      maxLength: 1000,
    },
    note: {
      type: 'string',
      description: 'note is type string',
      maxLength: 1000,
    },
    sale_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'sale_id is integer (sales.id)',
    },
    category_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'category_id is integer (real_estate_category.id)',
    },
    category_title: {
      type: 'string',
      description: 'category_title is type string',
      maxLength: 250,
    },
    real_estate_status_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'real_estate_status_id is integer (real_estate_status.id)',
    },
    parent_real_estate_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'parent_real_estate_id is integer (self-ref)',
    },
    branch_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'branch_id is integer (branches.id)',
    },
    province_city_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'province_city_id is type integer',
      maxLength: 10,
    },
    province_city_title: {
      type: 'string',
      description: 'province_city_title is type string',
      maxLength: 250,
    },
    district_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'district_id is type integer',
      maxLength: 10,
    },
    district_title: {
      type: 'string',
      description: 'district_title is type string',
      maxLength: 250,
    },
    street_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'street_id is type integer',
      maxLength: 10,
    },
    street_title: {
      type: 'string',
      description: 'street_title is type string',
      maxLength: 250,
    },
    ward_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'ward_id is type integer',
      maxLength: 10,
    },
    ward_title: {
      type: 'string',
      description: 'ward_title is type string',
      maxLength: 250,
    },
    type: {
      type: 'integer',
      description: 'type is type integer',
      maxLength: 10,
    },
    agency: {
      type: 'boolean',
      description: 'agency is type boolean',
    },
    goodwill: {type: 'boolean', description: 'goodwill is type boolean'},
    brokerage_fees: {
      type: 'number',
      description: 'brokerage_fees is type number',
      maxLength: 250,
    },
    price: {
      type: 'number',
      description: 'price is type number',
      maxLength: 250,
    },
  },
  required: [
    'creator_sale_id',
    'address',
    'category_id',
    'province_city_id',
    'district_id',
    'street_id',
    'ward_id',
    'type',
    'price',
  ],
};

const checkDuplicateRealEstateSchema = {
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
    street_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'street_id is type integer',
      maxLength: 10,
    },
    address: {
      type: 'string',
      description: 'address is type string',
      maxLength: 250,
    },
    real_estate_status_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'real_estate_status_id is integer',
    },
    real_estate_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'real_estate_id is integer',
    },
    type: {type: 'integer', description: 'type is type integer', maxLength: 10},
  },
  required: [
    'type',
    'province_city_id',
    'district_id',
    'ward_id',
    'street_id',
    'address',
  ],
};

const updateRealEstateSchema = {
  type: 'object',
  properties: {
    address: {type: 'string', description: 'address is type string'},
    saler_phone_number: {
      type: 'string',
      description: 'saler_phone_number is type string',
      maxLength: 10,
    },
    saler_full_name: {
      type: 'string',
      description: 'saler_full_name is type string',
      maxLength: 250,
    },
    broker_full_name: {
      type: 'string',
      description: 'broker_full_name is type string',
      maxLength: 250,
    },
    broker_phone_number: {
      type: 'string',
      description: 'broker_phone_number is type string',
      maxLength: 10,
    },
    branch_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'branch_id is integer',
    },
    sale_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'sale_id is integer',
    },
    category_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'category_id is integer',
    },
    creator_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'creator_id is integer (users.id)',
    },
    category_title: {
      type: 'string',
      description: 'category_title is type string',
      maxLength: 250,
    },
    real_estate_status_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'real_estate_status_id is integer',
    },
    province_city_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'province_city_id is type integer',
      maxLength: 10,
    },
    province_city_title: {
      type: 'string',
      description: 'province_city_title is type string',
      maxLength: 250,
    },
    district_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'district_id is type integer',
      maxLength: 10,
    },
    district_title: {
      type: 'string',
      description: 'district_title is type string',
      maxLength: 250,
    },
    street_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'street_id is type integer',
      maxLength: 10,
    },
    street_title: {
      type: 'string',
      description: 'street_title is type string',
      maxLength: 250,
    },
    ward_id: {
      type: ['integer', 'string'],
      pattern: '^[0-9]+$',
      description: 'ward_id is type integer',
      maxLength: 10,
    },
    ward_title: {
      type: 'string',
      description: 'ward_title is type string',
      maxLength: 250,
    },
    type: {
      type: 'integer',
      description: 'type is type integer',
      maxLength: 10,
    },
    agency: {type: 'boolean', description: 'agency is type boolean'},
    goodwill: {type: 'boolean', description: 'goodwill is type boolean'},
    brokerage_fees: {
      type: 'number',
      description: 'brokerage_fees is type number',
      maxLength: 250,
    },
    price: {
      type: 'number',
      description: 'price is type number',
      maxLength: 250,
    },
  },
  required: [
    'address',
    'category_id',
    'province_city_id',
    'district_id',
    'street_id',
    'ward_id',
    'type',
    'price',
  ],
};

const getRealEstateByIdSchema = {
  type: 'object',
  properties: {
    id: {type: ['integer', 'string'], pattern: '^[0-9]+$', description: 'id is integer (accept stringified for path param)'},
  },
};

const getListRealEstateReportSchema = {
  type: 'object',
  properties: {
    type: {type: 'number', description: 'type is type number', maxLength: 10},
    price_from: {
      type: 'number',
      description: 'price_from is type number',
      maxLength: 10,
    },
    price_to: {
      type: 'number',
      description: 'price_to is type number',
      maxLength: 10,
    },
    start_day: {
      type: 'string',
      description: 'start_day is type string',
      maxLength: 250,
    },
    end_day: {
      type: 'string',
      description: 'end_day is type string',
      maxLength: 250,
    },
    offset: {
      type: 'number',
      description: 'offset is type number',
      maxLength: 10,
    },
    limit: {
      type: 'number',
      description: 'limit is type number',
      maxLength: 10,
    },
    real_estate_status_ids: {
      type: 'array',
      items: {
        type: ['integer', 'string'],
        pattern: '^[0-9]+$',
      },
      description: 'real_estate_status_ids is integer array (accept stringified from query string)',
      maxLength: 20,
    },
    province_city_ids: {
      type: 'array',
      items: {
        type: 'number',
      },
      description: 'province_city_ids is type array number',
      maxLength: 20,
    },
    ward_ids: {
      type: 'array',
      items: {
        type: 'number',
      },
      description: 'wards_ids is type array number',
      maxLength: 20,
    },
    district_ids: {
      type: 'array',
      items: {
        type: 'number',
      },
      description: 'district_ids is type array number',
      maxLength: 20,
    },
  },
};

const getChangeStatusRealEstateReportListSchema = {
  type: 'object',
  properties: {
    type: {type: 'number', description: 'type is type number', maxLength: 10},
    price_from: {
      type: 'number',
      description: 'price_from is type number',
      maxLength: 10,
    },
    price_to: {
      type: 'number',
      description: 'price_to is type number',
      maxLength: 10,
    },
    start_day: {
      type: 'string',
      description: 'start_day is type string',
      maxLength: 250,
    },
    end_day: {
      type: 'string',
      description: 'end_day is type string',
      maxLength: 250,
    },
    is_internal: {
      type: 'boolean',
      description: 'is_internal is type boolean',
      maxLength: 10,
    },
    offset: {
      type: 'number',
      description: 'offset is type number',
      maxLength: 10,
    },
    limit: {
      type: 'number',
      description: 'limit is type number',
      maxLength: 10,
    },
  },
};

const getChangeStatusRealEstateReportChartDataSchema = {
  type: 'object',
  properties: {
    type: {type: 'number', description: 'type is type number', maxLength: 10},
    price_from: {
      type: 'number',
      description: 'price_from is type number',
      maxLength: 10,
    },
    price_to: {
      type: 'number',
      description: 'price_to is type number',
      maxLength: 10,
    },
    start_day: {
      type: 'string',
      description: 'start_day is type string',
      maxLength: 250,
    },
    end_day: {
      type: 'string',
      description: 'end_day is type string',
      maxLength: 250,
    },
    is_internal: {
      type: 'boolean',
      description: 'is_internal is type boolean',
      maxLength: 10,
    },
  },
};

const getListRealEstateDataReportSchema = {
  type: 'object',
  properties: {
    type: {type: 'number', description: 'type is type number', maxLength: 10},
    price_from: {
      type: 'number',
      description: 'price_from is type number',
      maxLength: 10,
    },
    price_to: {
      type: 'number',
      description: 'price_to is type number',
      maxLength: 10,
    },
    start_day: {
      type: 'string',
      description: 'start_day is type string',
      maxLength: 250,
    },
    end_day: {
      type: 'string',
      description: 'end_day is type string',
      maxLength: 250,
    },
    province_city_ids: {
      type: 'array',
      items: {
        type: 'number',
      },
      description: 'province_city_ids is type array number',
      maxLength: 20,
    },
    ward_ids: {
      type: 'array',
      items: {
        type: 'number',
      },
      description: 'wards_ids is type array number',
      maxLength: 20,
    },
    district_ids: {
      type: 'array',
      items: {
        type: 'number',
      },
      description: 'district_ids is type array number',
      maxLength: 20,
    },
    type_chart: {
      type: 'string',
      description: 'type_chart is type string',
      maxLength: 250,
    },
  },
};

module.exports = {
  realEstateFilterSchema,
  insertRealEstateSchema,
  checkDuplicateRealEstateSchema,
  getListRealEstateDataReportSchema,
  getRealEstateByIdSchema,
  updateRealEstateSchema,
  getListRealEstateReportSchema,
  getChangeStatusRealEstateReportListSchema,
  getChangeStatusRealEstateReportChartDataSchema,
};
