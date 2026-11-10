'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const Store = require('../../lib/store');

const FID = 'bucket++00000000-0000-4000-8000-00000000000a';

test('concurrent metadata writes never expose or leave broken json', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'psi-store-json-'));
  try {
    const store = new Store(dir);
    await store.create(FID, { uploadLength: 1, metadata: {} });

    const short = { metadata: { a: 1 } };
    const long = { metadata: { a: 'x'.repeat(64 * 1024) } };
    await Promise.all(Array.from({ length: 100 }, (_, i) => Promise.all([
      store.update(FID, i % 2 ? short : long),
      store.info(FID),
    ])));

    const info = await store.info(FID);
    assert.ok([1, long.metadata.a].includes(info.metadata.a));
    // no temp files left
    assert.deepStrictEqual(fs.readdirSync(path.join(dir, 'bucket')).sort(),
      ['00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a.json']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
