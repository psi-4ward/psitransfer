# PsiTransfer

Simple open source self-hosted file sharing solution.  

* Supports many and very big files (Streams ftw)
* Resumable up- and downloads ([TUS](https://tus.io))
* Set an expire-time for your upload bucket
* One-time downloads
* Password protected downloads ([AES](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard))
* Requires Node >=7.4

![Screenshot](https://raw.githubusercontent.com/psi-4ward/psitransfer/master/docs/psitransfer.gif)

**Demo**: https://transfer.psi.cx

## Quickstart

### Docker (recommended)
```bash
$ docker run -p 0.0.0.0:3000:3000 -v $PWD/data:/data psitrax/psitransfer
# data volume needs UID 1000
$ sudo chown -R 1000 $PWD/data 
```

### Manual

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

## License

[BSD](LICENSE)

