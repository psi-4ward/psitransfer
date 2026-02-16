'use strict';
const {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const debug = require('debug')('psitransfer:store:s3');
const httpErrors = require('http-errors');
const Store = require('./store');
const { Readable } = require('stream');

/**
 * S3-based storage implementation
 * Stores files and metadata in AWS S3 with signed URL support
 */
class S3Store extends Store {

  constructor(config) {
    super();
    this.bucket = config.bucket;
    this.region = config.region;
    this.signedUrlExpiry = config.signedUrlExpiry || 3600;
    this.s3PartSize = 5 * 1024 * 1024; // 5MB minimum S3 part size

    debug(`Initializing S3Store with bucket: ${this.bucket}, region: ${this.region}`);
    debug(`Credentials present: ${!!config.credentials}`);
    debug(`Endpoint: ${config.endpoint || 'default AWS'}`);

    // Initialize S3 client
    const s3Config = {
      region: this.region,
      credentials: config.credentials, // Optional: if not provided, SDK uses default credential chain
    };

    // Add endpoint and forcePathStyle for LocalStack/MinIO compatibility
    if (config.endpoint) {
      s3Config.endpoint = config.endpoint;
      s3Config.forcePathStyle = true; // Required for LocalStack and other S3-compatible services
      debug(`Using custom S3 endpoint: ${config.endpoint} with forcePathStyle`);
    }

    this.s3Client = new S3Client(s3Config);

    // In-memory buffers for accumulating TUS chunks before uploading to S3
    // Maps uploadId -> Buffer
    this.uploadBuffers = new Map();

    debug(`Initialized S3Store with bucket: ${this.bucket}, region: ${this.region}`);
  }

  getType() {
    return 's3';
  }

  getFilename(fid) {
    // S3 key format: {sid}/{uuid}
    return fid.replace('++', '/');
  }

  /**
   * Get S3 key for metadata file
   */
  getMetadataKey(fid) {
    return this.getFilename(fid) + '.json';
  }

  async create(fid, opts = {}) {
    const key = this.getFilename(fid);
    debug(`Creating new S3 upload: ${key}`);

    try {
      // Start S3 multipart upload
      // Note: S3 metadata values must be ASCII-only, so encode non-ASCII characters
      const multipartCommand = new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        Metadata: {
          'original-filename': encodeURIComponent(opts.metadata?.name || ''),
          'content-type': opts.metadata?.type || 'application/octet-stream',
        },
      });

      const multipartResponse = await this.s3Client.send(multipartCommand);

      // Store metadata with S3 upload information
      const metadata = {
        ...opts,
        isPartial: true,
        s3UploadId: multipartResponse.UploadId,
        offset: 0,
        partNumber: 1,
        parts: [], // Array of {PartNumber, ETag}
      };

      // Save metadata as separate S3 object
      await this._saveMetadata(fid, metadata);

      debug(`Created S3 multipart upload: ${multipartResponse.UploadId}`);
      return { uploadId: fid };
    } catch (error) {
      debug(`Error creating S3 upload: ${error.message}`);
      throw error;
    }
  }

  async update(fid, data) {
    debug(`Updating metadata for: ${this.getFilename(fid)}`);
    await this._saveMetadata(fid, data);
    return data;
  }

  async info(fid) {
    const key = this.getFilename(fid);
    debug(`Fetching info for: ${key}`);

    try {
      // Get metadata from JSON file
      const metadata = await this._getMetadata(fid);

      // If upload is complete, get actual file size from S3
      if (!metadata.isPartial) {
        try {
          const headCommand = new HeadObjectCommand({
            Bucket: this.bucket,
            Key: key,
          });
          const headResponse = await this.s3Client.send(headCommand);
          metadata.size = headResponse.ContentLength;
          metadata.offset = headResponse.ContentLength;
        } catch (error) {
          // File might not exist yet if upload just started
          if (error.name !== 'NotFound') {
            throw error;
          }
        }
      } else {
        // For partial uploads, size is current offset
        metadata.size = metadata.offset || 0;
      }

      debug(`Fetched info for: ${key}, size: ${metadata.size}`);
      return metadata;
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.name === 'NotFound') {
        throw httpErrors.NotFound();
      }
      throw error;
    }
  }

  async append(fid, readStream, tusOffset) {
    const key = this.getFilename(fid);
    debug(`Appending data to: ${key} at offset: ${tusOffset}`);

    try {
      // Get current metadata
      const metadata = await this._getMetadata(fid);

      // Validate TUS offset matches
      if (metadata.offset !== tusOffset) {
        debug(`Offset mismatch: expected ${metadata.offset}, got ${tusOffset}`);
        throw httpErrors.Conflict('Offset mismatch');
      }

      // Get or create buffer for this upload
      let buffer = this.uploadBuffers.get(fid) || Buffer.alloc(0);
      let bytesReceived = 0;

      // Collect incoming chunks
      for await (const chunk of readStream) {
        buffer = Buffer.concat([buffer, chunk]);
        bytesReceived += chunk.length;
      }

      // After receiving all chunks, check if this completes the upload
      // Use buffer.length (not bytesReceived) to account for data buffered from previous append
      const isLastChunk = metadata.uploadLength &&
                         (metadata.offset + buffer.length >= metadata.uploadLength);

      debug(`Buffer state: ${buffer.length} bytes, isLastChunk: ${isLastChunk}, offset: ${metadata.offset}, bytesReceived: ${bytesReceived}, uploadLength: ${metadata.uploadLength}`);

      // Upload parts when buffer reaches 5MB or this is the final chunk
      while (buffer.length >= this.s3PartSize || (isLastChunk && buffer.length > 0)) {
        // Calculate remaining bytes to upload (don't exceed uploadLength)
        const remainingBytes = metadata.uploadLength ? metadata.uploadLength - metadata.offset : Infinity;
        const maxPartSize = Math.min(buffer.length, remainingBytes);

        const isLastPart = isLastChunk && maxPartSize <= this.s3PartSize;
        const partSize = isLastPart ? maxPartSize : Math.min(this.s3PartSize, maxPartSize);
        const partData = buffer.slice(0, partSize);
        buffer = buffer.slice(partSize);

        debug(`Uploading part ${metadata.partNumber}, size: ${partSize}, isLastPart: ${isLastPart}, remaining buffer: ${buffer.length}`);

        // Upload part to S3
        const uploadPartCommand = new UploadPartCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: metadata.s3UploadId,
          PartNumber: metadata.partNumber,
          Body: partData,
        });

        const partResponse = await this.s3Client.send(uploadPartCommand);

        metadata.parts.push({
          PartNumber: metadata.partNumber,
          ETag: partResponse.ETag,
        });
        metadata.partNumber++;
        metadata.offset += partSize;

        // If this was the last part, complete the multipart upload
        if (isLastPart) {
          debug(`Completing multipart upload: ${metadata.s3UploadId}`);

          await this.s3Client.send(new CompleteMultipartUploadCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: metadata.s3UploadId,
            MultipartUpload: { Parts: metadata.parts },
          }));

          // Mark upload as complete
          delete metadata.isPartial;
          this.uploadBuffers.delete(fid);

          debug(`Completed multipart upload: ${metadata.s3UploadId}`);

          // Upload is complete, discard any remaining buffer
          buffer = Buffer.alloc(0);
          break;
        }
      }

      // Store remaining buffer for next chunk (only if upload not complete)
      if (buffer.length > 0 && metadata.isPartial !== undefined) {
        this.uploadBuffers.set(fid, buffer);
      } else if (!metadata.isPartial) {
        // Upload complete, clean up buffer
        this.uploadBuffers.delete(fid);
      }

      // Save updated metadata
      await this._saveMetadata(fid, metadata);

      debug(`Appended data to: ${key}, new offset: ${metadata.offset}`);
      return { offset: metadata.offset, upload: metadata };
    } catch (error) {
      debug(`Error appending to S3: ${error.message}`);

      // Abort multipart upload on error
      const metadata = await this._getMetadata(fid).catch(() => null);
      if (metadata?.s3UploadId) {
        try {
          await this.s3Client.send(new AbortMultipartUploadCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: metadata.s3UploadId,
          }));
          debug(`Aborted multipart upload: ${metadata.s3UploadId}`);
        } catch (abortError) {
          debug(`Error aborting multipart upload: ${abortError.message}`);
        }
      }

      this.uploadBuffers.delete(fid);
      throw error;
    }
  }

  createReadStream(fid, start, end, cb) {
    const key = this.getFilename(fid);
    debug(`Creating read stream for: ${key}, range: ${start}-${end}`);

    // Create async stream
    const stream = new Readable({
      read() {} // No-op, we'll push data manually
    });

    // Fetch file info and stream data
    (async () => {
      try {
        const info = await this.info(fid);

        let contentLength = info.size;
        if (start > 0) {
          if (!end) end = info.size - 1;
          contentLength = end - start + 1;
        }

        // Call callback with metadata
        if (cb) {
          cb({ contentLength, metadata: info.metadata, info });
        }

        // Create S3 GetObject command with Range
        const getCommand = new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: start || end ? `bytes=${start || 0}-${end || ''}` : undefined,
        });

        const response = await this.s3Client.send(getCommand);

        // Pipe S3 stream to our readable stream
        response.Body.on('data', chunk => stream.push(chunk));
        response.Body.on('end', () => stream.push(null));
        response.Body.on('error', err => stream.destroy(err));

      } catch (error) {
        stream.destroy(error);
      }
    })();

    return stream;
  }

  async del(fid) {
    const key = this.getFilename(fid);
    const metadataKey = this.getMetadataKey(fid);
    debug(`Deleting: ${key}`);

    try {
      // Delete metadata file
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: metadataKey,
      }));
    } catch (error) {
      if (error.name !== 'NoSuchKey') {
        debug(`Error deleting metadata: ${error.message}`);
      }
    }

    try {
      // Delete actual file
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      debug(`Deleted: ${key}`);
    } catch (error) {
      if (error.name !== 'NoSuchKey') {
        throw error;
      }
    }

    // Clean up any lingering buffer
    this.uploadBuffers.delete(fid);
  }

  /**
   * Generate a presigned URL for downloading a file
   * @param {string} fid - File identifier
   * @param {object} options - Options for signed URL
   * @returns {Promise<string>} Presigned URL
   */
  async getSignedDownloadUrl(fid, options = {}) {
    const key = this.getFilename(fid);
    const info = await this.info(fid);

    debug(`Generating signed URL for: ${key}`);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: options.responseContentDisposition ||
        `attachment; filename="${options.filename || info.metadata?.name || 'download'}"`,
      ResponseContentType: info.metadata?.type || 'application/octet-stream',
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: options.expiresIn || this.signedUrlExpiry,
    });

    debug(`Generated signed URL (expires in ${options.expiresIn || this.signedUrlExpiry}s)`);
    return signedUrl;
  }

  /**
   * Save metadata to S3 as JSON object
   */
  async _saveMetadata(fid, metadata) {
    const metadataKey = this.getMetadataKey(fid);

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: metadataKey,
      Body: JSON.stringify(metadata, null, 2),
      ContentType: 'application/json',
    }));
  }

  /**
   * Get metadata from S3 JSON object
   */
  async _getMetadata(fid) {
    const metadataKey = this.getMetadataKey(fid);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: metadataKey,
    });

    const response = await this.s3Client.send(command);
    const body = await response.Body.transformToString();
    const metadata = JSON.parse(body);

    // Decode original filename if it was URL-encoded
    if (metadata.metadata?.name) {
      try {
        metadata.metadata.name = decodeURIComponent(metadata.metadata.name);
      } catch (e) {
        // If decode fails, keep the original value
      }
    }

    return metadata;
  }
}

module.exports = S3Store;
