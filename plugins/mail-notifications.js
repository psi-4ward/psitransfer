const debug = require('debug')('psitransfer:plugin:mail-notifications');
const nodemailer = require("nodemailer");
const assert = require('assert');
const fsp = require('fs').promises;
const path = require('path');

module.exports = function setupMailNotifications(eventBus, app, config, db) {
  debug('Setup plugin');
  if (!config.mailer) return;

  const mailer = nodemailer.createTransport(config.mailer);

  app.post(`${ config.baseUrl }send-mail`, async (req, res) => {
    let { to, from, message, downloadNotifications, sid, lang, shareLink } = req.body;
    if (!message) message = '';
    try {
      assert(to && to.match(/\w@\w/), 'To address looks not like a regular e-mail');
      assert(from && from.match(/\w@\w/), 'From address looks not like a regular e-mail');
      assert(typeof downloadNotifications === 'boolean', "downloadNotifications property is not a boolean");
      assert(sid && sid.length > 3, 'sid property is mandatory');
      assert(shareLink && shareLink.length > 3, 'shareLink property is mandatory');
      assert(lang && lang.length, 'lang property is mandatory');
    }
    catch (e) {
      return res.status(400).send(`Validation error: ${ e.message }`);
    }

    const bucket = db.get(sid);
    const bucketSize = db.bucketSize(sid);
    if (!bucket || bucketSize <= 0) {
      return res.status(400).send('Bad request');
    }
    const filesCount = bucket.length;
    const { retention, createdAt } = bucket[0].metadata;
    const validUntilDate = (new Date(+createdAt + +retention * 1000).toLocaleString(lang));

    const fillTemplate = function(tpl) {
      return new Function("return `" + tpl + "`;").call({
        to, from, message, bucketSize, filesCount, validUntilDate, shareLink
      });
    }

    const uploaderTpl_txt = await fsp.readFile(path.resolve(__dirname, `mail-sender/${ lang }_uploader.txt`), 'utf8');
    const downloaderTpl_txt = await fsp.readFile(path.resolve(__dirname, `mail-sender/${ lang }_downloader.txt`), 'utf8');

    // TODO: HTML Templates

    if (downloadNotifications) {
      bucket.forEach(file => {
        const { key } = file.metadata;
        db.updateMetadata(sid, key, {
          downloadNotifications: true,
          mailOpts: { to, from, message, lang }
        })
      });
    }

    try {
      await mailer.sendMail({
        from: config.mailFrom,
        to,
        replyTo: from,
        subject: config.languages[lang].mailSubjectDownloader,
        text: fillTemplate(downloaderTpl_txt),
        // html: "<b>Hello world?</b>", // html body
      });
      await mailer.sendMail({
        from: config.mailFrom,
        to: from,
        subject: config.languages[lang].mailSubjectUploader,
        text: fillTemplate(uploaderTpl_txt),
        // html: "<b>Hello world?</b>", // html body
      });
    }
    catch (e) {
      console.error(`Error sending mails: ${ e.message }`);
      return res.status(500).send('Error sending mails.');
    }

    return res.json('OK');
  });


  async function downloadNotificationHandler({ file, metadata }) {
    try {
      if (!metadata.downloadNotifications) return;
      let { to, from, lang } = metadata.mailOpts;
      await mailer.sendMail({
        from: config.mailFrom,
        to: from,
        subject: config.languages[lang].mailSubjectFileDownloaded,
        text: file,
        // html: "<b>Hello world?</b>", // html body
      });
    } catch (e) {
      console.error(`Error sending mail: ${ e.message }`);
    }
  }
  eventBus.on('archiveDownloaded', downloadNotificationHandler);
  eventBus.on('fileDownloaded', downloadNotificationHandler);
}
