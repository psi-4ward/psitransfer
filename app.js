'use strict';
const config = require('./config');
const app = require('./lib/endpoints');

/**
 * Naming:
 * sid: Group of files
 * key: File
 * fid: {sid}++{key}
 */

const server = app.listen(config.port, config.iface, () => {
  console.log(`PsiTransfer listening on http://${config.iface}:${config.port}`);
});


// graceful shutdown
function shutdown() {
  console.log('PsiTransfer shutting down...');
  server.close(() => {
    process.exit(0);
  });
  setTimeout(function() {
    console.log('Could not close connections in time, forcefully shutting down');
    process.exit(0);
  }, 180 * 1000);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
