const express = require('express');
const router = express.Router();
const RestAPI = require('../../common/rest_api');
const auth = require('../../middlewares/auth');
const _ = require('lodash');
const Common = require('../../common/common');
const {customerSchema} = require('../../validation');
const Validator = require('jsonschema').Validator;
const permission = require('../../middlewares/permission');
const {Worker} = require('worker_threads');
const customerService = require('../../services/customerService');
const checkInvalidBranch = require('../../middlewares/checkInvalidBranch');

router.get(
  '/sell-rent',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('customerSellRentList'),
  getCustomerListSellRent,
);
router.get(
  '/buy-rent',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('customerBuyRentList'),
  getCustomerBuyRent,
);
router.get(
  '/demand-buy-rent/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('customerBuyRentEdit'),
  getDemandBuyRentByCustomerId,
);
router.get(
  '/sell-rent-info/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('customerSellRentEdit'),
  getCustomerSellRentInfoById,
);

router.get(
  '/buy-rent-info/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('customerBuyRentEdit'),
  getCustomerBuyRentInfoById,
);
router.get('/phone-list', auth.authenticateToken, getListPhoneNumber);

router.get(
  '/get-transaction-history',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('customerSellRentEdit'),
  getTransactionHistory,
);

router.post(
  '/delete-demand',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('customerBuyRentEdit'),
  deleteCustomerDemand,
);

router.get(
  '/check-exist-phone-number',
  auth.authenticateToken,
  checkExistPhoneNumber,
);

router.post(
  '/update-sell-rent/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('customerSellRentEdit'),
  updateCustomerSellRentById,
);
router.put(
  '/update-buy-rent/:id',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('customerBuyRentEdit'),
  updateCustomerBuyRent,
);

router.post(
  '/update-demand',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('customerBuyRentEdit'),
  updateCustomerDemand,
);

router.post(
  '/create',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('customerBuyRentCreate'),
  insertCustomerBuyRent,
);

router.get(
  '/list-report',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('reportView'),
  getListCustomerReport,
);
router.get(
  '/data-report',
  auth.authenticateToken,
  checkInvalidBranch(),
  permission('reportView'),
  getListCustomerDataReport,
);

router.post(
  '/generate/customer-buy-rent/:number',
  auth.authenticateToken,
  generateNewCustomer,
);

async function getCustomerListSellRent(req, res) {
  const validator = new Validator();
  const {role, id, permissionInfo} = req.auth;

  const {
    province_city_id,
    creator_sale_id,
    keyword,
    district_id,
    real_estate_status,
    range_price_from,
    range_price_to,
    offset,
    limit,
    sorter,
    branch_id,
  } = req.query;

  const body = {
    province_city_id: province_city_id,
    creator_sale_id: creator_sale_id,
    range_price_to: range_price_to && Number(range_price_to),
    range_price_from: range_price_from && Number(range_price_from),
    keyword,
    district_id: district_id,
    real_estate_status: real_estate_status && Number(real_estate_status),
    offset: offset && Number(offset),
    limit: limit && Number(limit),
    role: role,
    sale_id: id,
    branch_id,
  };

  const resultValid = validator.validate(
    body,
    customerSchema.getCustomerListSellRentSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await customerService.getCustomerListSellRent(
      {
        ...body,
        sorter: JSON.parse(sorter),
      },
      permissionInfo,
      id,
    );

    if (!response) {
      return RestAPI.notFound(res, 'Get customer list sell');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function getListCustomerReport(req, res) {
  const {params} = req.query;
  const newParams = params && JSON.parse(params);
  const validator = new Validator();

  const resultValid = validator.validate(
    newParams,
    customerSchema.getListCustomerReportSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await customerService.getListCustomerReport(newParams);
    if (!response) {
      return RestAPI.notFound(res, 'Get list customer report not found');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function getListCustomerDataReport(req, res) {
  const {params} = req.query;
  const newParams = params && JSON.parse(params);
  const validator = new Validator();

  const resultValid = validator.validate(
    newParams,
    customerSchema.getListCustomerDataReportSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await customerService.getListCustomerDataReport(newParams);
    if (!response) {
      return RestAPI.notFound(res, 'Get list customer report not found');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function getTransactionHistory(req, res) {
  const validator = new Validator();
  const {customer_id, offset, limit, sorter} = req.query;
  const {id, role} = req.auth;
  const body = {
    sale_id: customer_id,
    offset: Number(offset),
    limit: Number(limit),
    sorter: JSON.parse(sorter),
  };
  const resultValid = validator.validate(
    body,
    customerSchema.getTransactionHistorySchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await customerService.getTransactionHistory({
      role,
      creator_sale_id: id,
      ...body,
    });

    if (!response) {
      return RestAPI.notFound(res, 'Get transaction history not found');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function getCustomerSellRentInfoById(req, res) {
  const {id} = req.params;
  const {id: user_id, permissionInfo} = req.auth;
  const validator = new Validator();

  const resultValid = validator.validate(
    {id},
    customerSchema.getCustomerInfoByIdSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await customerService.getCustomerSellRentInfoById(id, {
      user_id,
      permissionInfo,
    });
    if (!response) {
      return RestAPI.notFound(res, 'Get user info not found');
    }

    if (response === 'forbidden') {
      return RestAPI.forbidden(res, 'forbidden');
    }

    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function getCustomerBuyRentInfoById(req, res) {
  const {id} = req.params;
  const {id: user_id, permissionInfo} = req.auth;
  const validator = new Validator();

  const resultValid = validator.validate(
    {id},
    customerSchema.getCustomerInfoByIdSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await customerService.getCustomerBuyRentInfoById(id, {
      user_id,
      permissionInfo,
    });

    if (response === 'forbidden') {
      return RestAPI.forbidden(res, 'forbidden');
    }

    if (!response) {
      return RestAPI.notFound(res, 'notfound');
    }

    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function checkExistPhoneNumber(req, res) {
  const {phone_number, customer_id, branch_id, type} = req.query;
  const {id} = req.auth;
  const validator = new Validator();

  const resultValid = validator.validate(
    {phone_number, customer_id, id, branch_id},
    customerSchema.checkExistPhoneNumberSchema,
  );

  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }

  try {
    const response = await customerService.checkExistPhoneNumber(
      {phone_number, customer_id, branch_id, type},
      id,
    );

    if (!response) {
      return RestAPI.notFound(res, 'Phone number not exist');
    }

    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function updateCustomerSellRentById(req, res) {
  const {full_name, phone_number, phone_number_sub_list} = req.body;
  const {id} = req.params;
  const validator = new Validator();

  const resultValid = validator.validate(
    {full_name, phone_number},
    customerSchema.updateCustomerSellRentByIdSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await customerService.updateCustomerSellRentById(
      {
        full_name,
        phone_number,
        phone_number_sub_list,
      },
      id,
    );
    if (!response) {
      return RestAPI.notFound(res, 'Update customer phone failed');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function getListPhoneNumber(req, res) {
  const {phone_number, branch_id} = req.query;
  const {id: user_id} = req.auth;
  const validator = new Validator();
  console.log(phone_number, branch_id);
  const resultValid = validator.validate(
    {phone_number, branch_id},
    customerSchema.getListPhoneNumberSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await customerService.getListPhoneNumber(
      phone_number,
      user_id,
      branch_id,
    );
    if (!response) {
      return RestAPI.notFound(res, 'Phone number not found');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

async function insertCustomerBuyRent(req, res) {
  const data = req.body;
  const {id} = req.auth;

  const validator = new Validator();
  const resultValid = validator.validate(
    data,
    customerSchema.insertCustomerBuyRentSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await customerService.insertCustomerBuyRent({
      ...data,
      user_id: id,
    });
    if (!response) {
      return RestAPI.notFound(res, 'Insert customer buy rent error');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function getCustomerBuyRent(req, res) {
  const {params} = req.query;

  const newParams = params && JSON.parse(params);
  const {
    province_city_id,
    creator_sale_id,
    price_to,
    price_from,
    districts_id,
    keyword,
    sorter,
    demand_type,
    goodwill,
    offset,
    limit,
    branch_id,
  } = newParams;
  const {role, id, permissionInfo} = req.auth;
  const validator = new Validator();

  const query = {
    province_city_id: province_city_id,
    creator_sale_id: creator_sale_id,
    price_to: price_to && Number(price_to),
    price_from: price_from && Number(price_from),
    keyword,
    districts_id: districts_id,
    demand_type: demand_type && Number(demand_type),
    offset: offset && Number(offset),
    limit: limit && Number(limit),
    goodwill: goodwill,
    sorter: sorter,
    role: role,
    sale_id: id,
    branch_id: branch_id,
  };

  const resultValid = validator.validate(
    {...query},
    customerSchema.getCustomerBuyRentSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await customerService.getCustomerBuyRent(
      query,
      permissionInfo,
      id,
    );
    if (!response) {
      return RestAPI.serverError(res, 'Internal server error');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function getDemandBuyRentByCustomerId(req, res) {
  const {id} = req.params;
  const {params} = req.query;
  const validator = new Validator();

  const newParams = JSON.parse(params);

  const resultValid = validator.validate(
    {id: id},
    customerSchema.getDemandBuyRentByCustomerId,
  );

  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await customerService.getDemandBuyRentByCustomerId(
      newParams,
      id,
    );
    if (!response) {
      return RestAPI.serverError(res, 'Internal server error');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function updateCustomerDemand(req, res) {
  const validator = new Validator();
  const {
    province_city_id,
    districts_id,
    uses,
    note,
    price_from,
    price_to,
    type,
    id,
    customer_id,
  } = req.body;

  const data = {
    province_city_id: province_city_id ? Number(province_city_id) : undefined,
    districts_id: districts_id ? Number(districts_id) : undefined,
    uses: uses || undefined,
    note: note || undefined,
    price_from: price_from ? Number(price_from) : undefined,
    price_to: price_to ? Number(price_to) : undefined,
    type: type ? Number(type) : undefined,
    customer_id,
    id,
  };

  const resultValid = validator.validate(
    data,
    customerSchema.updateCustomerDemandSchema,
  );

  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }
  try {
    const response = await customerService.updateCustomerDemand(data);
    if (!response) {
      return RestAPI.serverError(res, 'Internal server error');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function deleteCustomerDemand(req, res) {
  const {id} = req.body;
  const validator = new Validator();
  const resultValid = validator.validate(
    {id: id},
    customerSchema.deleteDemandBuyRentSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }

  try {
    const response = await customerService.deleteCustomerDemand(id);
    if (!response) {
      return RestAPI.serverError(res, 'Internal server error');
    }
    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function updateCustomerBuyRent(req, res) {
  const {
    full_name,
    phone_number_main,
    phone_number_new,
    phone_number_prev,
    goodwill,
  } = req.body;
  const {permissionInfo, id: user_id} = req.auth;
  const {id} = req.params;
  const validator = new Validator();
  const data = {
    full_name,
    phone_number_main,
    phone_number_new,
    phone_number_prev,
    goodwill,
    id: id,
  };
  const resultValid = validator.validate(
    data,
    customerSchema.updateCustomerBuyRentSchema,
  );
  if (!resultValid.valid) {
    const errors = Common.buildError(resultValid);
    return RestAPI.notFound(res, errors);
  }

  try {
    const response = await customerService.updateCustomerBuyRent(
      data,
      permissionInfo,
      user_id,
    );
    if (!response) {
      return RestAPI.serverError(res, 'Internal server error');
    }

    return RestAPI.success(res, response);
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}
async function generateNewCustomer(req, res) {
  const {params, body} = req;
  const {number} = params;

  const {id} = req.auth;

  try {
    const worker = new Worker('./worker/customer.js', {
      workerData: {
        numberCustomer: number,
        dataForGenerate: {
          ...body,
          user_id: id,
        },
      },
    });
    worker.on('message', (data) => {
      // return RestAPI.success(res, "ok");
    });
    worker.on('error', (msg) => {
      // res.status(404).send(`An error occurred: ${msg}`);
    });

    return RestAPI.success(res, 'response');
  } catch (error) {
    return RestAPI.serverError(res, 'Internal server error', error);
  }
}

module.exports = router;
