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
const axios = require('axios');

const Package = require('../package.json');

const errorPage = fs.readFileSync(path.join(__dirname, '../public/html/error.html')).toString();
const store = new Store(config.uploadDir);
const Db = require('./db');
const db = new Db(config.uploadDir, store);
db.init();
const app = express();

const Keycloak = require('keycloak-connect')
const kc = new Keycloak({}, config.keycloak.back);

var protect = function check(req, res, next) { next(); };
if (config.keycloak.front) {
  protect = kc.protect();
  app.use(kc.middleware({
    logout: '/logout',
    admin: '/'
  })); 
}

const nodemailer = require('nodemailer');
var transporter;
if (config.mailOnUsage) {
  transporter = nodemailer.createTransport(config.mailOnUsage.transporter);
}

function mailOnUsage(req,type,metadata) {
  if (config.mailOnUsage) {
    if (config.mailOnUsage.body[type]) {
      const body = config.mailOnUsage.body[type];
      const sid = (req.headers['x-forwarded-proto']?req.headers['x-forwarded-proto']:req.protocol) + '://' + req.get('host') + '/' + metadata.sid;
      const mailOptions = {
        from: config.mailOnUsage.from,
        to: metadata.email,
        subject: config.mailOnUsage.subject.replace("%%URL%%",sid).replace("%%TYPE%%",type).replace("%%FILENAME%%",metadata.name),
        text: body.replace("%%URL%%",sid).replace("%%TYPE%%",type).replace("%%FILENAME%%",metadata.name)
      };
      transporter.sendMail(mailOptions, function(error, info){
        if (error) {
          console.log("mailOnUsage -",type,'-',metadata.sid,'-',error);
        } else {
          console.log("mailOnUsage -",type,'-',metadata.sid,'- Email sent: ' + info.response);
        }
      });
    }
  }
}

app.disable('x-powered-by');
app.use(compression());

if (config.accessLog) {
  app.use(morgan(config.accessLog));
}

if(config.forceHttps) {
  app.enable('trust proxy');
  app.use(function(req, res, next) {
    if (req.secure) return next();
    const target = config.forceHttps === 'true' ? 'https://' + req.headers.host : config.forceHttps;
    res.redirect(target + req.url);
  });
}

// Static files
app.use('/app', express.static(path.join(__dirname, '../public/app')));
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

// robots.txt
app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/robots.txt'));
});

// Upload App
app.get('/', (req, res) => {
  if (config.uploadAppPath !== '/') {
    res.status(304).redirect(config.uploadAppPath);
  } else {
    res.sendFile(path.join(__dirname, '../public/html/upload.html'));
  }
});

app.get(config.uploadAppPath, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/html/upload.html'));
});

// Config
app.get('/config.json', (req, res) => {
  res.json({
    retentions: config.retentions,
    defaultRetention: config.defaultRetention,
    mailTemplate: config.mailTemplate,
    mailTemplateGuest: config.mailTemplateGuest,
    autoPassword: config.autoPassword,
    version: Package.version+' build '+Package.build
  });
});

// Keycloak
app.get('/keycloak', (req, res) => {
  if (config.keycloak.front) res.sendFile(path.join(__dirname, '../public/app/keycloak.js'));
  else res.end();
  //res.sendFile(path.join(__dirname, '../public/app/keycloak.js'));
});
app.get('/keycloak.json', (req, res) => {
  const keycloakFront = config.keycloak.front;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(keycloakFront));
});

// Admin
app.get('/admin', (req, res, next) => {
  if (!config.adminPass) return next();
  res.sendFile(path.join(__dirname, '../public/html/admin.html'));
});
app.get('/admin/data.json',protect , (req, res, next) => {
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

  const result = _.chain(db.db)
    .cloneDeep()
    .forEach(bucket => {
      bucket.forEach(file => {
        if (file.metadata.password) {
          file.metadata._password = true;
          delete file.metadata.password;
          delete file.metadata.key;
          delete file.key;
          delete file.url;
        }
      })
    })
    .value();

  setTimeout(() => res.json(result), bfTimeout);
});


// List files / Download App
app.get('/:sid', (req, res, next) => {
  if (req.url.endsWith('.json')) {
    const sid = req.params.sid.substr(0, req.params.sid.length - 5);
    if (!db.get(sid)) return res.status(404).end();

    res.header('Cache-control', 'private, max-age=0, no-cache, no-store, must-revalidate');
    res.json({
      items: db.get(sid).map(data => {
        const item = Object.assign(data, { url: `/files/${ sid }++${ data.key }` });
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
    // Send mail to keycloak user if needed
    mailOnUsage(req,"Access",db.get(sid)[0].metadata);

  } else {
    if (!db.get(req.params.sid)) return next();
    if (db.get(req.params.sid)[0].metadata.type=='Guest Access') {
      res.status(304).redirect('/guest/'+req.params.sid);
    }
    else res.sendFile(path.join(__dirname, '../public/html/download.html'));
  }
});


// Download files
app.get('/files/:fid', async (req, res, next) => {
  // let tusboy handle HEAD requests with Tus Header
  if (req.method === 'HEAD' && req.get('Tus-Resumable')) return next();

  const sid = req.params.fid.split('++')[0];

  // Download all files
  if (req.params.fid.match(/^[a-z0-9+]+\.(tar\.gz|zip)$/)) {
    const format = req.params.fid.endsWith('.zip') ? 'zip' : 'tar.gz';
    const bucket = db.get(sid);

    if (!bucket) return res.status(404).send(errorPage.replace('%%ERROR%%', 'Download bucket not found.'));

    if (req.params.fid !== sid + '++' + MD5(bucket.map(f => f.key).join()).toString() + '.' + format) {
      res.status(404).send(errorPage.replace('%%ERROR%%', 'Invalid link'));
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
        if(config.fileDownloadedWebhook) {
          axios.post(config.fileDownloadedWebhook, {
            fid: sid,
            file: '_archive_',
            date: Date.now()
          }).catch(err => console.error(err));
        }

        // Send mail to keycloak user if needed
        mailOnUsage(req,"Download Compressed",bucket[0].metadata);

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

      // Send mail to keycloak user if needed
      mailOnUsage(req,"Download",info.metadata);

    });
  }
  catch (e) {
    res.status(404).send(errorPage.replace('%%ERROR%%', e.message));
  }
});


// Upload file
const filesCreate = function(req, res, next) {
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
    catch (e) {
      return res.status(400).end(e.message);
    }
  }

  next();
}
const filesUpload = tusboy(store, {
  getKey: req => req.FID,
  afterComplete: (req, upload, fid) => {
    db.add(upload.metadata.sid, upload.metadata.key, upload);
    debug(`Completed upload ${ fid }, size=${ upload.size } name=${ upload.metadata.name }`);

    // Trigger fileUploadedWebhook
    if (config.fileUploadedWebhook) {
      axios.post(config.fileUploadedWebhook, {
        metadata: upload.metadata,
        date: Date.now()
      }).catch(err => console.error(err));
    };
  },
})

app.use('/files',protect , filesCreate, filesUpload);
app.use('/guest/files/:sid/:key', function(req, res, next) {
  if (!db.get(req.params.sid)) return res.status(405).end();
  if (db.get(req.params.sid)[0].key!=req.params.key) return res.status(405).end();
  next();
  }, filesCreate, filesUpload);

// Guest Access
app.get('/guest/:sid', (req, res) => {
  if (req.url.endsWith('.json')) {
    const sid = req.params.sid.substr(0, req.params.sid.length - 5);
    if (!db.get(sid)) return res.status(404).end();

    // Send mail to keycloak user if needed
    mailOnUsage(req,"Guest Access",db.get(sid)[0].metadata);

    res.header('Cache-control', 'private, max-age=0, no-cache, no-store, must-revalidate');
    res.json(
      db.get(sid).map(data => {
        const item = Object.assign(data);
        if (item.metadata.password) {
          return AES.encrypt(JSON.stringify(data), item.metadata.password).toString();
        } else {
          return item;
        }
      })[0]
    );
  } else {
    if (!db.get(req.params.sid)) return res.status(405).end();
    db.updateLastDownload(req.params.sid, db.get(req.params.sid)[0].key);
    res.sendFile(path.join(__dirname, '../public/html/upload.html'));
  }
});

app.use('/guest', protect, function(req, res, next) {
    if (req.method === 'GET') return res.status(405).end();

    if (req.method === 'POST') {

      var meta = JSON.parse(req.headers.metadata);
      meta.key = uuid();
      meta.createdAt = Date.now().toString();

      store.create(meta.sid+'++'+meta.key,{metadata:meta,size:0,offset:0,uploadLength:0},true);

      db.add(meta.sid, meta.key, {
        metadata: meta,
        size:0
      });

      return res.status(200).end();
    }
  }
);

app.use((req, res, next) => {
  res.status(404).send(errorPage.replace('%%ERROR%%', 'Download bucket not found.'));
});

module.exports = app;