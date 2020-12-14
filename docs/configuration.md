# Configuration

First of all, I'll give an overview about the configuration options. See the 
[config.js](https://github.com/psi-4ward/psitransfer/blob/master/config.js#L5) for 
possible values. I do **not** recommend changing this file directly, better use one
of the following options.

## Config file: NODE_ENV related

PsiTransfer searches for an config file with the name `config.<NODE_ENV>.js` in the
root folder where `<NODE_ENV>` stands for the value of the environment parameter `NODE_ENV`.
If you start PsiTransfer using `npm start` it's `production` so you can create a
`config.production.js` with your settings. For example take a look at 
[config.dev.js](https://github.com/psi-4ward/psitransfer/blob/master/config.dev.js).
This file is used when starting the application with `npm run dev`.

You are completely free to introduce own configs like `config.custom.js` and start
the app with `NODE_ENV=custom node app.js`.

## Environment variables

Some Linux distributions have `/etc/default/<daemon>` or `/etc/sysconfig/<daemon>`
files with environment configurations. Moreover, it's common to 
configure the behaviour of Docker containers using environment parameters.

PsiTransfer supports overwriting every config value by environment parameters prefixed
with `PSITRANSFER_`.

```bash
export NODE_ENV=dev
export PSITRANSFER_RETENTIONS='{"one-time":"one time","3600":"1 Hour"}'
export PSITRANSFER_PORT=8080
node app.js
```

* The above example sets the `NODE_ENV` to `dev`.  
  If `config.dev.js` exists, it is loaded and overwrites the corresponding values from `config.js`.
* Then it will overwrite `retentions` and `port` with the values of the environment parameters.

> Environment parameters always have the highest priority.

## SSL

It's recommended to use Nginx for SSL termination, see [nginx-ssl-example.conf](https://github.com/psi-4ward/psitransfer/blob/master/docs/nginx-ssl-example.conf).

For native SSL support provide `sslPort`, `sslKeyFile`, `sslCertFile` options. To generate
a _snake oil_ certificate use `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout cert.key -out cert.pem`.

To disable HTTP set the `port` config value to `false`.

## WebHooks

For the sake of integrating PsiTransfer with other systems, PsiTransfer can notify a webhook with a POST request on the following events:

### fileUploaded

On completion of a file upload, if `fileUploadedWebhook` is set in `config.<NODE_ENV>.js`, PsiTransfer will make a POST request to that url.

At the time of writing, the POST body will contain a data structure resembling this (serialized as json):
```json
{
  "metadata": {
    "sid": "6055ab792b6c",
    "retention": 3600,
    "password": "file password is in plaintext here",
    "name": "test.png",
    "comment": "User individual file comment goes here",
    "type": "image/png",
    "key": "135a3814-df46-4e23-b061-03bdda13425c",
    "createdAt": 1589276618052
  },
  "date": 1589276619385
}
```

* Note: this event will fire many times if a user uploads multiple files in a single session (`sid`), as each individual file is uploaded separately. You'll notice that the `sid` will remain the same, but the `key` will change for each file. 
  * For file sync purposes (e.g. syncing client uploads to another service or long-term storage), you can reassemble a file fetch url with `https://<PSITRANSFER_HOST>/${sid}++${key}`

### fileDownloaded

When a user attempts to download a file, if `fileDownloadedWebhook` is set in `config.<NODE_ENV>.js`, PsiTransfer will make a POST request to that url.

At the time of writing, the POST body will contain a data structure resembling this (serialized as json):
```json
{
   "sid": "6055ab792b6c",
   "name": "test.png",
   "date": 1589276619415
}
```
