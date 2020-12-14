const createError = require('http-errors');

const tusResumableHeaderMissing = () => createError(412, 'Tus-Resumable Required')

const invalidHeaders = (headers) => (
  createError(412, 'Precondition Failed', {
    details: { headers },
  })
)

const invalidHeader = (header, val) => (
  createError(412, 'Precondition Failed', {
    details: { headers: [[header, val]] },
  })
)

const missingHeader = (header) => invalidHeader(header)

const entityTooLarge = (msg, props) => createError(413, msg, props)

const preconditionError = (msg, props) => createError(412, msg, props)

const offsetMismatch = (actual, expected) => (
  createError(409, `Offset mismatch, got ${actual} but expected ${expected}`)
)

// For store implementations:
const unknownResource = (key) => (
  createError(404, `Unknown resource: ${key}`)
)

const concurrentWrite = () => (
  createError(409, 'Concurrent write detected')
)

const uploadLengthAlreadySet = () => (
  createError(409, 'Upload length is already set')
)

module.exports = {
  tusResumableHeaderMissing,
  invalidHeaders,
  invalidHeader,
  missingHeader,
  entityTooLarge,
  preconditionError,
  offsetMismatch,
  unknownResource,
  concurrentWrite,
  uploadLengthAlreadySet,
}
