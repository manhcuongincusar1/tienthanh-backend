/**
 * Mock cho captchapng@0.0.1 — package gốc ship package.json kèm UTF-8 BOM
 * → jest-resolve không đọc được. Bypass bằng manual mock.
 * common/security.js dùng captchapng để gen captcha — không nằm trong scope test.
 */
function CaptchaPng() {
  return {
    color: () => {},
    getBase64: () => '',
  };
}

module.exports = CaptchaPng;
