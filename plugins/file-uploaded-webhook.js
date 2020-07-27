const debug = require('debug')('psitransfer:plugin:file-uploaded-webook');
const axios = require('axios');

module.exports = function setupFileUploadedWebhook(eventBus, app, config, db) {
  debug('Setup plugin');
  if (!config.fileUploadedWebhook) {
    debug('No fileUploadedWebhook configured. Plugin disabled.');
    return;
  }

  function downloadWebook({ metadata }) {
    debug('Trigger: ' + config.fileUploadedWebhook);
    axios.post(config.fileUploadedWebhook, {
      metadata,
      date: Date.now()
    }).catch(err => console.error(err));
  }

  eventBus.on('fileUploaded', downloadWebook);
}
