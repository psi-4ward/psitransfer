// HEAD
//
// The Server MUST always include the Upload-Offset header in the
// response for a HEAD request, even if the offset is 0, or the upload
// is already considered completed. If the size of the upload is known,
// the Server MUST include the Upload-Length header in the response. If
// the resource is not found, the Server SHOULD return either the 404
// Not Found, 410 Gone or 403 Forbidden status without the Upload-Offset
// header.
//
// The Server MUST prevent the client and/or proxies from caching the
// response by adding the Cache-Control: no-store header to the
// response.
//

const encodeMetadata = require('../tus-metadata').encode;

module.exports = (store) => (
  async (req, res) => {
    res.set('Cache-Control', 'no-store')
    const { uploadId } = req.params
    const upload = await store.info(uploadId)
    // The Server MUST always include the Upload-Offset header in the
    // response for a HEAD request, even if the offset is 0, or the upload
    // is already considered completed.
    res.set('Upload-Offset', upload.offset)

    if (!('uploadLength' in upload)) {
      //  As long as the length of the upload is not known, the Server
      //  MUST set Upload-Defer-Length: 1 in all responses to HEAD requests.
      res.set('Upload-Defer-Length', '1')
    } else {
      // If the size of the upload is known, the Server MUST include
      // the Upload-Length header in the response
      res.set('Upload-Length', upload.uploadLength)
    }
    // If an upload contains additional metadata, responses to HEAD
    // requests MUST include the Upload-Metadata header and its value as
    // specified by the Client during the creation.
    const encodedMetadata = encodeMetadata(upload.metadata)
    if (encodedMetadata !== '') {
      res.set('Upload-Metadata', encodedMetadata)
    }
    res.end()
  }
)
