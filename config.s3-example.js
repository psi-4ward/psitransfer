/**
 * Example S3 Storage Configuration
 *
 * Copy this file to config.production.js (or config.<YOUR_ENV>.js)
 * and customize the values for your S3 setup.
 *
 * Start with: NODE_ENV=production node app.js
 */

module.exports = {
  // S3 Storage Configuration
  storage: {
    type: 's3',

    // Required: Your S3 bucket name
    bucket: 'your-psitransfer-bucket',

    // Required: AWS region where your bucket is located
    region: 'us-east-1',

    // Optional: Explicit AWS credentials
    // If not provided, AWS SDK will use default credential chain:
    // - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
    // - Shared credentials file (~/.aws/credentials)
    // - IAM roles (recommended for EC2/ECS deployments)
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },

    // Optional: Presigned URL expiry in seconds (default: 3600 = 1 hour)
    // This controls how long download URLs remain valid
    signedUrlExpiry: 3600,
  },

  // Other PsiTransfer configuration options
  // Note: uploadDir is ignored when using S3 storage

  port: 3000,
  baseUrl: '/',

  // Admin and upload passwords
  adminPass: process.env.PSITRANSFER_ADMIN_PASS || false,
  uploadPass: process.env.PSITRANSFER_UPLOAD_PASS || false,

  // File retention options
  retentions: {
    "one-time": "one time download",
    "3600": "1 Hour",
    "21600": "6 Hours",
    "86400": "1 Day",
    "259200": "3 Days",
    "604800": "1 Week",
    "1209600": "2 Weeks",
    "2419200": "4 Weeks",
  },
  defaultRetention: "604800",

  // Maximum age for files (75 days)
  // Note: Also set S3 lifecycle policy to automatically delete old files
  maxAge: 3600 * 24 * 75,

  // File size limits
  maxFileSize: null, // Set to limit individual file size, e.g., Math.pow(2, 30) * 5 for 5GB
  maxBucketSize: null, // Set to limit total bucket size

  // Webhooks for file events
  fileUploadedWebhook: process.env.FILE_UPLOADED_WEBHOOK || null,
  fileDownloadedWebhook: process.env.FILE_DOWNLOADED_WEBHOOK || null,
};
