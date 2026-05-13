const getCustomerListSellRentSchema = {
  type: 'object',
  properties: {
    province_city_id: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'province_city_id is type array',
      maxLength: 250,
    },
    district_id: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'district_id is type array',
      maxLength: 250,
    },
    keyword: {
      type: 'string',
      description: 'keyword is type string',
      maxLength: 250,
    },
    creator_sale_id: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'creator_sale_id is type array',
      maxLength: 250,
    },
    range_price_to: {
      type: 'double',
      description: 'rang_price_to is type double',
      maxLength: 250,
    },
    range_price_from: {
      type: 'double',
      description: 'rang_price_from is type double',
      maxLength: 20,
    },
    real_estate_status: {
      type: 'integer',
      description: 'real_estate_status is type integer',
      maxLength: 20,
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

const getCustomerBuyRentSchema = {
  type: 'object',
  properties: {
    province_city_id: {
      type: 'array',
      items: {
        type: 'number',
      },
      description: 'province_city_id is type array of number',
      maxLength: 250,
    },
    districts_id: {
      type: 'array',
      items: {
        type: 'number',
      },
      description: 'district_id is type array of number',
      maxLength: 250,
    },
    keyword: {
      type: 'string',
      description: 'keyword is type string',
      maxLength: 250,
    },
    branch_id: {
      type: 'string',
      description: 'branch_id is type string',
      maxLength: 250,
    },
    creator_sale_id: {
      type: 'array',
      items: {
        type: 'string',
      },
      description: 'creator_sale_id is type array',
      maxLength: 250,
    },
    price_to: {
      type: 'number',
      description: 'price_to is type integer',
      maxLength: 250,
    },
    price_from: {
      type: 'number',
      description: 'price_from is type integer',
      maxLength: 20,
    },
    demand_type: {
      type: 'integer',
      description: 'demand_type is type integer',
      maxLength: 20,
    },
    goodwill: {
      type: 'string',
      description: 'goodwill is type string',
      maxLength: 20,
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
const getTransactionHistorySchema = {
  type: 'object',
  properties: {
    customer_id: {
      type: 'string',
      description: 'customer_id is type string',
      maxLength: 250,
      pattern: '^[0-9]+$',
    },

    broker_id: {
      type: 'string',
      description: 'customer_id is type string',
      maxLength: 250,
      pattern: '^[0-9]+$',
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

const getCustomerInfoByIdSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'customer_id is type string',
      maxLength: 250,
      pattern: '^[0-9]+$',
    },
  },
};

const checkExistPhoneNumberSchema = {
  type: 'object',
  properties: {
    phone_phone_number: {
      type: 'string',
      description: 'phone is type string',
      maxLength: 10,
    },
    customer_id: {
      type: 'string',
      description: 'customer_id is type string',
      maxLength: 250,
      pattern: '^[0-9]+$',
    },
    branch_id: {
      type: 'string',
      description: 'customer_id is type string',
      maxLength: 250,
      pattern: '^[0-9]+$',
    },
    id: {
      type: 'string',
      description: 'id is type string',
      maxLength: 250,
      pattern: '^[0-9]+$',
    },
  },
};
const updateCustomerSellRentByIdSchema = {
  type: 'object',
  properties: {
    full_name: {
      type: 'string',
      description: 'full_name is type string',
      maxLength: 250,
      required: true,
    },
    phone_number: {
      type: 'string',
      description: 'phone_number is type string',
      maxLength: 20,
      required: true,
    },
  },
};

const insertCustomerBuyRentSchema = {
  type: 'object',
  properties: {
    full_name: {
      type: 'string',
      description: 'full_name is type string',
      maxLength: 250,
      required: true,
    },
    branch_id: {
      type: 'string',
      description: 'branch_id is type string',
      maxLength: 250,
      required: true,
    },
    phone_number_main: {
      type: 'string',
      description: 'phone_number_main is string',
      maxLength: 10,
      required: true,
    },
    phone_number_sub: {
      type: 'array',
      items: {type: 'string', maxLength: 10},
      description: 'phone_number_sub is array string',
    },
  },
};

const updateCustomerBuyRentSchema = {
  type: 'object',
  properties: {
    full_name: {
      type: 'string',
      description: 'full_name is type string',
      maxLength: 250,
      required: true,
    },
    phone_number_main: {
      type: 'string',
      description: 'phonePrev is string',
      maxLength: 10,
      required: true,
    },
    id: {
      type: 'string',
      description: 'id is type string',
      maxLength: 250,
      required: true,
    },
    phone_number_prev: {
      type: 'array',
      items: {type: 'string', maxLength: 10},
      description: 'phone_prev is type array string',
    },
    phone_number_new: {
      type: 'array',
      items: {type: 'string', maxLength: 10},
      description: 'phoneNew is type array string',
    },
    goodwill: {
      type: 'boolean',
      description: 'goodwill is type boolean',
    },
  },
};

const updateCustomerDemandSchema = {
  type: 'object',
  properties: {
    province_city_id: {
      type: 'number',
      description: 'province_city_id is type number',
      maxLength: 250,
    },
    districts_id: {
      type: 'number',
      description: 'districts_id is type number',
      maxLength: 10,
    },
    type: {
      type: 'number',
      description: 'type is type number',
      maxLength: 10,
    },
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
    uses: {
      type: 'string',
      description: 'uses is type string',
      maxLength: 250,
    },
    note: {
      type: 'string',
      description: 'note is type string',
      maxLength: 250,
    },
    id: {
      type: 'string',
      description: 'id is type string',
      maxLength: 250,
    },
    customer_id: {
      type: 'string',
      description: 'customer_id is type string',
      maxLength: 250,
    },
  },
};

const getDemandBuyRentByCustomerId = {
  type: 'object',
  properties: {
    id: {type: 'string', description: 'id is type string'},
  },
};

const getListPhoneNumberSchema = {
  type: 'object',
  properties: {
    phone_number: {
      type: 'string',
      description: 'phone_number is type string',
      maxLength: 250,
    },
    branch_id: {
      type: 'string',
      description: 'branch_id is type string',
      maxLength: 250,
    },
  },
};

const deleteDemandBuyRentSchema = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Id is type string',
      maxLength: 250,
      required: true,
    },
  },
};

const getListCustomerDataReportSchema = {
  type: 'object',
  properties: {
    end_day: {type: 'string', description: 'end_day is type string'},
    start_day: {type: 'string', description: 'start_day is type string'},
    price_from_sell: {
      type: 'number',
      description: 'price_from_sell is type number',
    },
    price_to_sell: {
      type: 'number',
      description: 'price_to_sell is type number',
    },
    price_from_rent: {
      type: 'number',
      description: 'price_from_rent is type number',
    },
    price_to_rent: {
      type: 'number',
      description: 'price_to_rent is type number',
    },
  },
};
const getListCustomerReportSchema = {
  type: 'object',
  properties: {
    end_day: {type: 'string', description: 'end_day is type string'},
    start_day: {type: 'string', description: 'start_day is type string'},
    offset: {type: 'number', description: 'offset is type number'},
    limit: {type: 'number', description: 'limit is type number'},
    price_from_sell: {
      type: 'number',
      description: 'price_from_sell is type number',
    },
    price_to_sell: {
      type: 'number',
      description: 'price_to_sell is type number',
    },
    price_from_rent: {
      type: 'number',
      description: 'price_from_rent is type number',
    },
    price_to_rent: {
      type: 'number',
      description: 'price_to_rent is type number',
    },
  },
};

module.exports = {
  getCustomerListSellRentSchema,
  getTransactionHistorySchema,
  getCustomerInfoByIdSchema,
  checkExistPhoneNumberSchema,
  updateCustomerSellRentByIdSchema,
  getListPhoneNumberSchema,
  insertCustomerBuyRentSchema,
  getDemandBuyRentByCustomerId,
  getCustomerBuyRentSchema,
  updateCustomerDemandSchema,
  updateCustomerBuyRentSchema,
  getListCustomerReportSchema,
  getListCustomerDataReportSchema,
  deleteDemandBuyRentSchema,
};
