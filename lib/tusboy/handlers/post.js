// Creation
//
// The Client and the Server SHOULD implement the upload creation
// extension. If the Server supports this extension, it MUST add creation
// to the Tus-Extension header.
//
// Headers
//
// Upload-Defer-Length
//
// The Upload-Defer-Length request and response header indicates that the
// size of the upload is not known currently and will be transferred later.
// Its value MUST be 1. If the length of an upload is not deferred, this
// header MUST be omitted.
//
// Upload-Metadata
//
// The Upload-Metadata request and response header MUST consist of one or
// more comma-separated key-value pairs. The key and value MUST be
// separated by a space. The key MUST NOT contain spaces and commas and
// MUST NOT be empty. The key SHOULD be ASCII encoded and the value MUST be
// Base64 encoded. All keys MUST be unique.
//
// Requests
//
// POST
//
// The Client MUST send a POST request against a known upload creation URL
// to request a new upload resource. The request MUST include one of the
// following headers:
//
// a) Upload-Length to indicate the size of an entire upload in bytes.
//
// b) Upload-Defer-Length: 1 if upload size is not known at the time. Once
// it is known the Client MUST set the Upload-Length header in the next
// PATCH request. Once set the length MUST NOT be changed. As long as the
// length of the upload is not known, the Server MUST set
// Upload-Defer-Length: 1 in all responses to HEAD requests.
//
// If the Server supports deferring length, it MUST add
// creation-defer-length to the Tus-Extension header.
//
// The Client MAY supply the Upload-Metadata header to add additional
// metadata to the upload creation request. The Server MAY decide to ignore
// or use this information to further process the request or to reject it.
// If an upload contains additional metadata, responses to HEAD requests
// MUST include the Upload-Metadata header and its value as specified by
// the Client during the creation.
//
// If the length of the upload exceeds the maximum, which MAY be specified
// using the Tus-Max-Size header, the Server MUST respond with the 413
// Request Entity Too Large status.
//
// The Server MUST acknowledge a successful upload creation with the 201
// Created status. The Server MUST set the Location header to the URL of
// the created resource. This URL MAY be absolute or relative.
//
// The Client MUST perform the actual upload using the core protocol.

const errors = require('../errors');

module.exports = (store, {
  getKey = () => {},
  maxUploadLength = Infinity,
}) => async (req, res, next) => {
  const tus = req.tus
  const { uploadLength } = tus
  const defer = !!tus.uploadDeferLength

  if (!defer && !('uploadLength' in tus)) {
    return next(errors.preconditionError(
      'Missing Upload-Length header'
    ))
  }
  // TODO: make sure store supports defer length
  if (defer && !store.supportsDeferredLength) {
    return next(errors.preconditionError(
      'Store does not support creation-defer-length extension'
    ))
  }
  if (defer && ('uploadLength' in tus)) {
    return next(errors.preconditionError(
      'Choose one of Upload-Length OR Upload-Defer-Length'
    ))
  }

  if ('uploadLength' in tus && uploadLength > maxUploadLength) {
    res.set('Tus-Max-Size', maxUploadLength)
    return next(errors.entityTooLarge(
      `Upload-length (${uploadLength}) exceeds max upload size (${maxUploadLength})`
    ), { maxUploadLength, uploadLength })
  }

  const key = await getKey(req)
  const metadata = req.tus.uploadMetadata
  const { uploadId } = await store.create(key, {
    uploadLength,
    metadata,
  })
  res.status(201)
  let basePath = req.baseUrl
  if (basePath[basePath.length - 1] !== '/') basePath += '/'
  res.set('Location', `${basePath}${uploadId}`)
  res.end()
}
