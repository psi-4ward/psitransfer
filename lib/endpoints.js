'use strict';
const config = require('../config');
const tusboy = require('tusboy').default;
const express = require('express');
const morgan = require('morgan');
const compression = require('compression');
const Store = require('./store');
const uuid = require('uuid/v4');
const path = require('path');
const fs = require("fs");
const tusMeta = require('tus-metadata');
const assert = require('assert');
const AES = require("crypto-js/aes");
const MD5 = require("crypto-js/md5");
const debug = require('debug')('psitransfer:main');
const archiver = require('archiver');
const zlib = require('zlib');
const _ = require('lodash');

const errorPage = fs.readFileSync(path.join(__dirname, '../public/html/error.html')).toString();
const store = new Store(config.uploadDir);
const Db = require('./db');
const db = new Db(config.uploadDir, store);
db.init();
const app = express();

app.disable('x-powered-by');
app.use(compression());

if(config.accessLog) {
  app.use(morgan(config.accessLog));
}

// Static files
app.use('/app', express.static(path.join(__dirname, '../public/app')));
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

// robots.txt
app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/robots.txt'));
});

// Upload App
//
//
app.get('/', (req, res) => {
		 if (config.dynUpload != '/') 
			res.status(304).redirect(config.dynUpload);
		else
			res.sendFile(path.join(__dirname, '../public/html/upload.html'));
});

app.get(config.dynUpload, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/html/upload.html'));
});

// Config
app.get('/config.json', (req, res) => {
  res.json({
    retentions: config.retentions,
    defaultRetention: config.defaultRetention,
    mailTemplate: config.mailTemplate
  });
});


app.get('/admin', (req, res, next) => {
  if(!config.adminPass) return next();
  res.sendFile(path.join(__dirname, '../public/html/admin.html'));
});
app.get('/admin/data.json', (req, res, next) => {
  if(!config.adminPass) return next();
  if(!req.get('x-passwd')) return res.status(401).send('Unauthorized');
  if(req.get('x-passwd') !== config.adminPass) return res.status(403).send('Forbidden');

  const result = _.chain(db.db)
    .cloneDeep()
    .forEach(bucket => {
      bucket.forEach(file => {
        if(file.metadata.password) {
          file.metadata._password = true;
          delete file.metadata.password;
          delete file.metadata.key;
          delete file.key;
          delete file.url;
        }
      })
    })
    .value();

  // make bruteforce attack more difficult
  setTimeout(() => {
    res.json(result);
  },250);
});


// List files / Download App
app.get('/:sid', (req, res, next) => {
  if(req.url.endsWith('.json')) {
    const sid = req.params.sid.substr(0, req.params.sid.length-5);
    if(!db.get(sid)) return res.status(404).end();

    res.header('Cache-control', 'private, max-age=0, no-cache, no-store, must-revalidate');
    res.json({
      items: db.get(sid).map(data => {
        const item = Object.assign(data, {url: `/files/${sid}++${data.key}`});
        if(item.metadata.password) {
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
    if(!db.get(req.params.sid)) return next();
    res.sendFile(path.join(__dirname, '../public/html/download.html'));
  }
});


// Download files
app.get('/files/:fid', async(req, res, next) => {
  // let tusboy handle HEAD requests with Tus Header
  if(req.method === 'HEAD' && req.get('Tus-Resumable')) return next();

  // Download all files
  if(req.params.fid.match(/^[a-z0-9+]+\.(tar\.gz|zip)$/)) {
    const sid = req.params.fid.split('++')[0];
    const format = req.params.fid.endsWith('.zip') ? 'zip' : 'tar.gz';
    const bucket = db.get(sid);

    if(!bucket) return res.status(404).send(errorPage.replace('%%ERROR%%', 'Download bucket not found.'));

    if(req.params.fid !== sid + '++' + MD5(bucket.map(f => f.key).join()).toString() + '.' + format) {
      res.status(404).send(errorPage.replace('%%ERROR%%', 'Invalid link'));
      return;
    }
    debug(`Download Bucket ${sid}`);

    if(format === 'zip') res.header('ContentType', 'application/zip');
    if(format === 'tar.gz') res.header('ContentType', 'application/x-gtar');
    res.header('Content-Disposition', `attachment; filename="${sid}.${format}"`);

    const archive = archiver(format === 'zip' ? 'zip' : 'tar');
    archive.on('error', function(err) {
      console.error(err);
    });

    bucket.forEach(info => {
      archive.append(
        fs.createReadStream(store.getFilename(info.metadata.sid + '++' + info.key)),
        {name: info.metadata.name}
      );
    });

    if(format === 'tar.gz') {
      archive.pipe(zlib.createGzip()).pipe(res);
    } else {
      archive.pipe(res);
    }
    archive.finalize();

    try {
      res.on('finish', async () => {
        bucket.forEach(async info => {
          if(info.metadata.retention === 'one-time') {
            await db.remove(info.metadata.sid, info.metadata.key);
          } else {
            await db.updateLastDownload(info.metadata.sid, info.metadata.key);
          }
        });
      });
    } catch(e) {
      console.error(e);
    }

    return;
  }

  // Download single file
  debug(`Download ${req.params.fid}`);
  try {
    const info = await store.info(req.params.fid); // throws on 404
    res.download(store.getFilename(req.params.fid), info.metadata.name);

    // remove one-time files after download
    res.on('finish', async () => {
      if(info.metadata.retention === 'one-time') {
        await db.remove(info.metadata.sid, info.metadata.key);
      } else {
        await db.updateLastDownload(info.metadata.sid, info.metadata.key);
      }
    });
  } catch(e) {
    res.status(404).send(errorPage.replace('%%ERROR%%', e.message));
  }
});


// Upload file
app.use('/files',
  function(req, res, next) {
    if(req.method === 'GET') return res.status(405).end();

    if(req.method === 'POST') {
      // validate meta-data
      // !! tusMeta.encode supports only strings !!
      const meta = tusMeta.decode(req.get('Upload-Metadata'));

      try {
        assert(meta.name, 'tus meta prop missing: name');
        assert(meta.sid, 'tus meta prop missing: sid');
        assert(meta.retention, 'tus meta prop missing: retention');
        assert(Object.keys(config.retentions).indexOf(meta.retention) >= 0,
          `invalid tus meta prop retention. Value ${meta.retention} not in [${Object.keys(config.retentions).join(',')}]`);

        meta.key = uuid();
        meta.createdAt = Date.now().toString();

        // store changed metadata for tusboy
        req.headers['upload-metadata'] = tusMeta.encode(meta);
        // for tusboy getKey()
        req.FID = meta.sid + '++' + meta.key;

        db.add(meta.sid, meta.key, {
          "isPartial": true,
          metadata: meta
        });
      }
      catch(e) {
        return res.status(400).end(e.message);
      }
    }

    next();
  },

  // let tusboy handle the upload
  tusboy(store, {
    getKey: req => req.FID,
    afterComplete: (req, upload, fid) => {
      db.add(upload.metadata.sid, upload.metadata.key, upload);
      debug(`Completed upload ${fid}, size=${upload.size} name=${upload.metadata.name}`);
    },
  })
);

app.use((req, res, next) => {
  res.status(404).send(errorPage.replace('%%ERROR%%', 'Download bucket not found.'));
});

module.exports = app;
