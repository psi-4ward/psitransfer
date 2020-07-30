'use strict';

module.exports = {
  "accessLog": 'dev',
  "retentions": {
    "one-time": "one time download",
    "60": "1 Minute",
    "300": "5 Minutes",
    "3600": "1 Hour"//,
    //"21600": "6 Hours",
    //"86400": "1 Day",
    //"259200": "3 Days",
    //"604800": "1 Week",
    //"1209600": "2 Weeks"
  },
  "defaultRetention": "300",
  "adminPass": "securedadmin",
  "autoPassword":false,
  "keycloak": { 
    "front": {
      "realm": "PsiTransfer",
      "auth-server-url": "https://192.168.5.4:8443/auth",
      "ssl-required": "external",
      "resource": "PsiTransfer_FrontEnd",
      "public-client": true,
      "confidential-port": 0
    },
    "back": {
      "realm": "PsiTransfer",
      "bearer-only": true,
      "auth-server-url": "https://192.168.5.4:8443/auth",
      "ssl-required": "external",
      "resource": "PsiTransfer_BackEnd",
      "confidential-port": 0
    }
  }
};