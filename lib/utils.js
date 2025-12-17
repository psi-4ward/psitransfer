const path = require('path');

// Control chars incl. NUL. Keep it strict and cross-platform.
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;

function toSafeBasename(input, fallback = 'file', opts = {}) {
  const maxLength = Number.isInteger(opts.maxLength) ? opts.maxLength : 255;

  let name = '';
  if (typeof input === 'string') name = input;
  else if (input == null) name = '';
  else name = String(input);

  // Remove NUL/control chars early (these can truncate paths in some tooling).
  name = name.replace(CONTROL_CHARS_RE, '');

  // Normalize separators to POSIX then force basename (flat archives).
  name = name.replace(/\\/g, '/');
  name = path.posix.basename(name);

  // Trim to avoid whitespace-only names; keep the caller’s original if they need strict equality.
  name = name.trim();

  // Disallow dot/dotdot and empty.
  if (!name || name === '.' || name === '..') name = '';

  // Length cap.
  if (name.length > maxLength) name = name.slice(0, maxLength);

  if (!name) {
    const fb = (fallback == null ? '' : String(fallback)).replace(CONTROL_CHARS_RE, '').trim();
    return fb ? fb.slice(0, maxLength) : 'file';
  }

  return name;
}

function isSafeBasename(name, opts = {}) {
  if (typeof name !== 'string') return false;
  return toSafeBasename(name, '', opts) === name;
}

module.exports = {
  toSafeBasename,
  isSafeBasename,
};


