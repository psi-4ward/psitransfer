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
