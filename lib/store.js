'use strict';
const fsp = require('fs-promise');
const path = require('path');
const Transform = require('stream').Transform;
const { pipeline } = require('stream/promises');
const debug = require('debug')('psitransfer:store');
const httpErrors = require('http-errors');
const storeErrors = require('./tusboy/store/errors');

// Passes at most maxBytes through, errors on more
class StreamLimit extends Transform {
  constructor(maxBytes, options) {
    super(options);
    this.bytes = 0;
    this.maxBytes = maxBytes;
  }

  _transform(chunk, encoding, cb) {
    this.bytes += chunk.length;
    if(this.bytes > this.maxBytes) return cb(new storeErrors.UploadLengthExceeded());
    this.push(chunk);
    cb();
  }
}

// TODO ???: make tus-store complaint: https://github.com/blockai/abstract-tus-store
class Store {

  constructor(targetDir) {
    this.dir = path.resolve(targetDir);
    // fids with a running append
    this.appending = new Set();
  }


  getFilename(fid) {
    if (typeof fid !== 'string' || fid.includes('\0')) {
      throw new Error('file name not in jail path. aborting');
    }
    const base = this.dir;
    const resolved = path.resolve(base, fid.replace(/\+\+/g, '/'));
    const rel = path.relative(base, resolved);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('file name not in jail path. aborting');
    }
    return resolved;
  }


  async create(fid, opts = {}) {
    debug(`New File ${this.getFilename(fid)}`);
    await fsp.ensureDir(path.dirname(this.getFilename(fid)));
    await fsp.writeFile(this.getFilename(fid), '');
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


  async append(fid, readStream, offset, { contentLength } = {}) {
    // one append per upload at a time: no await between check and add
    if(this.appending.has(fid)) throw new storeErrors.UploadLocked();
    this.appending.add(fid);
    try {
      const current = await this.info(fid);
      if(offset !== current.size) {
        throw Object.assign(new storeErrors.OffsetMismatch(), { expected: current.size });
      }
      // never write more than the Upload-Length declared (and checked) on creation
      const remaining = +current.uploadLength - current.size;
      if(!(remaining >= 0) || contentLength > remaining) throw new storeErrors.UploadLengthExceeded();

      debug(`Append Data to ${this.getFilename(fid)}`);
      // No `start`: a positional write on an O_APPEND fd fails with EOPNOTSUPP on
      // musl >= 1.2.5 with kernels < 6.9 (no RWF_NOAPPEND); Linux ignores it anyway
      const ws = fsp.createWriteStream(this.getFilename(fid), {flags: 'a'});
      const limit = new StreamLimit(remaining);
      // not part of the pipeline: destroying the request would kill the socket
      // before the response is sent; pipe() unpipes on errors of the limit
      readStream.pipe(limit);
      // an aborted request does not end the limit
      readStream.on('close', () => {
        if(!readStream.readableEnded) limit.destroy(new storeErrors.RequestAborted());
      });
      await pipeline(limit, ws);

      const info = await this.info(fid);
      if(info.size >= info.uploadLength) delete info.isPartial;
      await fsp.writeJson(this.getFilename(fid) + '.json', info);
      debug(`Finished appending Data to ${this.getFilename(fid)}`);
      return { offset: info.offset, upload: info };
    } finally {
      this.appending.delete(fid);
    }
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
