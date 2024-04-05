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
const tar = require('tar-stream');
const config = require('../config');
const eventBus = require('./eventBus');
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
const { createGzip } = require("zlib");
const httpErrors = require("http-errors");
const db = new Db(config.uploadDir, store);
db.init();
const app = express();

app.disable('x-powered-by');
app.use(compression());
app.use(express.json());

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

// Resolve language
app.use((req, res, next) => {
  const lang = req.acceptsLanguages(...Object.keys(config.languages)) || config.defaultLanguage;
  req.translations = config.languages[lang];
  next();
});

// robots.txt
app.get(`${ config.baseUrl }robots.txt`, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/robots.txt'));
});

// Init plugins
config.plugins.forEach(pluginName => {
  require('../plugins/' + pluginName)(eventBus, app, config, db);
});

// Upload App
app.get(config.uploadAppPath, (req, res) => {
  res.send(uploadPage({
    ...pugVars,
    baseUrl: config.baseUrl,
    uploadAppPath: config.uploadAppPath,
    lang: req.translations
  }));
});

// Return translations
app.get(`${ config.baseUrl }lang.json`, (req, res) => {
  eventBus.emit('getLang', req.translations);
  res.json(req.translations);
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

  const frontendConfig = {
    retentions: config.retentions,
    defaultRetention: config.defaultRetention,
    mailTemplate: config.mailTemplate,
    requireBucketPassword: config.requireBucketPassword,
    maxFileSize: config.maxFileSize,
    maxBucketSize: config.maxBucketSize,
    disableQrCode: config.disableQrCode,
  };

  eventBus.emit('getFrontendConfig', frontendConfig);

  res.json(frontendConfig);
});

app.get(`${ config.baseUrl }admin`, (req, res, next) => {
  if (!config.adminPass) return next();
  res.send(adminPage({ ...pugVars, lang: req.translations }));
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

    const downloadPassword = req.get('x-download-pass');
    const items = db.get(sid).map(item => ({
      ...item,
      url: `${ config.baseUrl }files/${ sid }++${ item.key }`
    }));

    res.header('Cache-control', 'private, max-age=0, no-cache, no-store, must-revalidate');

    // Currently, every item in a bucket must have the same password
    if(items.some(item => item.metadata.password && item.metadata.password !== downloadPassword)) {
      setTimeout(() => res.status(401).send('Unauthorized'), 500);
      return;
    }

    res.json({
      items,
      config: {
        maxPreviewSize: config.maxPreviewSize
      }
    });
  } else {
    if (!db.get(req.params.sid)) return next();
    res.send(downloadPage({ ...pugVars, lang: req.translations }));
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

    if (!bucket) return res.status(404).send(errorPage({
        ...pugVars,
        error: 'Download bucket not found.',
        lang: req.translations,
        uploadAppPath: config.uploadAppPath || config.baseUrl,
      }));

    if (req.params.fid !== sid + '++' + MD5(bucket.map(f => f.key).join()).toString() + '.' + format) {
      res.status(404).send(errorPage({
        ...pugVars,
        error: 'Invalid link',
        uploadAppPath: config.uploadAppPath || config.baseUrl,
        lang: req.translations,
      }));
      return;
    }
    debug(`Download Bucket ${ sid }`);

    const filename = `${ sid }.${ format }`;
    res.header('Content-Disposition', `attachment; filename="${ filename }"`);

    try {
      res.on('finish', async () => {
        bucket.forEach(async info => {
          if (info.metadata.retention === 'one-time') {
            await db.remove(info.metadata.sid, info.metadata.key);
          } else {
            await db.updateLastDownload(info.metadata.sid, info.metadata.key);
          }
        });

        eventBus.emit('archiveDownloaded', {
          sid,
          file: filename,
          metadata: bucket[0].metadata,
          bucket,
          url: req.protocol + '://' + req.get('host') + req.originalUrl,
        });
      });
    }
    catch (e) {
      console.error(e);
    }

    if(format === 'zip') {
      res.header('ContentType', 'application/zip');
      const archive = archiver('zip');
      archive.on('error', function(err) {
        console.error(err);
      });
      archive.pipe(res);

      for (const info of bucket) {
        await new Promise((resolve, reject) => {
          const stream = fs.createReadStream(store.getFilename(info.metadata.sid + '++' + info.key));
          stream.on('end', resolve);
          archive.append(stream, { name: info.metadata.name });
        });
      }

      await archive.finalize();
    } else {
      res.header('ContentType', 'application/x-gtar');
      const pack = tar.pack();
      pack.pipe(createGzip()).pipe(res);

      for (const info of bucket) {
        await new Promise((resolve, reject) => {
          const readStream = fs.createReadStream(store.getFilename(info.metadata.sid + '++' + info.key));
          const entry = pack.entry({ name: info.metadata.name, size: info.size });
          readStream.on('error', reject);
          entry.on('error', reject);
          entry.on('finish',resolve);
          readStream.pipe(entry);
        });
      }
      pack.finalize();
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

      eventBus.emit('fileDownloaded', {
        sid,
        file: info.metadata.name,
        metadata: info.metadata,
        url: req.protocol + '://' + req.get('host') + req.originalUrl,
      });
    });
  }
  catch (e) {
    res.status(404).send(errorPage({
      ...pugVars,
      error: e.message,
      lang: req.translations,
      uploadAppPath: config.uploadAppPath || config.baseUrl,
    }));
  }
});


// Upload file
app.use(`${ config.uploadAppPath }files`,
  async function(req, res, next) {
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

    // Lock bucket by PATCH /files/:sid?lock=yes
    const fid = req.path.substring(1);
    if(!fid.includes('++') && req.method === 'PATCH' && req.query.lock) {
      await db.lock(fid);
      return res.status(204).end('Bucket locked');
    }

    if(['POST', 'PATCH'].includes(req.method)) {
      // Restrict upload to the bucket if it is locked
      if(!fid.includes('++') && db.isLocked(fid)) {
        return res.status(400).end('Bucket locked');
      }
      try {
        const info = await store.info(fid);
        // Restrict upload to the bucket if it is locked
        if(info.metadata.locked) {
          return res.status(400).end('Bucket locked');
        }
        // Restrict upload to a file which upload completed already
        if(!info.isPartial) {
          return res.status(400).end('Upload already completed');
        }
      } catch(e) {
        if(! e instanceof httpErrors.NotFound) {
          console.error(e);
          return;
        }
      }
    }

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

        // Restrict creating new files for locked buckets
        if(db.isLocked(meta.sid)) {
          return res.status(400).end('Bucket locked');
        }

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
      eventBus.emit('fileUploaded', upload);
    },
  })
);

app.use((req, res, next) => {
  if (req.url === config.baseUrl) {
    return res.redirect(config.uploadAppPath);
  }

  res.status(404).send(errorPage({
    ...pugVars,
    error: 'Download bucket not found.',
    uploadAppPath: config.uploadAppPath || config.baseUrl,
    lang: req.translations
  }));
});

module.exports = app;
