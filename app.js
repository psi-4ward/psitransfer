'use strict';
const config = require('./config');
const app = require('./lib/endpoints');
const https = require('https');
const fs = require('fs');
const Package = require('./package.json');

/**
 * Naming:
 * sid: Group of files
 * key: File
 * fid: {sid}++{key}
 */

let server;
if(config.port) {
  // HTTP Server
  server = app.listen(config.port, config.iface, () => {
    console.log(Package.name,Package.version,'build',Package.build,`listening on https://${config.iface}:${config.sslPort}`);
    if (config.keycloak.front) console.log(`Keycloak activated on ${config.keycloak.back["auth-server-url"]}realms/${config.keycloak.back["realm"]}`);
  });
}

let httpsServer;
if(config.sslPort && config.sslKeyFile && config.sslCertFile) {
  // HTTPS Server
  const sslOpts = {
    key: fs.readFileSync(config.sslKeyFile),
    cert: fs.readFileSync(config.sslCertFile)
  };
  httpsServer = https.createServer(sslOpts, app)
    .listen(config.sslPort, config.iface, () => {
      console.log(Package.name,Package.version,'build',Package.build,`listening on https://${config.iface}:${config.sslPort}`);
      if (config.keycloak.front) console.log(`Keycloak activated on ${config.keycloak.back["auth-server-url"]}realms/${config.keycloak.back["realm"]}`);
    });
}


// graceful shutdown
function shutdown() {
  console.log('PsiTransfer shutting down...');
  if(server) {
    server.close(() => {
      server = false;
      if(!server && !httpsServer) process.exit(0);
    });
  }
  if(httpsServer) {
    httpsServer.close(() => {
      httpsServer = false;
      if(!server && !httpsServer) process.exit(0);
    });
  }
  setTimeout(function() {
    console.log('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 60 * 1000);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
