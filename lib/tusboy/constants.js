const HEADERS = [
  'Content-Type',
  'Location',
  'Tus-Extension',
  'Tus-Max-Size',
  'Tus-Resumable',
  'Tus-Version',
  'Upload-Defer-Length',
  'Upload-Length',
  'Upload-Metadata',
  'Upload-Offset',
  'X-HTTP-Method-Override',
  'X-Requested-With',
];

const MAX_AGE = 86400;
const ALLOWED_HEADERS = HEADERS;
const EXPOSED_HEADERS = HEADERS;

const ALLOWED_METHODS = [
  'POST',
  'HEAD',
  'PATCH',
  'OPTIONS',
];

const TUS_VERSION = '1.0.0';

module.exports = {
  MAX_AGE,
  ALLOWED_HEADERS,
  EXPOSED_HEADERS,
  ALLOWED_METHODS,
  TUS_VERSION,
}
