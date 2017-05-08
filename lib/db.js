'use strict';
const fsp = require('fs-promise');
const path = require('path');
const debug = require('debug')('psitransfer:db');

module.exports = class DB {

  constructor(uploadDir, store) {
    this.initialized = false;
    this.db = {};
    this.expireTimers = {};

    this.uploadDir = uploadDir;
    this.store = store;

    // delete expired files
    const gc = () => {
      let sid,f,expires;
      for (sid of Object.keys(this.db)) {
        for (f of this.db[sid]) {
          // no removal of one-time downloads
          if(!Number.isInteger(+f.metadata.retention)) return;

          expires = (+f.metadata.createdAt) + (+f.metadata.retention * 1000) - Date.now();
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
      this._sync();
    } catch(e) {
      this.initialized = false;
      e.message = `db initialization failed with error ${e.message}`;
      throw e;
    }
  }


  /**
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
      await fsp.rmdir(path.resolve(this.uploadDir, sid));
    }
  }


  get(sid) {
    return this.db[sid];
  }

};
