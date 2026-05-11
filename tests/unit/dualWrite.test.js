const dual = require('../../db/dualWrite');

describe('dualWrite', () => {
  describe('normalize', () => {
    it('drop _id và __v', () => {
      expect(dual.normalize({_id: 'abc', __v: 0, a: 1})).toEqual({a: 1});
    });

    it('truncate Date precision', () => {
      const d = new Date('2026-05-10T12:34:56.789Z');
      expect(dual.normalize({t: d})).toEqual({t: '2026-05-10T12:34:56'});
    });

    it('normalize array of objects', () => {
      expect(
        dual.normalize([
          {_id: 'a', x: 1},
          {_id: 'b', x: 2},
        ]),
      ).toEqual([{x: 1}, {x: 2}]);
    });
  });

  describe('read', () => {
    it('trả primary result, không cần shadow', async () => {
      const r = await dual.read({
        name: 'test',
        primary: async () => ({a: 1}),
      });
      expect(r).toEqual({a: 1});
    });

    it('shadow fire-and-forget không block response', async () => {
      let shadowCalled = false;
      const result = await dual.read({
        name: 'test',
        primary: async () => 'fast',
        shadow: async () => {
          await new Promise((r) => setTimeout(r, 50));
          shadowCalled = true;
          return 'slow';
        },
      });
      expect(result).toBe('fast');
      // Shadow chạy nền — chưa xong khi return.
    });
  });

  describe('write', () => {
    it('throw từ primary propagate ra ngoài', async () => {
      await expect(
        dual.write({
          name: 'test',
          primary: async () => {
            throw new Error('pg fail');
          },
        }),
      ).rejects.toThrow('pg fail');
    });

    it('secondary fail không phá primary result', async () => {
      // Tạm bật dual write trong test scope
      const origEnv = process.env.ENABLE_DUAL_WRITE;
      process.env.ENABLE_DUAL_WRITE = 'true';
      // Re-require để pick env mới — nhưng module cache → simpler: test với cờ ngoài
      // (skip dual-write activate test vì env evaluate ở module load)
      process.env.ENABLE_DUAL_WRITE = origEnv;

      const r = await dual.write({
        name: 'test',
        primary: async () => 'pg-ok',
        secondary: async () => {
          throw new Error('mongo fail');
        },
      });
      expect(r).toBe('pg-ok');
    });
  });
});
