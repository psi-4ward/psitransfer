'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('node:http');

const MAX_FILE_SIZE = 1000;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'psitransfer-limits-'));
process.env.PSITRANSFER_UPLOAD_DIR = tmpDir;
process.env.PSITRANSFER_MAX_FILE_SIZE = String(MAX_FILE_SIZE);

const { test, before, after } = require('node:test');
const assert = require('node:assert');

const tusMeta = require('../../lib/tusboy/tus-metadata');
const app = require('../../lib/endpoints');

const TUS = { 'Tus-Resumable': '1.0.0' };
const PATCH_HEADERS = { ...TUS, 'Content-Type': 'application/offset+octet-stream' };

let server;
let port;

// body: Buffer (sent with Content-Length) or array of Buffers (sent chunked)
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
    if (Array.isArray(body)) body.forEach(c => req.write(c));
    else if (body != null) req.write(body);
    req.end();
  });
}

async function create(sid, uploadLength) {
  const res = await request('POST', '/files/', {
    ...TUS,
    'Upload-Length': String(uploadLength),
    'Upload-Metadata': tusMeta.encode({ name: 'file.bin', sid, retention: '3600' }),
  });
  assert.strictEqual(res.status, 201);
  return decodeURIComponent(res.headers.location.split('/').pop());
}

const patch = (fid, offset, body) => request('PATCH', `/files/${ encodeURIComponent(fid) }`,
  { ...PATCH_HEADERS, 'Upload-Offset': String(offset) }, body);

const sizeOnDisk = fid => fs.statSync(path.join(tmpDir, ...fid.split('++'))).size;

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

test('upload in multiple chunks completes', async () => {
  const fid = await create('limitchunks', 200);
  const first = await patch(fid, 0, Buffer.alloc(120, 'a'));
  assert.strictEqual(first.status, 204);
  assert.strictEqual(first.headers['upload-offset'], '120');
  const second = await patch(fid, 120, Buffer.alloc(80, 'b'));
  assert.strictEqual(second.status, 204);
  assert.strictEqual(second.headers['upload-offset'], '200');
  assert.strictEqual((await request('GET', `/files/${ fid }`)).body.length, 200);
  // completed uploads can not be appended
  assert.strictEqual((await patch(fid, 200, Buffer.alloc(10))).status, 400);
});

test('body larger than declared Content-Length is rejected before writing', async () => {
  const fid = await create('limitcontentlength', 100);
  const res = await patch(fid, 0, Buffer.alloc(5000));
  assert.strictEqual(res.status, 413);
  assert.strictEqual(sizeOnDisk(fid), 0);
});

test('chunked body exceeding Upload-Length is cut off', async () => {
  const fid = await create('limitchunked', 100);
  const chunks = Array.from({ length: 50 }, () => Buffer.alloc(1000));
  // the server either answers 413 or resets the connection
  await patch(fid, 0, chunks).then(
    res => assert.strictEqual(res.status, 413),
    e => assert.match(e.code, /ECONNRESET|EPIPE/)
  );
  assert.ok(sizeOnDisk(fid) <= 100, `${ sizeOnDisk(fid) } bytes on disk`);
  // and stays bounded on further PATCHes
  const head = await request('HEAD', `/files/${ encodeURIComponent(fid) }`, TUS);
  await patch(fid, +head.headers['upload-offset'], chunks).catch(() => {});
  assert.ok(sizeOnDisk(fid) <= 100, `${ sizeOnDisk(fid) } bytes on disk`);
  assert.ok(sizeOnDisk(fid) <= MAX_FILE_SIZE);
});

test('wrong Upload-Offset is rejected', async () => {
  const fid = await create('limitoffset', 100);
  assert.strictEqual((await patch(fid, 50, Buffer.alloc(10))).status, 409);
  assert.strictEqual(sizeOnDisk(fid), 0);
});

test('concurrent PATCH on the same upload is rejected', async () => {
  const fid = await create('limitconcurrent', 100);
  // keep a first PATCH open
  const req = http.request({
    hostname: '127.0.0.1', port, method: 'PATCH', agent: false,
    path: `/files/${ encodeURIComponent(fid) }`,
    headers: { ...PATCH_HEADERS, 'Upload-Offset': '0' },
  });
  req.on('error', () => {});
  req.write(Buffer.alloc(10));
  await new Promise(resolve => setTimeout(resolve, 100));

  assert.strictEqual((await patch(fid, 0, Buffer.alloc(100))).status, 409);
  req.destroy();
});

test('aborted PATCH keeps received bytes and can be resumed', async () => {
  const fid = await create('limitresume', 100);
  const req = http.request({
    hostname: '127.0.0.1', port, method: 'PATCH', agent: false,
    path: `/files/${ encodeURIComponent(fid) }`,
    headers: { ...PATCH_HEADERS, 'Upload-Offset': '0' },
  });
  req.on('error', () => {});
  req.write(Buffer.alloc(40, 'a'));
  await new Promise(resolve => setTimeout(resolve, 100));
  req.destroy();
  await new Promise(resolve => setTimeout(resolve, 100));

  const head = await request('HEAD', `/files/${ encodeURIComponent(fid) }`, TUS);
  assert.strictEqual(head.headers['upload-offset'], '40');
  const res = await patch(fid, 40, Buffer.alloc(60, 'b'));
  assert.strictEqual(res.status, 204);
  assert.strictEqual(res.headers['upload-offset'], '100');
});
