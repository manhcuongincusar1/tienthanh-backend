const mailQueue = require('./mail_queue');
const authSchema = require('./authSchema');
const branchesSchema = require('./branchesSchema');
const userSchema = require('./userSchema');
const accountSchema = require('./accountSchema');
const realEstateStatusSchema = require('./realEstateStatusSchema');
const realEstateCategorySchema = require('./realEstateCategorySchema');
const realEstateSchema = require('./realEstateSchema');
const saleSchema = require('./saleSchema');
const customerSchema = require('./customerSchema');
const brokerSchema = require('./brokerSchema');
const permissionSchema = require('./permissionSchema');
module.exports = {
  mailQueueSchema: mailQueue,
  authSchema,
  branchesSchema,
  userSchema,
  accountSchema,
  saleSchema,
  realEstateStatusSchema,
  realEstateCategorySchema,
  customerSchema,
  realEstateSchema,
  brokerSchema,
  permissionSchema,
};
