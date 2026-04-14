'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const utils = require('../../lib/utils');

const UUID = '00000000-0000-4000-8000-000000000001';

test('isSafeTusUploadId rejects sid with path traversal', () => {
  assert.strictEqual(utils.isSafeTusUploadId(`../../evil++${UUID}`), false);
});

test('isSafeTusUploadId rejects non-UUID key', () => {
  assert.strictEqual(utils.isSafeTusUploadId('legit++not-a-uuid'), false);
});

test('isSafeTusUploadId rejects extra ++ separators', () => {
  assert.strictEqual(utils.isSafeTusUploadId('a++b++c'), false);
});

test('isSafeTusUploadId rejects empty sid or key', () => {
  assert.strictEqual(utils.isSafeTusUploadId(`++${UUID}`), false);
  assert.strictEqual(utils.isSafeTusUploadId('sid++'), false);
});

test('isSafeTusUploadId accepts valid compound id', () => {
  assert.strictEqual(utils.isSafeTusUploadId(`abc12++${UUID}`), true);
});

test('isSafeBucketFid rejects traversal-shaped id', () => {
  assert.strictEqual(utils.isSafeBucketFid('../etc'), false);
});

test('isSafeBucketFid rejects compound id', () => {
  assert.strictEqual(utils.isSafeBucketFid(`x++${UUID}`), false);
});

test('isSafeBucketFid accepts plain bucket id', () => {
  assert.strictEqual(utils.isSafeBucketFid('abc123'), true);
});
