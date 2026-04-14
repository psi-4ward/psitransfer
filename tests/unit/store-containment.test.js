'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const Store = require('../../lib/store');

const SAMPLE_UUID = '00000000-0000-4000-8000-000000000001';

test('getFilename rejects prefix false-positive (startsWith bypass)', () => {
  const jailParent = fs.mkdtempSync(path.join(os.tmpdir(), 'psi-jail-'));
  try {
    const base = path.join(jailParent, 'conf');
    fs.mkdirSync(base, { recursive: true });
    fs.writeFileSync(path.join(jailParent, 'config.production.js'), 'x');
    const store = new Store(base);
    assert.throws(() => store.getFilename('..++config.production.js'), /jail/);
  } finally {
    fs.rmSync(jailParent, { recursive: true, force: true });
  }
});

test('getFilename rejects traversal via multiple ++ segments', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'psi-store-'));
  try {
    const store = new Store(base);
    assert.throws(() => store.getFilename('legit++..++..++outside'), /jail/);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('getFilename rejects NUL in fid', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'psi-store-'));
  try {
    const store = new Store(base);
    assert.throws(
      () => store.getFilename(`legit++${SAMPLE_UUID}\0/../../../etc/passwd`),
      /jail/
    );
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('getFilename rejects resolved path equal to jail root (rel empty)', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'psi-store-'));
  try {
    const store = new Store(base);
    assert.throws(() => store.getFilename('bucket++..'), /jail/);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('getFilename accepts valid sid++uuid path under jail', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'psi-store-'));
  try {
    const store = new Store(base);
    const fid = `mybucket++${SAMPLE_UUID}`;
    const got = store.getFilename(fid);
    const expected = path.join(base, 'mybucket', SAMPLE_UUID);
    assert.strictEqual(got, expected);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
