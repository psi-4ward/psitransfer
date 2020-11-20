# PsiTransfer

[![Current Release](https://img.shields.io/github/release/psi-4ward/psitransfer.svg)](https://github.com/psi-4ward/psitransfer/releases)
[![Dependencies](https://david-dm.org/psi-4ward/psitransfer.svg)](https://david-dm.org/psi-4ward/psitransfer)
[![Known Vulnerabilities](https://snyk.io/test/github/psi-4ward/psitransfer/badge.svg)](https://snyk.io/test/github/psi-4ward/psitransfer)
[![Github Stars](https://img.shields.io/github/stars/psi-4ward/psitransfer.svg?style=social&label=Star)](https://github.com/psi-4ward/psitransfer)
[![Docker Stars](https://img.shields.io/docker/stars/psitrax/psitransfer.svg)](https://hub.docker.com/r/psitrax/psitransfer/)
[![Image Size](https://images.microbadger.com/badges/image/psitrax/psitransfer.svg)](https://microbadger.com/images/psitrax/psitransfer)
[![Docker Pulls](https://img.shields.io/docker/pulls/psitrax/psitransfer.svg)](https://hub.docker.com/r/psitrax/psitransfer/)
[![Docker Automated buil](https://img.shields.io/docker/automated/psitrax/psitransfer.svg)](https://hub.docker.com/r/psitrax/psitransfer/)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=RTWDCH74TJN54&item_name=psitransfer)

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
* `/admin` Page lists bucket information, [Screenshot](https://raw.githubusercontent.com/psi-4ward/psitransfer/master/docs/PsiTransfer-Admin.png) (_disabled until you set `adminPass` config value_)
* Lightweight [Vue](https://vuejs.org) based frontend apps. Gzipped (on by default) less than 100k
* Explicit named bucket IDs with query param `sid=<myBucketID>`

**See the blog posts about PsiTransfer: https://psi.cx/tags/PsiTransfer/ and checkout the
[Documentation](https://github.com/psi-4ward/psitransfer/tree/master/docs)**

![Screenshot](https://raw.githubusercontent.com/psi-4ward/psitransfer/master/docs/psitransfer.gif)


## Quickstart

### Docker
```bash
$ docker run -p 0.0.0.0:3000:3000 -e PSITRANSFER_ADMIN_PASS=secret -v $PWD/data:/data psitrax/psitransfer
# data volume needs UID 1000
$ sudo chown -R 1000 $PWD/data
```

Specify the version by using [image tags](https://hub.docker.com/r/psitrax/psitransfer/tags/) e.g.:
* `latest`: corresponds to master branch
* `2`: latest stable `2.x.x`
* `1.1`: latest stable `1.1.x`
* `1.0.0`: exact version

### Manual, precompiled

```bash
# Be sure to have NodeJS >= 12
$ node -v
v12.4.0

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
* Define environment Variables like `PSITRANSFER_UPLOAD_DIR` to set the upload directory
* To secure your PsiTransfer if exposed to the internet from unwanted, non authorized uploads use the `PSITRANSFER_UPLOAD_PASS` environment variable

### Customization

`public/pug/upload.pug` and `download.pug` are kept simple.
You can alter these files and add your logo and styles.
Please keep a footnote like *Powered by PsiTransfer* :)

### Debug

Psitransfer uses [debug](https://github.com/visionmedia/debug):

```bash
DEBUG=psitransfer:* npm start
```

## Side notes

* **There is no (end-to-end) payload encryption (yet)**.
* `Download all as ZIP` does not support resuming the download.

:star2: Contribution is highly welcome :metal:

Want to say thanks and buy me a beer? [![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=RTWDCH74TJN54&item_name=psitransfer)


## License

[BSD](LICENSE)
