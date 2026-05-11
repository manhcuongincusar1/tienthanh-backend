const {once} = require('../../cron/once');

describe('cron once() skip-if-running wrapper', () => {
  let logSpy;
  let warnSpy;
  let errSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });

  test('runs the wrapped function and returns', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    const guarded = once(fn, 'job');
    await guarded();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('skips overlapping invocation and logs skip', async () => {
    let resolveInner;
    const fn = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveInner = resolve;
        }),
    );
    const guarded = once(fn, 'job');

    const first = guarded();
    const second = guarded();
    await second;

    expect(fn).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('cron_job_skip_already_running');

    resolveInner();
    await first;
  });

  test('releases lock after function throws and logs error', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    const guarded = once(fn, 'job');

    await guarded();
    expect(errSpy).toHaveBeenCalledWith(
      'cron_job_error',
      expect.any(Error),
    );

    await guarded();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('long-running warning fires after timeout', async () => {
    jest.useFakeTimers();
    let resolveInner;
    const fn = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveInner = resolve;
        }),
    );
    const guarded = once(fn, 'job', {timeoutMs: 1000});

    const p = guarded();
    jest.advanceTimersByTime(1500);
    expect(warnSpy).toHaveBeenCalledWith('cron_job_running_too_long');

    resolveInner();
    jest.useRealTimers();
    await p;
  });

  test('does not warn if function finishes before timeout', async () => {
    jest.useFakeTimers();
    const fn = jest.fn().mockResolvedValue(undefined);
    const guarded = once(fn, 'job', {timeoutMs: 1000});

    await guarded();
    jest.advanceTimersByTime(2000);
    expect(warnSpy).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
