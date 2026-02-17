'use strict';
const fsp = require('fs-promise');
const path = require('path');
const debug = require('debug')('psitransfer:db');
const config = require('../config');
const { ListObjectsV2Command } = require('@aws-sdk/client-s3');

module.exports = class DB {

  constructor(uploadDir, store) {
    this.initialized = false;
    this.db = {};

    this.uploadDir = uploadDir;
    this.store = store;

    // delete expired files
    const gc = () => {
      let sid,f,expires;
      for (sid of Object.keys(this.db)) {
        for (f of this.db[sid]) {
          // expire on maxAge
          expires = (+f.metadata.createdAt) + (config.maxAge * 1000) - Date.now();

          // respect one-time downloads
          if(expires > 0 && Number.isInteger(+f.metadata.retention)) {
            expires = (+f.metadata.createdAt) + (+f.metadata.retention * 1000) - Date.now();
          }

          if(expires <= 0) {
            debug(`Expired ${sid}++${f.key}`);
            this.remove(sid, f.key).catch(e => console.error(e));
          }
        }
      }
    };
    setInterval(gc, 60*1000);

  }


  init() {
    if(this.initialized) return;
    this.initialized = true;

    try {
      if (this.store.getType() === 's3') {
        // S3 sync is async, so we'll call it but not wait
        this._syncS3().catch(e => {
          console.error('S3 sync error:', e);
          this.initialized = false;
        });
      } else {
        this._sync();
      }
    } catch(e) {
      this.initialized = false;
      e.message = `db initialization failed with error ${e.message}`;
      throw e;
    }
  }


  /**
   * Sync from S3 bucket
   * @private
   */
  async _syncS3() {
    debug('Syncing from S3 bucket');

    const s3Client = this.store.s3Client;
    const bucket = this.store.bucket;
    const sids = new Set();

    let continuationToken = null;

    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      });

      const response = await s3Client.send(command);

      if (response.Contents) {
        for (const object of response.Contents) {
          // Skip metadata files
          if (object.Key.endsWith('.json')) continue;

          // Extract sid from key (format: sid/uuid)
          const parts = object.Key.split('/');
          if (parts.length === 2) {
            const sid = parts[0];
            const key = parts[1];
            sids.add(sid);

            try {
              const info = await this.store.info(`${sid}++${key}`);
              this.add(sid, key, info);
            } catch (e) {
              debug(`Error importing ${sid}++${key}: ${e.message}`);
            }
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    debug(`Synced ${sids.size} buckets from S3`);
  }


  /**
   * Sync from filesystem
   * @private
   */
  _sync() {
    fsp.ensureDirSync(this.uploadDir);

    fsp.readdirSync(this.uploadDir).forEach((sid) => {
      this._import(sid);
    });
  }


  /**
   * @private
   */
  _import(sid) {
    const p = path.resolve(this.uploadDir, sid);
    const stat = fsp.statSync(p);
    if(!stat.isDirectory()) return;

    fsp.readdirSync(p).forEach(async (key) => {
      if(path.extname(key) !== '') {
        return Promise.resolve();
      }
      try {
        let info = await this.store.info(`${sid}++${key}`);
        this.add(sid, key, info);
      } catch(e) {
        console.error(e);
      }
    });
  }


  add(sid, key, data) {
    if(!this.initialized) throw new Error('DB not initialized_');
    if(!this.db[sid]) this.db[sid] = [];
    data.key = key;
    const old = this.db[sid].findIndex(i => i.key === key);
    if(old !== -1) {
      this.db[sid].splice(old, 1, data);
      debug(`Updated ${sid}++${key}`);
    } else {
      this.db[sid].push(data);
      debug(`Added ${sid}++${key}`);
    }
  }


  async remove(sid, key) {
    if(!this.initialized) throw new Error('DB not initialized');
    debug(`Remove ${sid}++${key}`);
    await this.store.del(sid + '++' + key);
    const i = this.db[sid].findIndex(item => item.key === key);
    this.get(sid).splice(i, 1);
    if(this.get(sid).length === 0) {
      delete this.db[sid];
      // Only try to remove directory for filesystem storage
      if (this.store.getType() === 'filesystem') {
        await fsp.rmdir(path.resolve(this.uploadDir, sid));
      }
    }
  }


  async updateLastDownload(sid, key) {
    debug(`Update last download ${sid}++${key}`);
    const data = this.get(sid).find(item => item.key === key);
    if(!data) return;
    data.metadata.lastDownload = Date.now();
    await this.store.update(`${sid}++${key}`, data);
  }


  async updateMetadata(sid, key, data) {
    debug(`Update metadata ${ sid }++${ key }`);
    const file = this.get(sid).find(item => item.key === key);
    if (!file) return;
    file.metadata = { ...file.metadata, ...data };
    await this.store.update(`${ sid }++${ key }`, file);
  }

  async lock(sid) {
    const files = this.get(sid);
    if(!files) return;
    await Promise.all(files.map(async file => {
      await this.updateMetadata(sid, file.key, { buckedLocked: true });
    }));
  }

  isLocked(sid) {
    const files = this.get(sid);
    if(!files) return false;
    return files.some(file => file.metadata.buckedLocked);
  }

  get(sid) {
    return this.db[sid];
  }

  bucketSize(sid) {
    const bucket = this.get(sid);
    if(!bucket) return 0;
    return bucket.reduce((v, file) => v + +file.metadata.uploadLength, 0);
  }

};
