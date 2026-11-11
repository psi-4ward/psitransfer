'use strict';

// Archive downloads store already-compressed formats instead of deflating them again.

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('node:http');
const zlib = require('node:zlib');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'psitransfer-archive-'));
process.env.PSITRANSFER_UPLOAD_DIR = tmpDir;

const { test, before, after } = require('node:test');
const assert = require('node:assert');

const tusMeta = require('../../lib/tusboy/tus-metadata');
const app = require('../../lib/endpoints');
const { isCompressedName } = require('../../lib/utils');

const TUS = { 'Tus-Resumable': '1.0.0' };
let server;
let port;

function request(method, pathname, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, method, path: pathname, headers, agent: false },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      }
    );
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

async function upload(sid, name, content) {
  const created = await request('POST', '/files/', {
    ...TUS,
    'Upload-Length': String(content.length),
    'Upload-Metadata': tusMeta.encode({ name, sid, retention: '3600' }),
  });
  assert.strictEqual(created.status, 201);
  const patched = await request('PATCH', created.headers.location, {
    ...TUS,
    'Upload-Offset': '0',
    'Content-Type': 'application/offset+octet-stream',
    'Content-Length': String(content.length),
  }, content);
  assert.strictEqual(patched.status, 204);
}

async function download(sid, format) {
  const list = JSON.parse((await request('GET', `/${ sid }.json`)).body);
  const res = await request('GET', `/files/${ sid }++${ list.archiveToken }.${ format }`);
  assert.strictEqual(res.status, 200);
  // the download's lastDownload update runs after the response; let it finish
  await new Promise(r => setTimeout(r, 100));
  return res.body;
}

// compression method of every local file header in a zip: 0 = stored, 8 = deflated
function zipMethods(buf) {
  const out = {};
  for (let i = buf.indexOf('PK\x03\x04'); i !== -1; i = buf.indexOf('PK\x03\x04', i + 4)) {
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    out[buf.subarray(i + 30, i + 30 + nameLen).toString()] = buf.readUInt16LE(i + 8);
    i += 30 + nameLen + extraLen;
  }
  return out;
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

test('zip stores already-compressed files and deflates the rest', async () => {
  const text = Buffer.from('compress me '.repeat(1000));
  await upload('zipsid', 'photo.JPG', text);
  await upload('zipsid', 'notes.txt', text);
  assert.deepStrictEqual(zipMethods(await download('zipsid', 'zip')), { 'photo.JPG': 0, 'notes.txt': 8 });
});

test('tar.gz skips compression for a mostly-media bucket and compresses the rest', async () => {
  const text = Buffer.from('compress me '.repeat(10000));
  await upload('tgzmedia', 'clip.mp4', text);
  await upload('tgztext', 'notes.txt', text);

  const media = await download('tgzmedia', 'tar.gz');
  assert.ok(zlib.gunzipSync(media).includes(text));
  assert.ok(media.length > text.length, 'stored');

  const plain = await download('tgztext', 'tar.gz');
  assert.ok(zlib.gunzipSync(plain).includes(text));
  assert.ok(plain.length < text.length / 10, 'compressed');
});

test('isCompressedName', () => {
  for (const n of ['a.jpg', 'b.JPEG', 'c.mp4', 'd.mov', 'e.zip', 'f.tar.gz', 'g.pdf', 'h.docx', 'i.heic', 'j.woff2']) {
    assert.ok(isCompressedName(n), n);
  }
  for (const n of ['a.txt', 'b.csv', 'c.svg', 'd.jpg.txt', 'e', 'f.ts', 'g.bmp', 'h.tar', 'i.iso', undefined]) {
    assert.ok(!isCompressedName(n), String(n));
  }
});
