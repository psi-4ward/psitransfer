'use strict';
const fsp = require('fs-promise');
const path = require('path');
const Transform = require('stream').Transform;
const debug = require('debug')('psitransfer:store');
const httpErrors = require('http-errors');

class StreamLen extends Transform {
  constructor(options) {
    super(options);
    this.bytes = 0;
  }

  _transform(chunk, encoding, cb) {
    this.bytes += chunk.length;
    this.push(chunk);
    cb();
  }
}

// TODO ???: make tus-store complaint: https://github.com/blockai/abstract-tus-store
class Store {

  constructor(targetDir) {
    this.dir = path.normalize(targetDir);
  }


  getFilename(fid) {
    let p = path.resolve(this.dir, fid.replace('++', '/'));
    if(!p.startsWith(this.dir)) {
      throw new Error('file name not in jail path. aborting');
    }
    return p;
  }


  async create(fid, opts = {}) {
    debug(`New File ${this.getFilename(fid)}`);
    await fsp.ensureDir(path.dirname(this.getFilename(fid)));
    await fsp.writeJson(this.getFilename(fid) + '.json', Object.assign(opts, {
      isPartial: true
    }));
    return {uploadId: fid};
  }


  async update(fid, data) {
    debug(`Update File ${this.getFilename(fid)}`);
    await fsp.writeJson(this.getFilename(fid) + '.json', data);
    return data;
  }


  async info(fid) {
    try {
      const info = await fsp.readJson(this.getFilename(fid) + '.json');
      const stat = await fsp.stat(this.getFilename(fid));
      info.size = stat.size;
      info.offset = stat.size;
      debug(`Fetched Fileinfo ${this.getFilename(fid)}`);
      return info;
    } catch(e) {
      if(e.code === 'ENOENT') {
        throw httpErrors.NotFound();
      }
      throw e;
    }
  }


  async append(fid, readStream, offset) {
    debug(`Append Data to ${this.getFilename(fid)}`);
    const uploadSize = new StreamLen();
    const ws = fsp.createWriteStream(this.getFilename(fid), {flags: 'a', start: offset});

    const ret = new Promise((resolve, reject) => {
      ws.on('finish', async() => {
        const info = await this.info(fid);
        if(info.size >= info.uploadLength) delete info.isPartial;
        await fsp.writeJson(this.getFilename(fid) + '.json', info);
        debug(`Finished appending Data to ${this.getFilename(fid)}`);
        return resolve({ offset: info.offset, upload: info });
      });
      ws.on('error', reject);
    });

    readStream.pipe(uploadSize).pipe(ws);
    return ret;
  }


  createReadStream(fid, start, end, cb) {
    debug(`Create ReadStream for ${this.getFilename(fid)}`);
    this.info(fid).then(info => {
      let contentLength = info.size;
      if(start > 0) {
        if(!end) end = info.size - 1;
        contentLength = end - start + 1
      }
      if(cb) cb({ contentLength, metadata: info.metadata, info });
    });
    return fsp.createReadStream(this.getFilename(fid), {start, end});
  }


  async del(fid) {
    debug(`Delete ${this.getFilename(fid)}`);
    try {
      await fsp.unlink(this.getFilename(fid) + '.json');
    } catch (e) {
      if(e.code !== 'ENOENT') throw e;
    }
    try {
      await fsp.unlink(this.getFilename(fid));
    }
    catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
}

module.exports = Store;
