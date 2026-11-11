'use strict';

// Requests without a password are answered at once; wrong passwords keep the
// brute-force delay; every protected file still needs the right password.

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('node:http');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'psitransfer-password-'));
process.env.PSITRANSFER_UPLOAD_DIR = tmpDir;

const { test, before, after } = require('node:test');
const assert = require('node:assert');

const config = require('../../config');
const tusMeta = require('../../lib/tusboy/tus-metadata');
const app = require('../../lib/endpoints');

const TUS = { 'Tus-Resumable': '1.0.0' };
let server;
let port;

function request(method, pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, method, path: pathname, headers, agent: false },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function create(sid, name, password) {
  const meta = { name, sid, retention: '3600' };
  if (password) meta.password = password;
  const res = await request('POST', '/files/', {
    ...TUS,
    'Upload-Length': '1',
    'Upload-Metadata': tusMeta.encode(meta),
  });
  assert.strictEqual(res.status, 201);
}

async function timed(fn) {
  const t0 = performance.now();
  const res = await fn();
  return { res, ms: performance.now() - t0 };
}

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

test('a protected bucket asks for its password at once, wrong passwords stay slow', async () => {
  for (let i = 0; i < 4; i++) await create('protsid', `f${ i }.txt`, 'secret');

  const none = await timed(() => request('GET', '/protsid.json'));
  assert.strictEqual(none.res.status, 401);

  const wrong = await timed(() => request('GET', '/protsid.json', { 'x-download-pass': 'nope' }));
  assert.strictEqual(wrong.res.status, 401);
  // the delay is a fixed timer; compare the two instead of absolute bounds
  assert.ok(wrong.ms >= 490, `wrong password answered after ${ wrong.ms }ms`);
  assert.ok(none.ms < wrong.ms / 2, `no password ${ none.ms }ms vs wrong password ${ wrong.ms }ms`);

  const ok = await request('GET', '/protsid.json', { 'x-download-pass': 'secret' });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(JSON.parse(ok.body).items.length, 4);
});

test('files with different passwords each still need the right one', async () => {
  await create('mixsid', 'a.txt', 'one');
  await create('mixsid', 'b.txt', 'two');
  assert.strictEqual((await request('GET', '/mixsid.json', { 'x-download-pass': 'one' })).status, 401);
  assert.strictEqual((await request('GET', '/mixsid.json', { 'x-download-pass': 'two' })).status, 401);
});

test('an unprotected bucket needs no password', async () => {
  await create('opensid', 'a.txt');
  assert.strictEqual((await request('GET', '/opensid.json')).status, 200);
});

test('config.json without an upload password answers at once', async (t) => {
  const prev = config.uploadPass;
  config.uploadPass = 'up';
  t.after(() => { config.uploadPass = prev; });

  const none = await timed(() => request('GET', '/config.json'));
  assert.strictEqual(none.res.status, 401);
  const wrong = await timed(() => request('GET', '/config.json', { 'x-passwd': 'nope' }));
  assert.strictEqual(wrong.res.status, 403);
  assert.ok(wrong.ms >= 190, `wrong password answered after ${ wrong.ms }ms`);
  assert.ok(none.ms < wrong.ms / 2, `no password ${ none.ms }ms vs wrong password ${ wrong.ms }ms`);
  assert.strictEqual((await request('GET', '/config.json', { 'x-passwd': 'up' })).status, 200);
});

test('admin data without a password answers at once', async (t) => {
  const prev = config.adminPass;
  config.adminPass = 'adm';
  t.after(() => { config.adminPass = prev; });

  const none = await timed(() => request('GET', '/admin/data.json'));
  assert.strictEqual(none.res.status, 401);
  const wrong = await timed(() => request('GET', '/admin/data.json', { 'x-passwd': 'nope' }));
  assert.strictEqual(wrong.res.status, 403);
  assert.ok(none.ms < wrong.ms / 2, `no password ${ none.ms }ms vs wrong password ${ wrong.ms }ms`);
  assert.strictEqual((await request('GET', '/admin/data.json', { 'x-passwd': 'adm' })).status, 200);
});
