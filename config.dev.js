module.exports = {
  "accessLog": 'dev',
  "retentions": {
    "one-time": "one time download",
    "60": "1 Minute",
    "300": "5 Minutes",
    "3600": "1 Hour",
    "21600": "6 Hours",
    "86400": "1 Day",
    "259200": "3 Days",
    "604800": "1 Week",
    "1209600": "2 Weeks"
  },
  "defaultRetention": "3600",
  "adminPass": "admin",
  "uploadPass": false,
  "baseUrl": '/',
  "uploadAppPath": '/',
  // "maxFileSize": Math.pow(2, 20) * 15,
  // "maxBucketSize": Math.pow(2, 20) * 20,
  "mailFrom": "PsiTransfer <psitransfer@psi.cx>"
  // "sslKeyFile": './tmp/cert.key',
  // "sslCertFile": './tmp/cert.pem',
};
