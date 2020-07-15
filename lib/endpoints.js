'use strict';
const pug = require('pug');
const express = require('express');
const morgan = require('morgan');
const compression = require('compression');
const uuid = require('uuid').v4;
const path = require('path');
const fs = require("fs");
const assert = require('assert');
const AES = require("crypto-js/aes");
const MD5 = require("crypto-js/md5");
const archiver = require('archiver');
const zlib = require('zlib');
const axios = require('axios');
const config = require('../config');
const tusboy = require('./tusboy');
const Store = require('./store');
const tusMeta = require('./tusboy/tus-metadata');
const debug = require('debug')('psitransfer:main');

const pugVars = {
  baseUrl: config.baseUrl
};

const errorPage = pug.compileFile(path.join(__dirname, '../public/pug/error.pug'), { pretty: true });
const adminPage = pug.compileFile(path.join(__dirname, '../public/pug/admin.pug'), { pretty: true });
const uploadPage = pug.compileFile(path.join(__dirname, '../public/pug/upload.pug'), { pretty: true });
const downloadPage = pug.compileFile(path.join(__dirname, '../public/pug/download.pug'), { pretty: true });

const store = new Store(config.uploadDir);
const Db = require('./db');
const db = new Db(config.uploadDir, store);
db.init();
const app = express();

app.disable('x-powered-by');
app.use(compression());

if (config.accessLog) {
  app.use(morgan(config.accessLog));
}

if (config.forceHttps) {
  app.enable('trust proxy');
  app.use(function(req, res, next) {
    if (req.secure) return next();
    const target = config.forceHttps === 'true' ? 'https://' + req.headers.host : config.forceHttps;
    res.redirect(target + req.url);
  });
}

// Static files
app.use(`${ config.baseUrl }app`, express.static(path.join(__dirname, '../public/app')));
app.use(`${ config.baseUrl }assets`, express.static(path.join(__dirname, '../public/assets')));

// robots.txt
app.get(`${ config.baseUrl }robots.txt`, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/robots.txt'));
});

// Upload App
app.get(`${ config.baseUrl }`, (req, res) => {
  if (config.uploadAppPath !== `${ config.baseUrl }`) {
    res.status(304).redirect(config.uploadAppPath);
  } else {
    res.send(uploadPage(pugVars));
  }
});

app.get(config.uploadAppPath, (req, res) => {
  res.send(uploadPage(pugVars));
});

// Return translations
app.get(`${ config.baseUrl }lang.json`, (req, res) => {
  const lang = req.acceptsLanguages(...Object.keys(config.languages));
  res.json(config.languages[lang]);
});

// Config
app.get(`${ config.baseUrl }config.json`, (req, res) => {
  // Upload password protection
  if (config.uploadPass) {
    const bfTimeout = 200;
    if (!req.get('x-passwd')) {
      setTimeout(() => res.status(401).send('Unauthorized'), bfTimeout);
      return;
    }
    if (req.get('x-passwd') !== config.uploadPass) {
      setTimeout(() => res.status(403).send('Forbidden'), bfTimeout);
      return;
    }
  }

  res.json({
    retentions: config.retentions,
    defaultRetention: config.defaultRetention,
    mailTemplate: config.mailTemplate,
    requireBucketPassword: config.requireBucketPassword,
    maxFileSize: config.maxFileSize,
    maxBucketSize: config.maxBucketSize,
  });
});

app.get(`${ config.baseUrl }admin`, (req, res, next) => {
  if (!config.adminPass) return next();
  res.send(adminPage(pugVars));
});

app.get(`${ config.baseUrl }admin/data.json`, (req, res, next) => {
  if (!config.adminPass) return next();

  const bfTimeout = 500;
  if (!req.get('x-passwd')) {
    // delay answer to make brute force attacks more difficult
    setTimeout(() => res.status(401).send('Unauthorized'), bfTimeout);
    return;
  }
  if (req.get('x-passwd') !== config.adminPass) {
    setTimeout(() => res.status(403).send('Forbidden'), bfTimeout);
    return;
  }

  let result = JSON.parse(JSON.stringify(db.db));
  Object.values(result).forEach(bucket => {
    bucket.forEach(file => {
      if (file.metadata.password) {
        file.metadata._password = true;
        delete file.metadata.password;
        delete file.metadata.key;
        delete file.key;
        delete file.url;
      }
    });
  });

  setTimeout(() => res.json(result), bfTimeout);
});


// List files / Download App
app.get(`${ config.baseUrl }:sid`, (req, res, next) => {
  if (req.url.endsWith('.json')) {
    const sid = req.params.sid.substr(0, req.params.sid.length - 5);
    if (!db.get(sid)) return res.status(404).end();

    res.header('Cache-control', 'private, max-age=0, no-cache, no-store, must-revalidate');
    res.json({
      items: db.get(sid).map(data => {
        const item = Object.assign(data, { url: `${ config.baseUrl }files/${ sid }++${ data.key }` });
        if (item.metadata.password) {
          return AES.encrypt(JSON.stringify(data), item.metadata.password).toString();
        } else {
          return item;
        }
      }),
      config: {
        maxPreviewSize: config.maxPreviewSize
      }
    });
  } else {
    if (!db.get(req.params.sid)) return next();
    res.send(downloadPage(pugVars));
  }
});


// Download files
app.get(`${ config.baseUrl }files/:fid`, async (req, res, next) => {
  // let tusboy handle HEAD requests with Tus Header
  if (req.method === 'HEAD' && req.get('Tus-Resumable')) return next();

  const sid = req.params.fid.split('++')[0];

  // Download all files
  if (req.params.fid.match(/^[a-z0-9+]+\.(tar\.gz|zip)$/)) {
    const format = req.params.fid.endsWith('.zip') ? 'zip' : 'tar.gz';
    const bucket = db.get(sid);

    if (!bucket) return res.status(404).send(errorPage({ ...pugVars, error: 'Download bucket not found.' }));

    if (req.params.fid !== sid + '++' + MD5(bucket.map(f => f.key).join()).toString() + '.' + format) {
      res.status(404).send(errorPage({ ...pugVars, error: 'Invalid link' }));
      return;
    }
    debug(`Download Bucket ${ sid }`);

    if (format === 'zip') res.header('ContentType', 'application/zip');
    if (format === 'tar.gz') res.header('ContentType', 'application/x-gtar');
    res.header('Content-Disposition', `attachment; filename="${ sid }.${ format }"`);

    const archive = archiver(format === 'zip' ? 'zip' : 'tar');
    archive.on('error', function(err) {
      console.error(err);
    });

    bucket.forEach(info => {
      archive.append(
        fs.createReadStream(store.getFilename(info.metadata.sid + '++' + info.key)),
        { name: info.metadata.name }
      );
    });

    if (format === 'tar.gz') {
      archive.pipe(zlib.createGzip()).pipe(res);
    } else {
      archive.pipe(res);
    }
    archive.finalize();

    try {
      res.on('finish', async () => {
        bucket.forEach(async info => {
          if (info.metadata.retention === 'one-time') {
            await db.remove(info.metadata.sid, info.metadata.key);
          } else {
            await db.updateLastDownload(info.metadata.sid, info.metadata.key);
          }
        });

        // Trigger fileDownloadedWebhook
        if (config.fileDownloadedWebhook) {
          axios.post(config.fileDownloadedWebhook, {
            fid: sid,
            file: '_archive_',
            date: Date.now()
          }).catch(err => console.error(err));
        }

      });
    }
    catch (e) {
      console.error(e);
    }

    return;
  }

  // Download single file
  debug(`Download ${ req.params.fid }`);
  try {
    const info = await store.info(req.params.fid); // throws on 404
    res.download(store.getFilename(req.params.fid), info.metadata.name);

    // remove one-time files after download
    res.on('finish', async () => {
      if (info.metadata.retention === 'one-time') {
        await db.remove(info.metadata.sid, info.metadata.key);
      } else {
        await db.updateLastDownload(info.metadata.sid, info.metadata.key);
      }

      // Trigger fileDownloadedWebhook
      if (config.fileDownloadedWebhook) {
        axios.post(config.fileDownloadedWebhook, {
          bucket: sid,
          file: info.metadata.name,
          date: Date.now()
        }).catch(err => console.error(err));
      }
    });
  }
  catch (e) {
    res.status(404).send(errorPage({ ...pugVars, error: e.message }));
  }
});


// Upload file
app.use(`${ config.baseUrl }files`,
  function(req, res, next) {
    // Upload password protection
    if (config.uploadPass) {
      const bfTimeout = 500;
      if (!req.get('x-passwd')) {
        setTimeout(() => res.status(401).send('Unauthorized'), bfTimeout);
        return;
      }
      if (req.get('x-passwd') !== config.uploadPass) {
        setTimeout(() => res.status(403).send('Forbidden'), bfTimeout);
        return;
      }
    }

    if (req.method === 'GET') return res.status(405).end();

    if (req.method === 'POST') {
      // validate meta-data
      // !! tusMeta.encode supports only strings !!
      const meta = tusMeta.decode(req.get('Upload-Metadata'));

      try {
        assert(meta.name, 'tus meta prop missing: name');
        assert(meta.sid, 'tus meta prop missing: sid');
        assert(meta.retention, 'tus meta prop missing: retention');
        assert(Object.keys(config.retentions).indexOf(meta.retention) >= 0,
          `invalid tus meta prop retention. Value ${ meta.retention } not in [${ Object.keys(config.retentions).join(',') }]`);

        const uploadLength = req.get('Upload-Length');
        assert(uploadLength, 'missing Upload-Length header');

        meta.uploadLength = uploadLength;
        meta.key = uuid();
        meta.createdAt = Date.now().toString();

        // limit file and bucket size
        if (config.maxFileSize && config.maxFileSize < +uploadLength) {
          return res
            .status(413)
            .json({ message: `File exceeds maximum upload size ${ config.maxFileSize }.` });
        } else if (config.maxBucketSize && db.bucketSize(meta.sid) + +uploadLength > config.maxBucketSize) {
          return res
            .status(413)
            .json({ message: `Bucket exceeds maximum upload size ${ config.maxBucketSize }.` });
        }

        // store changed metadata for tusboy
        req.headers['upload-metadata'] = tusMeta.encode(meta);
        // for tusboy getKey()
        req.FID = meta.sid + '++' + meta.key;

        db.add(meta.sid, meta.key, {
          "isPartial": true,
          metadata: meta
        });
      }
      catch (e) {
        console.error(e);
        return res.status(400).end(e.message);
      }
    }

    next();
  },

  // let tusboy handle the upload
  tusboy(store, {
    getKey: req => req.FID,
    maxUploadLength: config.maxFileSize || Infinity,
    afterComplete: (req, upload, fid) => {
      db.add(upload.metadata.sid, upload.metadata.key, upload);
      debug(`Completed upload ${ fid }, size=${ upload.size } name=${ upload.metadata.name }`);

      // Trigger fileUploadedWebhook
      if (config.fileUploadedWebhook) {
        axios.post(config.fileUploadedWebhook, {
          metadata: upload.metadata,
          date: Date.now()
        }).catch(err => console.error(err));
      }
    },
  })
);

app.use((req, res, next) => {
  res.status(404).send(errorPage({ ...pugVars, error: 'Download bucket not found.' }));
});

module.exports = app;
