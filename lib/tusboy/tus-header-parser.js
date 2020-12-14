const toObject = require('to-object-reducer');
const decodeMetadata = require('./tus-metadata').decode;

// TODO: Buffer.from silently ignores invalid bytes :(
// https://github.com/nodejs/node/issues/8569
const base64decode = str => Buffer.from(str, 'base64')

const nonNegativeInteger = (v) => {
  // need this because parseInt parses floats too
  if (v !== '0' && !v.match(/^[1-9][0-9]*$/)) return
  const num = parseInt(v, 10)
  if (isNaN(num)) return
  if (num >= 0) return num
}

/*
const enum = (possibleVals = []) => (v) => {
  if (!possibleVals.includes(v)) return
  return v
}
*/

const id = v => v
const parsers = {
  'tus-resumable': id,
  // The Upload-Offset request and response header indicates a byte offset
  // within a resource. The value MUST be a non-negative integer.
  'upload-offset': nonNegativeInteger,
  // The Upload-Defer-Length request and response header indicates that the
  // size of the upload is not known currently and will be transferred later.
  // Its value MUST be 1. If the length of an upload is not deferred, this
  // header MUST be omitted.
  'upload-defer-length': v => {
    const num = nonNegativeInteger(v)
    if (num === 1) return 1
  },
  // The Upload-Length request and response header indicates the size of the
  // entire upload in bytes. The value MUST be a non-negative integer.
  'upload-length': nonNegativeInteger,
  'upload-metadata': decodeMetadata,
  // The Upload-Checksum request header contains information about the checksum
  // of the current body payload. The header MUST consist of the name of the
  // used checksum algorithm and the Base64 encoded checksum separated by a
  // space.
  'upload-checksum': v => {
    const parts = v.split(' ')
    if (parts.length !== 2) return
    const algorithm = parts[0]
    const checksum = base64decode(parts[1])
    if (!checksum.length) return
    return { algorithm, checksum }
  },
  // The Upload-Concat request and response header MUST be set in both partial
  // and final upload creation requests. It indicates whether the upload is
  // either a partial or final upload. If the upload is a partial one, the
  // header value MUST be partial. In the case of a final upload, its value
  // MUST be final followed by a semicolon and a space-separated list of
  // partial upload URLs that will be concatenated. The partial uploads URLs
  // MAY be absolute or relative and MUST NOT contain spaces as defined in RFC
  // 3986.
  'upload-concat': v => {
    if (v === 'partial') return { partial: true }
    const parts = v.split(';')
    if (!parts.length) return
    const firstPart = parts.shift()
    if (firstPart !== 'final') return
    const urls = parts.join(';').split(' ')
    if (urls.some(url => url === '')) return
    // validate urls? nah...
    return { final: true, urls }
  },
}

const knownHeaders = Object.keys(parsers)

const parseHeader = (tmpHeaderName, str) => {
  const headerName = tmpHeaderName.toLowerCase()
  if (!knownHeaders.includes(headerName)) return
  return parsers[headerName](str)
}

// Pre-computed for speed
const camelCase = {
  'tus-resumable': 'tusResumable',
  'upload-offset': 'uploadOffset',
  'upload-defer-length': 'uploadDeferLength',
  'upload-length': 'uploadLength',
  'upload-metadata': 'uploadMetadata',
  'upload-checksum': 'uploadChecksum',
  'upload-concat': 'uploadConcat',
}

const parseHeaders = (headers) => (
  Object
    .keys(headers)
    .filter(headerName => knownHeaders.includes(headerName))
    .map(headerName => ([
      camelCase[headerName],
      parsers[headerName](headers[headerName]),
    ]))
    .reduce(toObject, {})
)

module.exports = () => (req, res, next) => {
  req.tus = parseHeaders(req.headers)
  next()
};

module.exports.knownHeaders = knownHeaders;
module.exports.parseHeader = parseHeader;
module.exports.parseHeaders = parseHeaders;
