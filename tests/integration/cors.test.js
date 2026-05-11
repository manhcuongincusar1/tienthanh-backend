const request = require('supertest');

describe('CORS allow list (S5/02)', () => {
  let app;
  let prevNodeEnv;
  let prevAllowOrigins;

  beforeAll(() => {
    prevNodeEnv = process.env.NODE_ENV;
    prevAllowOrigins = process.env.CORS_ALLOW_ORIGINS;
  });

  afterAll(() => {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevAllowOrigins === undefined) delete process.env.CORS_ALLOW_ORIGINS;
    else process.env.CORS_ALLOW_ORIGINS = prevAllowOrigins;
  });

  function loadAppWith(env) {
    Object.keys(env).forEach((k) => {
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    });
    // VAPID + mail keys required khi NODE_ENV=production
    process.env.PUBLIC_VAPID_KEY =
      'BEEQu35i-gHV59m-9JfaLbtBDRQN1W3su3niYGII7o55iWIe50cLi60h0qkgY4OMY_bAg1Q2rk5VLmdATEdeTmc';
    process.env.PRIVATE_VAPID_KEY = 'wW8dHWYJa8W0oKBftdlxkwIPDpQQXGkg0H6RdC68cvQ';
    process.env.MAIL_TO = 'test@example.com';
    jest.resetModules();
    return require('../../app');
  }

  it('production: allow tienthanh.datviet.ai origin', async () => {
    app = loadAppWith({NODE_ENV: 'production', CORS_ALLOW_ORIGINS: undefined});
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://tienthanh.datviet.ai');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(
      'https://tienthanh.datviet.ai',
    );
  });

  it('production: reject other origin', async () => {
    app = loadAppWith({NODE_ENV: 'production', CORS_ALLOW_ORIGINS: undefined});
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example.com');
    // cors middleware sends error → status 500 with no allow-origin header
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('dev: allow localhost:8000', async () => {
    app = loadAppWith({NODE_ENV: 'development', CORS_ALLOW_ORIGINS: undefined});
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:8000');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:8000',
    );
  });

  it('no origin (curl/healthcheck): pass through', async () => {
    app = loadAppWith({NODE_ENV: 'production', CORS_ALLOW_ORIGINS: undefined});
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('CORS_ALLOW_ORIGINS env override', async () => {
    app = loadAppWith({
      NODE_ENV: 'production',
      CORS_ALLOW_ORIGINS: 'https://custom.example.com,https://other.example.com',
    });
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://custom.example.com');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(
      'https://custom.example.com',
    );
  });

  it('preflight OPTIONS pass for allowed origin', async () => {
    app = loadAppWith({NODE_ENV: 'production', CORS_ALLOW_ORIGINS: undefined});
    const res = await request(app)
      .options('/health')
      .set('Origin', 'https://tienthanh.datviet.ai')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(
      'https://tienthanh.datviet.ai',
    );
  });
});
