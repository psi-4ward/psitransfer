# PsiTransfer Testing Guide

This document describes the test suite for PsiTransfer, including unit tests, integration tests, and smoke tests for both filesystem and S3 storage backends.

## Test Structure

```
tests/
├── unit/                    # Unit tests (no external dependencies)
│   ├── fileStore.test.js   # FileStore implementation tests
│   └── storeFactory.test.js # Store factory tests
├── integration/             # Integration tests (require external services)
│   ├── s3Store.test.js     # S3Store tests with LocalStack
│   └── smoke.test.js       # Full application smoke tests
└── e2e/                     # End-to-end browser tests
    ├── 01_upload.js
    └── 02_download.js
```

## Prerequisites

- Node.js 24+
- Docker (for integration tests with LocalStack)
- npm dependencies installed: `npm install`

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm run test:unit
```

Unit tests are fast and don't require external services. They test:
- FileStore operations (create, append, read, delete)
- Store factory pattern
- Basic functionality and error handling

### Integration Tests Only
```bash
npm run test:integration
```

Integration tests use [Testcontainers](https://node.testcontainers.org/) to automatically start a LocalStack container and test:
- S3Store with real S3-compatible storage
- Multipart uploads
- Presigned URLs
- Streaming large files
- Concurrent operations

**Note:** First run will download LocalStack Docker image (~100MB).

### Watch Mode (Development)
```bash
npx mocha tests/unit/**/*.test.js --watch
```

## Test Coverage

### FileStore Tests (`tests/unit/fileStore.test.js`)

Tests the filesystem storage backend:
- ✅ Basic CRUD operations
- ✅ Path traversal protection
- ✅ Resumable uploads with offset validation
- ✅ Range requests for partial content
- ✅ Metadata persistence
- ✅ Error handling

### Store Factory Tests (`tests/unit/storeFactory.test.js`)

Tests the storage abstraction factory:
- ✅ Creates FileStore by default
- ✅ Creates S3Store when configured
- ✅ Validates required S3 configuration
- ✅ Passes credentials and options correctly
- ✅ Error handling for invalid configurations

### S3Store Integration Tests (`tests/integration/s3Store.test.js`)

Tests S3 storage with LocalStack (runs in Docker container):
- ✅ Multipart upload with 5MB buffer accumulation
- ✅ Small uploads (< 5MB)
- ✅ Large uploads (> 5MB) in multiple parts
- ✅ Resumable uploads across multiple append operations
- ✅ Offset mismatch error handling
- ✅ Streaming downloads without memory buffering
- ✅ Range requests for partial downloads
- ✅ Large file streaming (10MB+)
- ✅ Presigned URL generation
- ✅ Custom expiry times for signed URLs
- ✅ File and metadata deletion
- ✅ Concurrent upload handling
- ✅ Buffer cleanup after completion

### Smoke Tests (`tests/integration/smoke.test.js`)

End-to-end tests of the full application:
- ✅ Filesystem storage backend connectivity
- ✅ S3 storage backend with LocalStack connectivity
- ✅ Application startup with different configurations

## Local Testing with MinIO

### Using Docker Compose

Start MinIO and PsiTransfer with both storage backends:

```bash
docker-compose -f docker-compose.test.yml up
```

This starts:
- **LocalStack** at http://localhost:4566
- **PsiTransfer (Filesystem)** at http://localhost:3000
- **PsiTransfer (S3)** at http://localhost:3001
  - Credentials: `test` / `test`

Test file uploads and downloads on both instances to verify functionality.

### Manual LocalStack Setup

Start LocalStack:
```bash
docker run -d \
  --name localstack \
  -p 4566:4566 \
  -e SERVICES=s3 \
  localstack/localstack:latest
```

Create test bucket:
```bash
aws --endpoint-url=http://localhost:4566 \
  --region us-east-1 \
  s3 mb s3://psitransfer-test
```

Configure PsiTransfer for S3 (`config.s3-local.js`):
```javascript
module.exports = {
  storage: {
    type: 's3',
    bucket: 'psitransfer-test',
    region: 'us-east-1',
    credentials: {
      accessKeyId: 'test',
      secretAccessKey: 'test',
    },
    // LocalStack endpoint (not needed for real AWS S3)
    endpoint: 'http://localhost:4566',
  },
};
```

Start PsiTransfer:
```bash
NODE_ENV=s3-local node app.js
```

## Continuous Integration

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

1. **Unit Tests** - Fast, no external dependencies
2. **Integration Tests** - With LocalStack in Docker
3. **Docker Build Test** - Ensures Dockerfile works
4. **Smoke Test** - Full application with S3 backend
5. **Lint Check** - Syntax validation

Triggered on:
- Push to main/master/develop branches
- Pull requests

## Writing New Tests

### Unit Test Template

```javascript
const { expect } = require('chai');

describe('MyFeature', () => {
  it('should do something', () => {
    expect(true).to.be.true;
  });
  
  it('should handle errors', async () => {
    try {
      await somethingThatThrows();
      throw new Error('Should have thrown');
    } catch (e) {
      expect(e.message).to.include('expected error');
    }
  });
});
```

### Integration Test Template (with MinIO)

```javascript
const { expect } = require('chai');
const { GenericContainer } = require('testcontainers');
const { S3Client } = require('@aws-sdk/client-s3');

describe('S3 Feature', function() {
  this.timeout(60000);
  
  let container;
  let s3Client;
  
  before(async () => {
    container = await new GenericContainer('minio/minio:latest')
      .withCommand(['server', '/data'])
      .withEnvironment({
        MINIO_ROOT_USER: 'minioadmin',
        MINIO_ROOT_PASSWORD: 'minioadmin',
      })
      .withExposedPorts(9000)
      .start();
    
    const endpoint = `http://${container.getHost()}:${container.getMappedPort(9000)}`;
    
    s3Client = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'minioadmin',
        secretAccessKey: 'minioadmin',
      },
      forcePathStyle: true,
    });
  });
  
  after(async () => {
    if (container) await container.stop();
  });
  
  it('should test something with S3', async () => {
    // Your test here
  });
});
```

## Debugging Tests

### Verbose Output
```bash
DEBUG=psitransfer:* npm test
```

### Run Single Test File
```bash
npx mocha tests/unit/fileStore.test.js
```

### Run Single Test
```bash
npx mocha tests/unit/fileStore.test.js --grep "should append data"
```

### Keep MinIO Running
```bash
# In integration tests, comment out container.stop() in after() hook
# Then inspect MinIO Console at http://localhost:9001
```

## Test Data Cleanup

Test data is automatically cleaned up:
- Unit tests: `.test-data/` directory removed after each test
- Integration tests: Docker containers stopped and removed
- Filesystem tests: Temporary directories deleted

Manual cleanup if needed:
```bash
# Remove test data
rm -rf .test-data .test-data-fs

# Remove Docker test containers
docker rm -f psitransfer-minio psitransfer-filesystem psitransfer-s3

# Remove test volumes
docker volume prune
```

## Performance Testing

For load testing with large files:

```javascript
it('should handle 1GB upload', async function() {
  this.timeout(300000); // 5 minutes
  
  const dataSize = 1024 * 1024 * 1024; // 1GB
  const testData = Buffer.alloc(dataSize, 'x');
  
  // Test upload...
});
```

## Known Issues

1. **Testcontainers on macOS M1/M2**: MinIO image works natively with ARM64
2. **Port Conflicts**: If ports 9000/9001 are in use, tests will fail
3. **Docker Desktop**: Required for integration tests
4. **First Run**: Slower due to Docker image downloads

## Additional Resources

- [Mocha Documentation](https://mochajs.org/)
- [Chai Assertions](https://www.chaijs.com/api/)
- [Testcontainers Node](https://node.testcontainers.org/)
- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
- [AWS SDK v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)

## Contributing

When adding new features:
1. Write unit tests first (TDD)
2. Add integration tests for S3-specific features
3. Update this README if adding new test categories
4. Ensure all tests pass before submitting PR: `npm run test:all`
