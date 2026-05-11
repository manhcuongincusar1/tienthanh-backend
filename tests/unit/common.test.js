const Common = require('../../common/common');

describe('Common.skipVN', () => {
  it('chuyển có dấu thành không dấu (lowercase)', () => {
    expect(Common.skipVN('Tiến Thành')).toBe('tien thanh');
  });

  it('giữ nguyên ký tự không có dấu', () => {
    expect(Common.skipVN('Hello World')).toBe('hello world');
  });

  it('xử lý chuỗi rỗng', () => {
    expect(Common.skipVN('')).toBe('');
  });
});
