// PATCH
//
// The Server SHOULD accept PATCH requests against any upload URL and
// apply the bytes contained in the message at the given offset
// specified by the Upload-Offset header. All PATCH requests MUST use
// Content-Type: application/offset+octet-stream.
//
// The Upload-Offset header’s value MUST be equal to the current offset
// of the resource. In order to achieve parallel upload the
// Concatenation extension MAY be used. If the offsets do not match, the
// Server MUST respond with the 409 Conflict status without modifying
// the upload resource.
//
// The Client SHOULD send all the remaining bytes of an upload in a
// single PATCH request, but MAY also use multiple small requests
// successively for scenarios where this is desirable, for example, if
// the Checksum extension is used.
//
// The Server MUST acknowledge successful PATCH requests with the 204 No
// Content status. It MUST include the Upload-Offset header containing
// the new offset. The new offset MUST be the sum of the offset before
// the PATCH request and the number of bytes received and processed or
// stored during the current PATCH request.
//
// Both, Client and Server, SHOULD attempt to detect and handle network
// errors predictably. They MAY do so by checking for read/write socket
// errors, as well as setting read/write timeouts. A timeout SHOULD be
// handled by closing the underlying connection.
//
// The Server SHOULD always attempt to store as much of the received
// data as possible.
const storeErrors = require('../store/errors');
const errors = require('../errors');

module.exports = (store, {
  onComplete,
  beforeComplete = async () => {},
  afterComplete = async () => {},
}) => (async (req, res) => {
  const after = onComplete || afterComplete

  // The request MUST include a Upload-Offset header
  if (!('uploadOffset' in req.tus)) {
    throw errors.missingHeader('upload-offset')
  }

  // The request MUST include a Content-Type header
  if (typeof req.get('content-type') === 'undefined') {
    throw errors.missingHeader('content-type')
  }

  // All PATCH requests MUST use Content-Type: application/offset+octet-stream
  if (req.get('content-type') !== 'application/offset+octet-stream') {
    throw errors.invalidHeader('content-type', req.get('content-type'))
  }

  const uploadId = req.params.uploadId

  try {
    const {
      offset,
      upload,
    } = await store.append(uploadId, req, req.tus.uploadOffset, {
      beforeComplete: (...args) => beforeComplete(req, ...args),
      uploadLength: req.tus.uploadLength,
    })
    if (upload && upload.uploadLength === offset) {
      await after(req, upload, uploadId)
    }
    //  It MUST include the Upload-Offset header containing the new offset.
    res.set('Upload-Offset', offset)
    // The Server MUST acknowledge successful PATCH requests
    // with the 204 No Content status.
    res.status(204)
    res.end()
  } catch (err) {
    if (err instanceof storeErrors.OffsetMismatch) {
      throw errors.offsetMismatch()
    }
    throw err
  }
})
