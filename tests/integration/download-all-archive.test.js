'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('node:http');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'psitransfer-archive-'));
process.env.PSITRANSFER_UPLOAD_DIR = tmpDir;

const { test, after } = require('node:test');
const assert = require('node:assert');

const tusMeta = require('../../lib/tusboy/tus-metadata');
const app = require('../../lib/endpoints');

const TUS = { 'Tus-Resumable': '1.0.0' };

function request(port, method, pathname, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, method, path: pathname, headers },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          })
        );
      }
    );
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

async function uploadOne(port, sid, name, content) {
  const create = await request(port, 'POST', '/files/', {
    ...TUS,
    'Upload-Length': String(Buffer.byteLength(content)),
    'Upload-Metadata': tusMeta.encode({ name, sid, retention: '3600' }),
    'Content-Type': 'application/offset+octet-stream',
  });
  assert.strictEqual(create.status, 201);
  const fid = create.headers.location.split('/files/')[1];
  const patch = await request(
    port,
    'PATCH',
    `/files/${encodeURIComponent(fid)}`,
    { ...TUS, 'Upload-Offset': '0', 'Content-Type': 'application/offset+octet-stream' },
    content
  );
  assert.strictEqual(patch.status, 204);
  return fid;
}

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Regression for the download-all route guard. A bucket id containing a hyphen
// (e.g. a project-slug sid) previously failed the /^[a-z0-9+]+\.(tar\.gz|zip)$/
// match, fell through to the single-file handler, and returned the "Invalid
// link" 404 page. Hyphens are accepted in a sid on upload, so the archive route
// must accept them too.
test('download-all archive route accepts a hyphenated bucket id', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const sid = 'my-hyphen-bucket';
    await uploadOne(port, sid, 'a.txt', 'alpha');
    await uploadOne(port, sid, 'b.txt', 'beta');

    const meta = await request(port, 'GET', `/${sid}.json`);
    assert.strictEqual(meta.status, 200);
    const { archiveToken } = JSON.parse(meta.body.toString());
    assert.ok(archiveToken, 'metadata endpoint should expose an archiveToken');

    for (const format of ['zip', 'tar.gz']) {
      const res = await request(port, 'GET', `/files/${sid}++${archiveToken}.${format}`);
      assert.strictEqual(res.status, 200, `${format} download should be 200, got ${res.status}`);
      assert.match(
        String(res.headers['content-disposition'] || ''),
        new RegExp(`${sid}\\.${format.replace('.', '\\.')}`)
      );
      assert.doesNotMatch(res.body.toString('latin1'), /Invalid link/);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
