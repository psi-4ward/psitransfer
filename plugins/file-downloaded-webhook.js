const debug = require('debug')('psitransfer:plugin:file-downloaded-webook');
const axios = require('axios');

module.exports = function setupFileDownloadedWebhook(eventBus, app, config, db) {
  debug('Setup plugin');

  if (!config.fileDownloadedWebhook) {
    debug('No fileDownloadedWebhook configured. Plugin disabled.');
    return;
  }

  function downloadWebook({ sid, file }) {
    debug('Trigger: ' + config.fileDownloadedWebhook);
    axios.post(config.fileDownloadedWebhook, {
      fid: sid,
      file,
      date: Date.now()
    }).catch(err => console.error(err));
  }

  eventBus.on('archiveDownloaded', downloadWebook);
  eventBus.on('fileDownloaded', downloadWebook);
}
