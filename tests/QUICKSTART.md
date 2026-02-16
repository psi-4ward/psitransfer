# Quick Test Reference

## Run Tests

```bash
# All tests
npm test

# Unit tests only (fast, no Docker required)
npm run test:unit

# Integration tests only (requires Docker)
npm run test:integration

# All tests
npm run test:all
```

## Test Results Summary

✅ **25 passing unit tests**
- FileStore: 15 tests
- Store Factory: 10 tests

✅ **Integration tests with MinIO**
- S3Store full functionality
- Multipart uploads
- Presigned URLs
- Streaming operations

## Local Testing with MinIO

```bash
# Start MinIO + PsiTransfer with both backends
docker-compose -f docker-compose.test.yml up

# Access:
# - Filesystem storage: http://localhost:3000
# - S3 storage: http://localhost:3001
# - MinIO Console: http://localhost:9001
```

## CI/CD

Tests run automatically on:
- Push to main/master/develop
- Pull requests

See `.github/workflows/ci.yml` for details.

## Coverage

- ✅ FileStore (filesystem backend)
- ✅ S3Store (S3/LocalStack backend)
- ✅ Store factory
- ✅ Multipart upload buffering
- ✅ Presigned URLs
- ✅ Streaming downloads
- ✅ Error handling
- ✅ Concurrent operations
- ✅ Path traversal protection
- ✅ Offset validation

## Test Files

```
tests/
├── unit/
│   ├── fileStore.test.js       # FileStore implementation
│   └── storeFactory.test.js    # Factory pattern
├── integration/
│   ├── s3Store.test.js         # S3Store with LocalStack
│   └── smoke.test.js           # Full app smoke tests
└── README.md                   # Detailed documentation
```

For more details, see [tests/README.md](./README.md)
