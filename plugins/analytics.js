// Aggregate, privacy-safe transfer analytics.
// Counts total bytes/files uploaded and downloaded. No per-user, per-IP or
// per-file data is stored - only running totals - so it is safe to expose
// publicly and is consistent with the zero-retention policy.
const fs = require('fs');
const path = require('path');
const debug = require('debug')('psitransfer:plugin:analytics');

module.exports = function setupAnalytics(eventBus, app, config, db) {
  debug('Setup plugin');

  const statsFile = path.join(config.uploadDir, '.analytics.json');
  const stats = {
    uploadedBytes: 0,
    uploadedFiles: 0,
    downloadedBytes: 0,
    downloadedFiles: 0,
    since: Date.now(),
  };

  // load any persisted totals
  try {
    if (fs.existsSync(statsFile)) {
      Object.assign(stats, JSON.parse(fs.readFileSync(statsFile, 'utf8')));
    }
  } catch (e) {
    console.error('analytics: could not read stats file', e);
  }

  // debounced persist so we don't hammer the disk on bursts
  let saveTimer = null;
  function persist() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      fs.writeFile(statsFile, JSON.stringify(stats), err => {
        if (err) console.error('analytics: could not write stats file', err);
      });
    }, 2000);
  }

  function toBytes(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  eventBus.on('fileUploaded', upload => {
    stats.uploadedBytes += toBytes(upload && upload.size);
    stats.uploadedFiles += 1;
    persist();
  });

  eventBus.on('fileDownloaded', d => {
    stats.downloadedBytes += toBytes(d && d.size);
    stats.downloadedFiles += 1;
    persist();
  });

  eventBus.on('archiveDownloaded', a => {
    const bucket = (a && a.bucket) || [];
    const bytes = bucket.reduce((sum, f) => sum + toBytes(f && f.size), 0);
    stats.downloadedBytes += bytes;
    stats.downloadedFiles += bucket.length || 1;
    persist();
  });

  if (config.publicStats !== false) {
    app.get(`${ config.baseUrl }stats.json`, (req, res) => {
      res.set('Cache-Control', 'no-store');
      res.json({
        uploadedBytes: stats.uploadedBytes,
        uploadedFiles: stats.uploadedFiles,
        downloadedBytes: stats.downloadedBytes,
        downloadedFiles: stats.downloadedFiles,
        totalBytes: stats.uploadedBytes + stats.downloadedBytes,
        totalFiles: stats.uploadedFiles + stats.downloadedFiles,
        since: stats.since,
        now: Date.now(),
      });
    });
    debug(`Public stats at ${ config.baseUrl }stats.json`);
  }
};
