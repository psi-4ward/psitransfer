# Configuration

First of all, I'll give an overview about the configuration options. See the 
[config.js](https://github.com/psi-4ward/psitransfer/blob/master/config.js#L5) for 
possible values. I do **not** recommend changing this file directly, better use one
of the following options.

## Config file: NODE_ENV related

PsiTransfer searches for an config file with the name `config.<NODE_ENV>.js` in the
root folder where `<NODE_ENV>` stands for the value of the environment parameter `NODE_ENV`.
If you start PsiTransfer using `npm start` it's `production` so you can create a
`config.production.js` with your settings. For example take a look at 
[config.dev.js](https://github.com/psi-4ward/psitransfer/blob/master/config.dev.js).
This file is used when starting the application with `npm run dev`.

You are completely free to introduce own configs like `config.custom.js` and start
the app with `NODE_ENV=custom node app.js`.

## Environment variables

Some Linux distributions have `/etc/default/<daemon>` or `/etc/sysconfig/<daemon>`
files with environment configurations. Moreover, it's common to 
configure the behaviour of Docker containers using environment parameters.

PsiTransfer supports overwriting every config value by environment parameters prefixed
with `PSITRANSFER_`.

```bash
export NODE_ENV=dev
export PSITRANSFER_RETENTIONS='{"one-time":"one time","3600":"1 Hour"}'
export PSITRANSFER_PORT=8080
node app.js
```

* The above example sets the `NODE_ENV` to `dev`.  
  If `config.dev.js` exists, it is loaded and overwrites the corresponding values from `config.js`.
* Then it will overwrite `retentions` and `port` with the values of the environment parameters.

> Environment parameters always have the highest priority.

## SSL

It's recommended to use Nginx for SSL termination, see [nginx-ssl-example.conf](https://github.com/psi-4ward/psitransfer/blob/master/docs/nginx-ssl-example.conf).

For native SSL support provide `sslPort`, `sslKeyFile`, `sslCertFile` options. To generate
a _snake oil_ certificate use `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout cert.key -out cert.pem`.

To disable HTTP set the `port` config value to `false`.

## S3 Storage Backend

PsiTransfer supports using Amazon S3 (or S3-compatible services) as a storage backend instead of local filesystem storage. This is useful for cloud deployments, scalability, and leveraging S3 features like lifecycle policies and geo-replication.

### Configuration

To enable S3 storage, configure the following in your `config.<NODE_ENV>.js` file:

```javascript
module.exports = {
  storage: {
    type: 's3',
    bucket: 'your-bucket-name',
    region: 'us-east-1',  // AWS region
    // Optional: Explicit credentials (if not using IAM roles or environment variables)
    credentials: {
      accessKeyId: 'YOUR_ACCESS_KEY_ID',
      secretAccessKey: 'YOUR_SECRET_ACCESS_KEY'
    },
    // Optional: Signed URL expiry time in seconds (default: 3600 = 1 hour)
    signedUrlExpiry: 3600,
  }
};
```

Or using environment variables:

```bash
export PSITRANSFER_STORAGE='{"type":"s3","bucket":"your-bucket-name","region":"us-east-1","signedUrlExpiry":3600}'
```

### AWS Credentials

The S3 storage backend uses the AWS SDK v3, which supports multiple credential sources in this order:

1. **Explicit credentials** in config (as shown above)
2. **Environment variables**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
3. **Shared credentials file** (`~/.aws/credentials`)
4. **IAM roles** (recommended for EC2, ECS, Lambda deployments)
5. **Container credentials** (ECS task roles)

For production deployments, using IAM roles is recommended as it's more secure and doesn't require managing credentials in config files.

### S3 Bucket Setup

#### 1. Create S3 Bucket

```bash
aws s3 mb s3://your-psitransfer-bucket --region us-east-1
```

#### 2. Configure CORS (if accessing from browser)

If your application needs browser access to S3, configure CORS on your bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["https://your-domain.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

#### 3. Set up Lifecycle Policy for Incomplete Multipart Uploads

PsiTransfer uses S3 multipart uploads for resumable file transfers. To prevent abandoned uploads from accumulating storage costs, add a lifecycle policy:

```json
{
  "Rules": [
    {
      "Id": "DeleteIncompleteMultipartUploads",
      "Status": "Enabled",
      "Prefix": "",
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 7
      }
    },
    {
      "Id": "DeleteExpiredFiles",
      "Status": "Enabled",
      "Prefix": "",
      "Expiration": {
        "Days": 75
      }
    }
  ]
}
```

Apply this policy:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket your-psitransfer-bucket \
  --lifecycle-configuration file://lifecycle-policy.json
```

#### 4. IAM Policy

If using IAM roles or user credentials, ensure the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts",
        "s3:ListBucketMultipartUploads"
      ],
      "Resource": [
        "arn:aws:s3:::your-psitransfer-bucket",
        "arn:aws:s3:::your-psitransfer-bucket/*"
      ]
    }
  ]
}
```

### How S3 Storage Works

#### Signed URLs for Downloads

When using S3 storage, single file downloads are served via **presigned URLs**. Instead of proxying the file through the Node.js server, users are redirected to a time-limited signed URL that grants direct access to the S3 object.

**Benefits:**
- Reduced server bandwidth and load
- Faster downloads (direct from S3)
- Automatic support for S3 features (CloudFront CDN, Transfer Acceleration)

**Security:** URLs expire after `signedUrlExpiry` seconds (default: 1 hour) and respect bucket password protection.

#### Archive Downloads

ZIP and TAR.GZ archive downloads stream files directly from S3 through the Node.js server without loading them into memory. This works efficiently even for multi-gigabyte archives.

#### Resumable Uploads

PsiTransfer uses the TUS protocol for resumable uploads. With S3 storage:
- Chunks are buffered until reaching S3's 5MB minimum part size
- Parts are uploaded to S3 using multipart upload API
- Uploads can resume from last completed part after network interruptions
- Metadata is stored as separate JSON objects in S3

### S3-Compatible Services

PsiTransfer works with S3-compatible services like MinIO, DigitalOcean Spaces, or Backblaze B2. Configure the endpoint:

```javascript
module.exports = {
  storage: {
    type: 's3',
    bucket: 'your-bucket',
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'YOUR_KEY',
      secretAccessKey: 'YOUR_SECRET'
    },
    // For S3-compatible services, add endpoint configuration
    endpoint: 'https://nyc3.digitaloceanspaces.com'
  }
};
```

Note: You may need to pass the endpoint through the credentials object or configure it in the AWS SDK initialization.

### Switching from Filesystem to S3

To migrate from filesystem to S3 storage:

1. Configure S3 storage in your config file
2. Upload existing files to S3 manually (preserve the `sid/uuid` directory structure)
3. Upload corresponding `.json` metadata files
4. Restart PsiTransfer - it will scan S3 and rebuild its in-memory database

**Note:** There is no built-in migration tool. Files uploaded before the switch remain on the filesystem and won't be accessible after switching to S3 storage.

## WebHooks

For the sake of integrating PsiTransfer with other systems, PsiTransfer can notify a webhook with a POST request on the following events:

### fileUploaded

On completion of a file upload, if `fileUploadedWebhook` is set in `config.<NODE_ENV>.js`, PsiTransfer will make a POST request to that url.

At the time of writing, the POST body will contain a data structure resembling this (serialized as json):
```json
{
  "metadata": {
    "sid": "6055ab792b6c",
    "retention": 3600,
    "password": "file password is in plaintext here",
    "name": "test.png",
    "comment": "User individual file comment goes here",
    "type": "image/png",
    "key": "135a3814-df46-4e23-b061-03bdda13425c",
    "createdAt": 1589276618052
  },
  "date": 1589276619385
}
```

* Note: this event will fire many times if a user uploads multiple files in a single session (`sid`), as each individual file is uploaded separately. You'll notice that the `sid` will remain the same, but the `key` will change for each file. 
  * For file sync purposes (e.g. syncing client uploads to another service or long-term storage), you can reassemble a file fetch url with `https://<PSITRANSFER_HOST>/${sid}++${key}`

### fileDownloaded

When a user attempts to download a file, if `fileDownloadedWebhook` is set in `config.<NODE_ENV>.js`, PsiTransfer will make a POST request to that url.

At the time of writing, the POST body will contain a data structure resembling this (serialized as json):
```json
{
   "sid": "6055ab792b6c",
   "name": "test.png",
   "date": 1589276619415
}
```
