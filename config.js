'use strict';
const path = require('path');
const fsp = require('fs-promise');

// Default Config
// Do not edit this, generate a config.<ENV>.js for your NODE_ENV
// or use ENV-VARS like PSITRANSFER_PORT=8000
const config =  {
  uploadDir: path.resolve(__dirname + '/data'),
  port: 3000,
  iface: '0.0.0.0',
  // retention options in seconds:label; first one is the default
  retentions: {
    "one-time": "one time download",
    3600: "1 Hour",
    21600: "6 Hours",
    86400: "1 Day",
    259200: "3 Days",
    604800: "1 Week",
    1209600: "2 Weeks",
    2419200: "4 Weeks",
    4838400: "8 Weeks"
  },
  defaultRetention: 604800,
  // maximum file-size for previews in byte
  maxPreviewSize: Math.pow(2,20) * 2, // 2MB
  mailTemplate: 'mailto:?subject=File Transfer&body=You can download the files here: %%URL%%',
  // see https://github.com/expressjs/morgan
  // set to false to disable logging
  accessLog: ':date[iso] :method :url :status :response-time :remote-addr'
};


// Load NODE_ENV specific config
const envConfFile = path.resolve(__dirname, `config.${process.env.NODE_ENV}.js`);
if(process.env.NODE_ENV && fsp.existsSync(envConfFile)) {
  Object.assign(config, require(envConfFile));
}

// Load config from ENV VARS
let envName;
for (let k in config) {
  envName = 'PSITRANSFER_'+ k.replace(/([A-Z])/g, $1 => "_" + $1).toUpperCase();
  if(process.env[envName]) {
    if(typeof config[k] === 'number') {
      config[k] = parseInt(process.env[envName], 10);
    } else {
      config[k] = process.env[envName];
    }
  }
}

module.exports = config;
