# Storage Backends

PsiTransfer supports pluggable storage backends for file uploads and downloads.

## Architecture

### Base Class: `store.js`

Abstract base class defining the storage interface that all implementations must follow:

- `getFilename(fid)` - Get storage-specific file identifier
- `create(fid, opts)` - Initialize new file upload
- `update(fid, data)` - Update file metadata
- `info(fid)` - Retrieve file information and metadata
- `append(fid, readStream, offset)` - Append data (resumable uploads)
- `createReadStream(fid, start, end, cb)` - Create download stream
- `del(fid)` - Delete file and metadata
- `getType()` - Return storage type identifier

### Implementations

#### FileStore (`fileStore.js`)

**Default filesystem-based storage.**

- Stores files in local directory structure: `{uploadDir}/{sid}/{uuid}`
- Metadata stored as `.json` files alongside data files
- Direct file access via `fs.createReadStream()` and `fs.createWriteStream()`
- Simple, no external dependencies

**Use when:**
- Running on single server
- Local disk storage is sufficient
- No need for cloud scaling

#### S3Store (`s3Store.js`)

**AWS S3 cloud storage backend.**

- Stores files in S3 with key format: `{sid}/{uuid}`
- Metadata stored as separate `.json` objects in S3
- Uses AWS SDK v3 with multipart uploads for resumable transfers
- Generates presigned URLs for direct S3 downloads
- Streams files from S3 without loading into memory

**Features:**
- **Multipart upload buffering** - Accumulates TUS chunks to meet S3's 5MB minimum part size
- **Signed download URLs** - Time-limited URLs for secure downloads (default: 1 hour expiry)
- **Stream proxying** - Archives stream from S3 through Node.js without memory buffering
- **Zero-copy downloads** - Single files redirect to S3 presigned URLs

**Use when:**
- Cloud deployment (AWS, containers)
- Need scalability and redundancy
- Want to leverage S3 features (CloudFront, lifecycle policies)
- Multiple server instances

### Factory: `index.js`

Creates storage instances based on configuration:

```javascript
const { createStore } = require('./stores');
const store = createStore(config);
```

Selects implementation based on `config.storage.type`:
- `'filesystem'` → FileStore
- `'s3'` → S3Store

## Configuration

See `config.js` and `docs/configuration.md` for details.

### Filesystem (default)

```javascript
{
  uploadDir: '/path/to/data'
}
```

### S3

```javascript
{
  storage: {
    type: 's3',
    bucket: 'your-bucket-name',
    region: 'us-east-1',
    credentials: { ... }, // Optional
    signedUrlExpiry: 3600
  }
}
```

## Upload Flow (TUS Protocol)

### Filesystem
1. Client POST → Create metadata `.json` file
2. Client PATCH → Append chunks to file with `fs.createWriteStream()`
3. On complete → Update metadata, mark as not partial

### S3
1. Client POST → Start S3 multipart upload, store `UploadId` in metadata
2. Client PATCH → Buffer chunks until 5MB accumulated
3. When buffer full → Upload part to S3, store ETag
4. On complete → Call `CompleteMultipartUpload`, mark as not partial

**Key challenge:** TUS uses byte offsets, S3 uses part numbers. Solution: Buffer chunks in memory (max 5MB per concurrent upload).

## Download Flow

### Filesystem
- **Single file:** `res.sendFile()` - Express serves file directly
- **Archive:** `fs.createReadStream()` → archiver → `res`

### S3
- **Single file:** Generate presigned URL → `res.redirect(302, signedUrl)`
- **Archive:** `s3.GetObjectCommand()` → `response.Body` stream → archiver → `res`

Archives stream from S3 sequentially, one file at a time, to avoid memory issues with large files.

## Memory Considerations

### FileStore
- Minimal memory usage (streaming only)
- Node.js handles backpressure automatically

### S3Store
- **Upload buffer:** Up to 5MB per concurrent upload (required for S3 multipart API)
- **Download streams:** Zero buffering - direct S3 → archiver → HTTP
- **Large files:** 100GB+ files stream with constant memory usage

## Error Handling

Both implementations:
- Throw `httpErrors.NotFound()` for missing files
- Handle cleanup on upload failures (abort multipart uploads for S3)
- Support resumable uploads via TUS offset validation

## Future Enhancements

Possible additional backends:
- **Azure Blob Storage**
- **Google Cloud Storage**
- **MinIO / S3-compatible services**
- **SFTP / WebDAV**

To add a new backend:
1. Extend `Store` base class
2. Implement all required methods
3. Add to factory in `index.js`
4. Update configuration schema
