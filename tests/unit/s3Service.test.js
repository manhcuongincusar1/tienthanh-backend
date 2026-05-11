// s3Service unit test — mock aws-sdk.

jest.mock('aws-sdk', () => {
  return {
    S3: jest.fn().mockImplementation(() => ({
      getSignedUrlPromise: jest.fn(async (op, params) => {
        return `https://s3.example.com/${params.Bucket}/${params.Key}?op=${op}&exp=${params.Expires}`;
      }),
    })),
  };
});

// Mock constants S3 vì test env không có S3_KEY env.
jest.mock('../../common/constants', () => ({
  S3: {
    S3_KEY: 'test-key',
    S3_SECRET: 'test-secret',
    S3_REGION: 'ap-southeast-1',
    S3_BUCKET: 'tita-test',
  },
}));

const s3Service = require('../../services/s3Service');

describe('s3Service', () => {
  test('buildS3Key public prefix', () => {
    const key = s3Service.buildS3Key({visibility: 'public', extension: 'png'});
    expect(key).toMatch(/^uploads\/public\/\d{4}\/\d{2}\/\d{2}\/[a-f0-9]{16}\.png$/);
  });

  test('buildS3Key private prefix', () => {
    const key = s3Service.buildS3Key({visibility: 'private', extension: 'pdf'});
    expect(key).toMatch(/^uploads\/private\/\d{4}\/\d{2}\/\d{2}\/[a-f0-9]{16}\.pdf$/);
  });

  test('buildS3Key default visibility = public', () => {
    const key = s3Service.buildS3Key({extension: 'webp'});
    expect(key.startsWith('uploads/public/')).toBe(true);
  });

  test('buildS3Key sanitizes extension (alnum lowercase, drop special chars)', () => {
    const key = s3Service.buildS3Key({extension: 'PNG; DROP TABLE--'});
    expect(key).toMatch(/\.[a-z0-9]+$/);
    expect(key).not.toContain(';');
    expect(key).not.toContain(' ');
    expect(key).not.toContain('-');
  });

  test('buildS3Key fallback extension bin', () => {
    const key = s3Service.buildS3Key({});
    expect(key.endsWith('.bin')).toBe(true);
  });

  test('presignPut returns URL with expected params', async () => {
    const url = await s3Service.presignPut({
      s3_key: 'uploads/public/2026/05/11/abc.png',
      mime: 'image/png',
      expiresSec: 300,
    });
    expect(url).toContain('tita-test');
    expect(url).toContain('uploads/public/2026/05/11/abc.png');
    expect(url).toContain('op=putObject');
    expect(url).toContain('exp=300');
  });

  test('presignGet uses getObject op', async () => {
    const url = await s3Service.presignGet({
      s3_key: 'uploads/private/x.pdf',
      expiresSec: 120,
    });
    expect(url).toContain('op=getObject');
    expect(url).toContain('exp=120');
  });

  test('buildS3Key generates unique keys (no collision in 100 calls)', () => {
    const keys = new Set();
    for (let i = 0; i < 100; i++) {
      keys.add(s3Service.buildS3Key({extension: 'png'}));
    }
    expect(keys.size).toBe(100);
  });
});
