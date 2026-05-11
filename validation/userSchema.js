const checkUserExistSchema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      required: true,
      format: 'email',
      description: 'Field is email address',
      maxLength: 250,
    },
  },
};
const checkTokenResetPasswordSchema = {
  type: 'object',
  properties: {
    activation_key: {
      type: 'string',
      required: true,
      description: 'Field is type string',
      maxLength: 500,
    },
  },
};

const resetPasswordSchema = {
  type: 'object',
  properties: {
    activation_key: {
      type: 'string',
      required: true,
      description: 'Field is type string',
      maxLength: 500,
    },
    password: {
      type: 'string',
      description: 'Field is type string',
      maxLength: 250,
    },
  },
};

const changePasswordSchema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      format: 'email',
      required: true,
      description: 'Field is type string',
      maxLength: 250,
    },
    password: {
      type: 'string',
      description: 'Field is type string',
      maxLength: 250,
    },
    newPassword: {
      type: 'string',
      description: 'Field is type string',
      maxLength: 250,
    },
  },
};

const changePasswordFirstSchema = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      format: 'email',
      required: true,
      description: 'Field is type string',
      maxLength: 250,
    },
    newPassword: {
      type: 'string',
      description: 'Field is type string',
      maxLength: 250,
    },
  },
};
const checkPhoneExist = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      format: 'email',
      required: true,
      description: 'Field is type string',
      maxLength: 250,
    },
    raw_phone_number: {
      type: 'string',
      required: true,
      description: 'Field is type string',
      maxLength: 10,
    },
  },
};

const updatePersonalInfo = {
  type: 'object',
  properties: {
    username: {
      type: 'string',
      required: true,
      format: 'email',
      description: 'Field is type string',
      maxLength: 250,
    },
    raw_phone_number: {
      type: 'string',
      required: true,
      description: 'Field is type string',
      maxLength: 10,
    },
    full_name: {
      type: 'string',
      required: true,
      description: 'Field is type string',
      maxLength: 250,
    },
  },
};
module.exports = {
  checkUserExistSchema,
  checkTokenResetPasswordSchema,
  changePasswordFirstSchema,
  resetPasswordSchema,
  changePasswordSchema,
  checkPhoneExist,
  updatePersonalInfo,
};
