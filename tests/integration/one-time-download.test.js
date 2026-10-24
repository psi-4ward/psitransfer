'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('node:http');
const { createHash } = require('node:crypto');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'psitransfer-onetime-'));
process.env.PSITRANSFER_UPLOAD_DIR = tmpDir;

const { test, before, after } = require('node:test');
const assert = require('node:assert');

const tusMeta = require('../../lib/tusboy/tus-metadata');
const app = require('../../lib/endpoints');

const TUS = { 'Tus-Resumable': '1.0.0' };
const PARALLEL = 10;

let server;
let port;

function request(method, pathname, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, method, path: pathname, headers, agent: false },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) });
        });
      }
    );
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

// Upload a file via Tus and return its fid (sid++key)
async function upload(sid, content, retention = 'one-time') {
  const meta = { name: 'file.bin', sid, retention };
  const created = await request('POST', '/files/', {
    ...TUS,
    'Upload-Length': String(content.length),
    'Upload-Metadata': tusMeta.encode(meta),
  });
  assert.strictEqual(created.status, 201);
  const fid = decodeURIComponent(created.headers.location.split('/').pop());
  const patched = await request('PATCH', `/files/${ encodeURIComponent(fid) }`, {
    ...TUS,
    'Upload-Offset': '0',
    'Content-Type': 'application/offset+octet-stream',
  }, content);
  assert.strictEqual(patched.status, 204);
  return fid;
}

function archiveUrl(sid, fids, format = 'zip') {
  const keyList = fids.map(fid => fid.split('++')[1]).join();
  const hash = createHash('sha256').update(keyList).digest('hex').slice(0, 32);
  return `/files/${ sid }++${ hash }.${ format }`;
}

// Wait until the server-side finish/close handlers have run
const tick = () => new Promise(resolve => setTimeout(resolve, 100));

before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('parallel downloads of a one-time file deliver it exactly once', async () => {
  const content = Buffer.alloc(1024 * 1024, 'a');
  const fid = await upload('onetimeparallel', content);

  const results = await Promise.all(
    Array.from({ length: PARALLEL }, () => request('GET', `/files/${ fid }`))
  );
  const ok = results.filter(r => r.status === 200);
  assert.strictEqual(ok.length, 1);
  assert.ok(ok[0].body.equals(content));
  assert.strictEqual(results.filter(r => r.status === 404).length, PARALLEL - 1);

  await tick();
  assert.strictEqual((await request('GET', `/files/${ fid }`)).status, 404);
  // server is still alive
  assert.strictEqual((await request('GET', '/robots.txt')).status, 200);
});

test('parallel archive downloads of a one-time bucket deliver it exactly once', async () => {
  const sid = 'onetimearchive';
  const fids = [
    await upload(sid, Buffer.alloc(512 * 1024, 'a')),
    await upload(sid, Buffer.alloc(512 * 1024, 'b')),
  ];
  const url = archiveUrl(sid, fids);

  const results = await Promise.all(
    Array.from({ length: PARALLEL }, () => request('GET', url))
  );
  assert.strictEqual(results.filter(r => r.status === 200).length, 1);
  assert.strictEqual(results.filter(r => r.status === 404).length, PARALLEL - 1);

  await tick();
  for (const fid of fids) {
    assert.strictEqual((await request('GET', `/files/${ fid }`)).status, 404);
  }
  assert.strictEqual((await request('GET', '/robots.txt')).status, 200);
});

test('archive download is refused while a one-time file is being downloaded', async () => {
  const sid = 'onetimemixed';
  const fids = [
    await upload(sid, Buffer.alloc(32 * 1024 * 1024, 'a')),
    await upload(sid, Buffer.from('permanent'), '3600'),
  ];

  // start a single file download and keep it open
  const pending = new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: `/files/${ fids[0] }`, agent: false }, (res) => {
      res.pause();
      resolve({ req, res });
    });
    req.on('error', reject);
  });
  const { req, res } = await pending;
  assert.strictEqual(res.statusCode, 200);

  assert.strictEqual((await request('GET', archiveUrl(sid, fids))).status, 404);
  // non one-time files are not affected
  assert.strictEqual((await request('GET', `/files/${ fids[1] }`)).status, 200);

  req.destroy();
  await tick();
});

test('aborted download releases the one-time file', async () => {
  const content = Buffer.alloc(32 * 1024 * 1024, 'a');
  const fid = await upload('onetimeabort', content);

  await new Promise((resolve, reject) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: `/files/${ fid }`, agent: false }, (res) => {
      assert.strictEqual(res.statusCode, 200);
      res.once('data', () => {
        req.destroy();
        resolve();
      });
    });
    req.on('error', (e) => e.code === 'ECONNRESET' ? resolve() : reject(e));
  });
  await tick();

  const res = await request('GET', `/files/${ fid }`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.equals(content));
});

test('HEAD does not consume a one-time file', async () => {
  const content = Buffer.from('head request');
  const fid = await upload('onetimehead', content);

  const head = await request('HEAD', `/files/${ fid }`);
  assert.strictEqual(head.status, 200);
  await tick();

  const res = await request('GET', `/files/${ fid }`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.equals(content));

  await tick();
  assert.strictEqual((await request('HEAD', `/files/${ fid }`)).status, 404);
});

test('completed range request consumes a one-time file', async () => {
  const fid = await upload('onetimerange', Buffer.from('0123456789abcdef'));

  const res = await request('GET', `/files/${ fid }`, { Range: 'bytes=0-9' });
  assert.strictEqual(res.status, 206);
  assert.strictEqual(res.body.toString(), '0123456789');

  await tick();
  assert.strictEqual((await request('GET', `/files/${ fid }`)).status, 404);
});
