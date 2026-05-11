// Skip-if-running wrapper cho cron tick — single Node process (DECISIONS A5).
// Tick mới đến mà tick trước chưa xong → skip, log debug. Long-running warning sau 10 phút.

function once(fn, name, {timeoutMs = 10 * 60 * 1000} = {}) {
  let running = false;
  return async () => {
    if (running) {
      console.log(`cron_${name}_skip_already_running`);
      return;
    }
    running = true;
    const timeoutId = setTimeout(
      () => console.warn(`cron_${name}_running_too_long`),
      timeoutMs,
    );
    try {
      await fn();
    } catch (e) {
      console.error(`cron_${name}_error`, e);
    } finally {
      clearTimeout(timeoutId);
      running = false;
    }
  };
}

module.exports = {once};
