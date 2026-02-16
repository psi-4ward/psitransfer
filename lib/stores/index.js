'use strict';
const FileStore = require('./fileStore');
const S3Store = require('./s3Store');
const debug = require('debug')('psitransfer:store:factory');

/**
 * Create a storage instance based on configuration
 * @param {object} config - Application configuration
 * @returns {Store} Storage instance (FileStore or S3Store)
 */
function createStore(config) {
  const storageType = config.storage?.type || 'filesystem';

  debug(`Creating store with type: ${storageType}`);

  if (storageType === 's3') {
    if (!config.storage.bucket) {
      throw new Error('S3 storage requires storage.bucket to be configured');
    }
    if (!config.storage.region) {
      throw new Error('S3 storage requires storage.region to be configured');
    }

    debug(`Initializing S3 store with bucket: ${config.storage.bucket}`);
    return new S3Store({
      bucket: config.storage.bucket,
      region: config.storage.region,
      endpoint: config.storage.endpoint,
      credentials: config.storage.credentials,
      signedUrlExpiry: config.storage.signedUrlExpiry || 3600,
    });
  } else if (storageType === 'filesystem') {
    debug(`Initializing filesystem store with directory: ${config.uploadDir}`);
    return new FileStore(config.uploadDir);
  } else {
    throw new Error(`Unknown storage type: ${storageType}. Must be 'filesystem' or 's3'`);
  }
}

module.exports = {
  createStore,
  FileStore,
  S3Store,
};
