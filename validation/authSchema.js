const LoginSchema = {
  id: '/authSchema',
  type: 'object',
  properties: {
    username: {
      type: 'string',
      required: true,
      format: 'email',
      description: 'Field is email address',
      maxLength: 250,
    },
    password: {
      type: 'string',
      required: true,
      maxLength: 250,
    },
  },
};
module.exports = {LoginSchema};
