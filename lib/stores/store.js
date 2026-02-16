'use strict';

/**
 * Abstract base class for storage backends
 * Defines the interface that all storage implementations must follow
 */
class Store {

  /**
   * Get the file identifier/path for storage
   * @param {string} fid - File identifier
   * @returns {string} Storage-specific file path or key
   */
  getFilename(fid) {
    throw new Error('getFilename() must be implemented by subclass');
  }

  /**
   * Create a new file upload
   * @param {string} fid - File identifier
   * @param {object} opts - Upload metadata
   * @returns {Promise<{uploadId: string}>} Upload information
   */
  async create(fid, opts = {}) {
    throw new Error('create() must be implemented by subclass');
  }

  /**
   * Update file metadata
   * @param {string} fid - File identifier
   * @param {object} data - Metadata to update
   * @returns {Promise<object>} Updated metadata
   */
  async update(fid, data) {
    throw new Error('update() must be implemented by subclass');
  }

  /**
   * Get file information including metadata and size
   * @param {string} fid - File identifier
   * @returns {Promise<object>} File info with size, offset, and metadata
   */
  async info(fid) {
    throw new Error('info() must be implemented by subclass');
  }

  /**
   * Append data to an existing file (resumable upload)
   * @param {string} fid - File identifier
   * @param {stream.Readable} readStream - Data stream to append
   * @param {number} offset - Byte offset to start appending at
   * @returns {Promise<{offset: number, upload: object}>} New offset and upload info
   */
  async append(fid, readStream, offset) {
    throw new Error('append() must be implemented by subclass');
  }

  /**
   * Create a read stream for downloading
   * @param {string} fid - File identifier
   * @param {number} start - Starting byte position
   * @param {number} end - Ending byte position
   * @param {function} cb - Callback with content length and metadata
   * @returns {stream.Readable} Read stream
   */
  createReadStream(fid, start, end, cb) {
    throw new Error('createReadStream() must be implemented by subclass');
  }

  /**
   * Delete a file and its metadata
   * @param {string} fid - File identifier
   * @returns {Promise<void>}
   */
  async del(fid) {
    throw new Error('del() must be implemented by subclass');
  }

  /**
   * Get the storage type identifier
   * @returns {string} Storage type ('filesystem' or 's3')
   */
  getType() {
    throw new Error('getType() must be implemented by subclass');
  }
}

module.exports = Store;
