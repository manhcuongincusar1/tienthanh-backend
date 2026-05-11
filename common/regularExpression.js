const REGULAR_EXPRESSION = {
  CHECK_EMAIL: new RegExp(
    /^(?!\.)((?!.*\.{2})[a-zA-Z0-9.!#$%&'*+-/=?^_`{|}~\-\d]+)@(?!\.)([a-zA-Z0-9-\.\d]+)((\.([a-zA-Z]){2,63})+)$/g,
  ),
  CHECK_MEASURE_DECIMAL_NUMBER: new RegExp(/^[0-9]{1,20}((\.[0-9]{1,3})|)$/),
  CHECK_INTEGER_NUMBER: new RegExp('^[0-9]{1,10}$'),
  CHECK_FULL_NAME: new RegExp(
    /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂẾưăạảấầẩẫậắằẳẵặẹẻẽềềểếỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳýỵỷỹ\s|_0-9]+$/g,
  ),
  CHECK_REAL_ESTATE_PRICE: new RegExp(/^[0-9]{1,5}((\.[0-9]{1,2})|)$/),
  CHECK_DECIMAL_AREA_NUMBER: new RegExp(/^[0-9]{1,6}((\.[0-9]{1,30})|)$/),
  CHECK_PHONE_NUMBER: new RegExp(
    /^(0)((3([2-9]))|(5([25689]))|(7([0|6-9]))|(8([1-9]))|(9([0-9])))([0-9]{7})$/,
  ),
  CHECK_ADDRESS: new RegExp(/^([a-zA-Z0-9\/\-]+\s)*[a-zA-Z0-9\/\-]+$/),
};

module.exports = REGULAR_EXPRESSION;
