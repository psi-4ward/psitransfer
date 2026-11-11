'use strict';
// Versioned static URLs, so browsers and CDNs can cache assets for a year.
//
// Pages link /app/~<v>/... and /assets/~<v>/..., where <v> hashes every file the two
// directories serve. Relative URLs inside them (fonts in a stylesheet, source maps) inherit
// the prefix, so they are versioned too. Any change to a file changes <v>.
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

const IMMUTABLE = 'public, max-age=31536000, immutable';

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p) : [p];
  });
}

function hashDirs(dirs) {
  const h = createHash('sha256');
  for (const dir of dirs) {
    for (const file of listFiles(dir).sort()) {
      h.update(path.relative(dir, file)).update('\0').update(fs.readFileSync(file)).update('\0');
    }
  }
  return h.digest('hex').slice(0, 12);
}

/**
 * Middleware for a static mount: strips a leading /~<version> segment. The current version
 * is served as immutable; an old one (a page cached before a deploy) gets the current file
 * without long caching, so a stale URL never pins new content.
 */
function versioned(version) {
  const prefix = `/~${ version }/`;
  return (req, res, next) => {
    if (req.url.startsWith(prefix)) {
      req.url = req.url.slice(prefix.length - 1);
      res.set('Cache-Control', IMMUTABLE);
    } else if (req.url.startsWith('/~')) {
      const i = req.url.indexOf('/', 2);
      req.url = i === -1 ? '/' : req.url.slice(i);
    }
    next();
  };
}

module.exports = { hashDirs, versioned, IMMUTABLE };
