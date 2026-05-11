// magicBytes middleware unit test.
// Test looksLikeUtf8Text + full middleware với mock fs + file-type.

const path = require('path');
const fs = require('fs');
const os = require('os');

const {looksLikeUtf8Text} = require('../../middlewares/magicBytes');
const magicBytesValidator = require('../../middlewares/magicBytes');

describe('looksLikeUtf8Text', () => {
  test('plain ASCII text passes', () => {
    expect(looksLikeUtf8Text(Buffer.from('name,age\nAnna,30\nBob,25'))).toBe(
      true,
    );
  });

  test('UTF-8 Vietnamese passes', () => {
    expect(looksLikeUtf8Text(Buffer.from('Tên,Tuổi\nAnh,30'))).toBe(true);
  });

  test('binary with NUL byte rejected', () => {
    expect(looksLikeUtf8Text(Buffer.from([0x48, 0x00, 0x49]))).toBe(false);
  });

  test('binary PE header rejected (NUL inside)', () => {
    expect(
      looksLikeUtf8Text(Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00])),
    ).toBe(false);
  });
});

describe('magicBytesValidator middleware', () => {
  const Constants = require('../../common/constants');
  let tmpDir;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'magic-test-'));
  });
  afterAll(() => {
    try {
      fs.rmSync(tmpDir, {recursive: true, force: true});
    } catch {
      /* ignore */
    }
  });

  function makeFile(name, bytes) {
    const p = path.join(tmpDir, name);
    fs.writeFileSync(p, Buffer.from(bytes));
    return p;
  }

  function fakeRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  test('accepts real PDF (matches PDF magic)', async () => {
    // %PDF-1.4 prefix
    const p = makeFile('a.pdf', [
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a,
    ]);
    const next = jest.fn();
    const req = {file: {path: p, mimetype: 'application/pdf', fileNameUpload: 'a.pdf'}};
    const res = fakeRes();
    await magicBytesValidator()(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.file.mimetype).toBe('application/pdf');
  });

  test('rejects EXE claiming to be PDF', async () => {
    // MZ header (DOS/Windows PE)
    const p = makeFile('evil.pdf', [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x04, 0x00]);
    const next = jest.fn();
    const req = {file: {path: p, mimetype: 'application/pdf', fileNameUpload: 'evil.pdf'}};
    const res = fakeRes();
    await magicBytesValidator()(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('accepts CSV (no magic bytes, UTF-8 text)', async () => {
    const p = makeFile('a.csv', Buffer.from('name,age\nAnna,30\n', 'utf8'));
    const next = jest.fn();
    const req = {file: {path: p, mimetype: 'text/csv', fileNameUpload: 'a.csv'}};
    const res = fakeRes();
    await magicBytesValidator()(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('rejects unknown type (no magic, non-text)', async () => {
    const p = makeFile('weird.bin', [0xab, 0xcd, 0x00, 0xef]);
    const next = jest.fn();
    const req = {file: {path: p, mimetype: 'application/octet-stream', fileNameUpload: 'weird.bin'}};
    const res = fakeRes();
    await magicBytesValidator()(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('cleanup file on reject', async () => {
    const p = makeFile('cleanup-me.pdf', [0x4d, 0x5a, 0x90, 0x00]);
    const next = jest.fn();
    const req = {file: {path: p, mimetype: 'application/pdf', fileNameUpload: 'cleanup-me.pdf'}};
    const res = fakeRes();
    await magicBytesValidator()(req, res, next);
    // Đợi cleanup async
    await new Promise((r) => setTimeout(r, 20));
    expect(fs.existsSync(p)).toBe(false);
  });

  test('next() when no req.file', async () => {
    const next = jest.fn();
    const req = {};
    const res = fakeRes();
    await magicBytesValidator()(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
