# PsiTransfer

[![Current Release](https://img.shields.io/github/release/psi-4ward/psitransfer.svg)](https://github.com/psi-4ward/psitransfer/releases)
[![Dependencies](https://david-dm.org/psi-4ward/psitransfer.svg)](https://david-dm.org/psi-4ward/psitransfer)
[![Github Stars](https://img.shields.io/github/stars/psi-4ward/psitransfer.svg?style=social&label=Star)](https://github.com/psi-4ward/psitransfer)
[![Docker Stars](https://img.shields.io/docker/stars/psitrax/psitransfer.svg)](https://hub.docker.com/r/psitrax/psitransfer/)
[![Image Size](https://images.microbadger.com/badges/image/psitrax/psitransfer.svg)](https://microbadger.com/images/psitrax/psitransfer)
[![Docker Pulls](https://img.shields.io/docker/pulls/psitrax/psitransfer.svg)](https://hub.docker.com/r/psitrax/psitransfer/)
[![Docker Automated buil](https://img.shields.io/docker/automated/psitrax/psitransfer.svg)](https://hub.docker.com/r/psitrax/psitransfer/)

Simple open source self-hosted file sharing solution.  
It's an alternative to paid services like Dropbox, WeTransfer.

* No accounts, no logins
* Mobile friendly responsive interface
* Supports many and very big files (Streams ftw)
* Resumable up- and downloads ([tus.io](https://tus.io))
* Set an expire-time for your upload bucket
* One-time downloads
* Download all files as zip/tar.gz archive
* Modal-style file preview
* Requires Node >=7.4 or use `--harmony-async-await` flag
* Password protected download list ([AES](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard))  

![Screenshot](https://raw.githubusercontent.com/psi-4ward/psitransfer/master/docs/psitransfer.gif)

**Demo**: https://transfer.psi.cx

## Quickstart

### Docker
```bash
$ docker run -p 0.0.0.0:3000:3000 -v $PWD/data:/data psitrax/psitransfer
# data volume needs UID 1000
$ sudo chown -R 1000 $PWD/data 
```

### Manual, precompiled

```bash
# Be sure to have NodeJS >= 7.4
$ node -v
v7.4.0

# Download and extract latest release package from
# https://github.com/psi-4ward/psitransfer/releases

# Install dependencies and start the app
$ NODE_ENV=production npm install
$ npm start
```

### Manual, from source

```bash
# Compile the frontend apps
$ cd app
$ npm install
$ npm run build

# Install dependencies
$ cd ..
$ npm install
$ npm start
```

### Configuration

There are some configs in `config.js` like port and data-dir.  
You can:
* Edit the `config.js` **(not recommend)**
* Add a `config.production.js` where `production` is the value from `NODE_ENV`  
  See `config.dev.js`
* Define environment Variables like `PSITRANSFER_UPLOAD_DIR`

### Customization

`public/upload.html` and `download.html` are kept simple.  
You can alter these files and add your logo and styles.  
The following elements are mandatory:  
`common.js` and respectively `upload.js`, `download.js` as well as `<div id="upload">`, `<div id="download">`  
Please keep a footnote like *Powered by PsiTransfer* :)

### Debug

Psitransfer uses [debug](https://github.com/visionmedia/debug):

```bash
DEBUG=psitransfer:* npm start
```

## Side notes

* There is no (end-to-end) payload encryption (yet).
* `Download all as ZIP` does not support resuming the download.

:star2: Contribution is highly welcome :metal:

## License

[BSD](LICENSE)
