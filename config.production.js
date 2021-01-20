const path = require('path');

module.exports = {
  "uploadDir": path.resolve(__dirname + '/data'),
  // set to serve PsiTransfer from a sub-path
  "baseUrl": '/',
  // use to set custom upload url
  "uploadAppPath": '/',
  "iface": '0.0.0.0',
  // set to false to disable HTTP
  "port": 8000,
  // HTTPS, set all 3 values to enable
  "sslPort": false,
  "sslKeyFile": false,
  "sslCertFile": false,
  // Force redirect to https
  // can be true or a specific url like https://example.com:8443
  // keep empty to disable
  "forceHttps": '',
  // retention options in seconds:label
  "retentions": {
    "one-time": "One time download",
    "3600": "1 Hour",
    "21600": "12 Hours",
    "86400": "1 Day",
    "259200": "3 Days",
    "604800": "1 Week",
    "1209600": "2 Weeks",
    "2678400": "1 Month",
    "7889400": "3 Months",
    "15778800": "6 Months",
    "31557600": "1 Year"
  },
  // admin password, set to false to disable /admin page
  "adminPass": "cP8EA|F4Th;{62$",
  // upload password, set to false to disable
  "uploadPass": false,
  // make the bucket-password field mandatory
  "requireBucketPassword": false,
  "defaultRetention": "604800",
  // expire every file after maxAge (eg never downloaded one-time files)
  //"maxAge": 3600*24*75, // 75 days
  // maximum file-size for previews in byte
  "maxPreviewSize": 1000000 * 500, // 500MB
  "mailTemplate": 'mailto:?subject=Your Focal Upload Download Link&body=Access the file bucket stored at Focal Upload with this link: %%URL%%',
  // see https://github.com/expressjs/morgan
  // set to false to disable logging
  "accessLog": ':date[iso] :method :url :status :response-time :remote-addr',
  // event webhooks
  // invokes an HTTP POST to a url whenever a file is downloaded
  // for more info, see the webhooks section of docs/configuration.md
  "fileDownloadedWebhook": null,
  "fileUploadedWebhook": "http://localhost:8000/uploaded/",
  // Fallback language
  "defaultLanguage": "en",
  // Limit upload size
  "maxFileSize": 1000000000  * 10, // 10GB
  "maxBucketSize": 1000000000 * 10, // 10GB
  "plugins": ['file-downloaded-webhook', 'file-uploaded-webhook'],
};
