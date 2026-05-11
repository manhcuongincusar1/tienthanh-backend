// mediaRepo integration tests — verify legacy + V2 insert + lookup.

process.env.NODE_ENV = 'test';
const knex = require('../../db/connectKnex');
const mediaRepo = require('../../services/repositories/mediaRepo');

describe('mediaRepo', () => {
  beforeAll(async () => {
    await knex.raw(`
      CREATE TABLE IF NOT EXISTS media (
        id              BIGSERIAL PRIMARY KEY,
        path            TEXT,
        extension       TEXT,
        title           TEXT,
        cdn_path        TEXT,
        status          SMALLINT DEFAULT 1,
        s3_key          TEXT,
        mime            TEXT,
        original_size   BIGINT,
        width           INT,
        height          INT,
        visibility      TEXT NOT NULL DEFAULT 'public'
                          CHECK (visibility IN ('public','private')),
        creator_id      BIGINT,
        metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await knex.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_media_s3_key
         ON media (s3_key) WHERE s3_key IS NOT NULL`,
    );
  });

  beforeEach(async () => {
    await knex('media').delete();
  });

  afterAll(async () => {
    await knex.raw('DROP TABLE IF EXISTS media CASCADE');
  });

  test('insertLegacy returns id + path + cdn_path', async () => {
    const row = await mediaRepo.insertLegacy({
      path: 'a/b.png',
      extension: 'png',
      title: 'b.png',
      cdn_path: 'https://cdn.example.com/a/b.png',
    });
    expect(row).toBeTruthy();
    expect(row.id).toBeGreaterThan(0);
    expect(row.cdn_path).toContain('cdn.example.com');
  });

  test('insertManyLegacy bulk inserts', async () => {
    const rows = await mediaRepo.insertManyLegacy([
      {path: 'a.png', extension: 'png', title: 'a'},
      {path: 'b.png', extension: 'png', title: 'b'},
      {path: 'c.png', extension: 'png', title: 'c'},
    ]);
    expect(rows).toHaveLength(3);
  });

  test('insertManyLegacy empty array returns []', async () => {
    const rows = await mediaRepo.insertManyLegacy([]);
    expect(rows).toEqual([]);
  });

  test('insertV2 with new schema fields', async () => {
    const row = await mediaRepo.insertV2({
      s3_key: '2026/05/11/abc123',
      mime: 'image/webp',
      original_size: 1024000,
      width: 1280,
      height: 720,
      visibility: 'public',
      creator_id: 42,
      metadata: {camera: 'iphone'},
    });
    expect(row).toMatchObject({
      s3_key: '2026/05/11/abc123',
      visibility: 'public',
      mime: 'image/webp',
    });
    expect(Number(row.creator_id)).toBe(42);
  });

  test('insertV2 visibility CHECK constraint rejects invalid', async () => {
    await expect(
      mediaRepo.insertV2({
        s3_key: '2026/05/11/bad',
        mime: 'image/webp',
        visibility: 'top-secret',
      }),
    ).rejects.toThrow(/violates check constraint|media_visibility_check/i);
  });

  test('s3_key unique partial index allows multiple NULL but not duplicate value', async () => {
    await mediaRepo.insertLegacy({path: 'x', extension: 'png', title: 'x'});
    await mediaRepo.insertLegacy({path: 'y', extension: 'png', title: 'y'});
    await mediaRepo.insertV2({s3_key: 'same/key', mime: 'image/png'});

    await expect(
      mediaRepo.insertV2({s3_key: 'same/key', mime: 'image/png'}),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  test('findById round-trip', async () => {
    const inserted = await mediaRepo.insertV2({
      s3_key: '2026/05/11/find-test',
      mime: 'image/png',
    });
    const found = await mediaRepo.findById(inserted.id);
    expect(found.s3_key).toBe('2026/05/11/find-test');
  });

  test('findByS3Key', async () => {
    await mediaRepo.insertV2({s3_key: 'unique/key/123', mime: 'image/jpeg'});
    const found = await mediaRepo.findByS3Key('unique/key/123');
    expect(found).toBeTruthy();
    expect(found.mime).toBe('image/jpeg');
  });
});
