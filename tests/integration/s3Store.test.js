const { expect } = require('chai');
const { GenericContainer, Wait } = require('testcontainers');
const { S3Client, CreateBucketCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { Readable } = require('stream');
const S3Store = require('../../lib/stores/s3Store');

describe('S3Store Integration Tests (LocalStack)', function() {
  this.timeout(60000); // Give container time to start

  let container;
  let s3Client;
  let store;
  const bucketName = 'test-bucket';

  before(async () => {
    console.log('Starting LocalStack container...');

    // Start LocalStack container
    container = await new GenericContainer('localstack/localstack:latest')
      .withEnvironment({
        SERVICES: 's3',
        DEBUG: '1',
      })
      .withExposedPorts(4566)
      .withWaitStrategy(Wait.forLogMessage('Ready.'))
      .start();

    const localstackHost = container.getHost();
    const localstackPort = container.getMappedPort(4566);
    const endpoint = `http://${localstackHost}:${localstackPort}`;

    console.log(`LocalStack started at ${endpoint}`);

    // Configure S3 client for LocalStack
    s3Client = new S3Client({
      endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
      forcePathStyle: true, // Required for LocalStack
    });

    // Wait a bit for S3 service to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create test bucket
    await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
    console.log(`Bucket ${bucketName} created`);

    // Create S3Store instance
    store = new S3Store({
      bucket: bucketName,
      region: 'us-east-1',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    });

    // Override S3 client to use LocalStack endpoint
    store.s3Client = s3Client;
  });

  after(async () => {
    if (container) {
      console.log('Stopping LocalStack container...');
      await container.stop();
    }
  });

  describe('getType()', () => {
    it('should return "s3"', () => {
      expect(store.getType()).to.equal('s3');
    });
  });

  describe('getFilename()', () => {
    it('should convert ++ to / for S3 key', () => {
      const key = store.getFilename('sid123++uuid456');
      expect(key).to.equal('sid123/uuid456');
    });
  });

  describe('create()', () => {
    it('should create multipart upload and metadata', async () => {
      const fid = 'test-sid++create-test';
      const opts = {
        uploadLength: 1000,
        metadata: {
          name: 'test.txt',
          type: 'text/plain',
        },
      };

      const result = await store.create(fid, opts);

      expect(result).to.have.property('uploadId', fid);

      // Verify metadata was created in S3
      const info = await store.info(fid);
      expect(info).to.have.property('isPartial', true);
      expect(info).to.have.property('uploadLength', 1000);
      expect(info).to.have.property('s3UploadId');
    });
  });

  describe('append() and multipart upload', () => {
    it('should buffer and upload data in 5MB parts', async () => {
      const fid = 'test-sid++multipart-test';
      // Create 6MB of test data
      const dataSize = 6 * 1024 * 1024;
      const testData = Buffer.alloc(dataSize, 'a');

      await store.create(fid, { uploadLength: dataSize });

      const readStream = Readable.from([testData]);
      const result = await store.append(fid, readStream, 0);

      expect(result.offset).to.equal(dataSize);
      expect(result.upload.isPartial).to.be.undefined; // Should be complete

      // Verify file exists in S3
      const info = await store.info(fid);
      expect(info.size).to.equal(dataSize);
    });

    it('should handle small uploads (< 5MB)', async () => {
      const fid = 'test-sid++small-upload';
      const testData = 'Small test data';

      await store.create(fid, { uploadLength: testData.length });

      const readStream = Readable.from([Buffer.from(testData)]);
      const result = await store.append(fid, readStream, 0);

      expect(result.offset).to.equal(testData.length);

      // Verify we can read it back
      const info = await store.info(fid);
      expect(info.size).to.equal(testData.length);
    });

    it('should handle resumable uploads with multiple appends', async () => {
      const fid = 'test-sid++resumable-test';
      // Use 6MB chunks so each triggers part uploads
      const chunk1 = Buffer.alloc(6 * 1024 * 1024, 'a'); // 6MB - will upload 5MB part
      const chunk2 = Buffer.alloc(6 * 1024 * 1024, 'b'); // 6MB - will complete upload
      const totalSize = chunk1.length + chunk2.length;

      await store.create(fid, { uploadLength: totalSize });

      // First append - uploads 5MB part, leaves 1MB in buffer
      let readStream = Readable.from([chunk1]);
      let result = await store.append(fid, readStream, 0);
      // Offset should reflect what's uploaded to S3 (5MB), not total bytes received
      const firstOffset = result.offset;
      expect(firstOffset).to.be.at.least(5 * 1024 * 1024);

      // Second append - use the actual offset from first append
      readStream = Readable.from([chunk2]);
      result = await store.append(fid, readStream, firstOffset);
      // After final chunk, everything should be uploaded and complete
      expect(result.offset).to.equal(totalSize);

      // Verify complete
      const info = await store.info(fid);
      expect(info.size).to.equal(totalSize);
      expect(info.isPartial).to.be.undefined;
    });

    it('should throw error on offset mismatch', async () => {
      const fid = 'test-sid++offset-error';
      const testData = 'test';

      await store.create(fid, { uploadLength: testData.length });

      const readStream = Readable.from([Buffer.from(testData)]);

      try {
        await store.append(fid, readStream, 100); // Wrong offset
        throw new Error('Should have thrown offset mismatch error');
      } catch (e) {
        expect(e.status).to.equal(409);
      }
    });
  });

  describe('info()', () => {
    it('should return file information for completed upload', async () => {
      const fid = 'test-sid++info-test';
      const testData = 'Info test data';

      await store.create(fid, {
        uploadLength: testData.length,
        metadata: { name: 'info-test.txt' },
      });

      const readStream = Readable.from([Buffer.from(testData)]);
      await store.append(fid, readStream, 0);

      const info = await store.info(fid);

      expect(info).to.have.property('size', testData.length);
      expect(info).to.have.property('offset', testData.length);
      expect(info.metadata).to.have.property('name', 'info-test.txt');
      expect(info.isPartial).to.be.undefined;
    });

    it('should throw NotFound error for non-existent file', async () => {
      try {
        await store.info('nonexistent++key');
        throw new Error('Should have thrown NotFound error');
      } catch (e) {
        expect(e.status).to.equal(404);
      }
    });
  });

  describe('createReadStream()', () => {
    it('should create readable stream from S3', async () => {
      const fid = 'test-sid++read-stream-test';
      const testData = 'Stream test data from S3';

      await store.create(fid, { uploadLength: testData.length });
      const writeStream = Readable.from([Buffer.from(testData)]);
      await store.append(fid, writeStream, 0);

      const readStream = store.createReadStream(fid, 0, undefined, (info) => {
        expect(info.contentLength).to.equal(testData.length);
      });

      const chunks = [];
      for await (const chunk of readStream) {
        chunks.push(chunk);
      }

      const result = Buffer.concat(chunks).toString('utf8');
      expect(result).to.equal(testData);
    });

    it('should support range requests', async () => {
      const fid = 'test-sid++range-test';
      const testData = 'Hello from MinIO!';

      await store.create(fid, { uploadLength: testData.length });
      const writeStream = Readable.from([Buffer.from(testData)]);
      await store.append(fid, writeStream, 0);

      const readStream = store.createReadStream(fid, 6, 10, (info) => {
        expect(info.contentLength).to.equal(5); // "from " = 5 chars
      });

      const chunks = [];
      for await (const chunk of readStream) {
        chunks.push(chunk);
      }

      const result = Buffer.concat(chunks).toString('utf8');
      expect(result).to.equal('from ');
    });

    it('should stream large files without memory issues', async () => {
      const fid = 'test-sid++large-stream';
      // 10MB file
      const dataSize = 10 * 1024 * 1024;
      const testData = Buffer.alloc(dataSize, 'x');

      await store.create(fid, { uploadLength: dataSize });
      const writeStream = Readable.from([testData]);
      await store.append(fid, writeStream, 0);

      const readStream = store.createReadStream(fid, 0, undefined, (info) => {
        expect(info.contentLength).to.equal(dataSize);
      });

      let bytesRead = 0;
      for await (const chunk of readStream) {
        bytesRead += chunk.length;
      }

      expect(bytesRead).to.equal(dataSize);
    });
  });

  describe('getSignedDownloadUrl()', () => {
    it('should generate presigned URL for download', async () => {
      const fid = 'test-sid++signed-url-test';
      const testData = 'Signed URL test';

      await store.create(fid, {
        uploadLength: testData.length,
        metadata: { name: 'signed.txt', type: 'text/plain' },
      });
      const writeStream = Readable.from([Buffer.from(testData)]);
      await store.append(fid, writeStream, 0);

      const signedUrl = await store.getSignedDownloadUrl(fid, {
        filename: 'signed.txt',
      });

      expect(signedUrl).to.be.a('string');
      expect(signedUrl).to.include('X-Amz-Algorithm');
      expect(signedUrl).to.include('X-Amz-Signature');
      expect(signedUrl).to.include(bucketName);
    });

    it('should respect custom expiry time', async () => {
      const fid = 'test-sid++expiry-test';
      const testData = 'test';

      await store.create(fid, {
        uploadLength: testData.length,
        metadata: { name: 'test.txt' },
      });
      const writeStream = Readable.from([Buffer.from(testData)]);
      await store.append(fid, writeStream, 0);

      const signedUrl = await store.getSignedDownloadUrl(fid, {
        expiresIn: 7200,
      });

      expect(signedUrl).to.include('X-Amz-Expires=7200');
    });
  });

  describe('del()', () => {
    it('should delete file and metadata from S3', async () => {
      const fid = 'test-sid++delete-test';
      const testData = 'Delete me';

      await store.create(fid, { uploadLength: testData.length });
      const writeStream = Readable.from([Buffer.from(testData)]);
      await store.append(fid, writeStream, 0);

      // Verify exists
      const infoBefore = await store.info(fid);
      expect(infoBefore.size).to.equal(testData.length);

      // Delete
      await store.del(fid);

      // Verify deleted
      try {
        await store.info(fid);
        throw new Error('Should have thrown NotFound error');
      } catch (e) {
        expect(e.status).to.equal(404);
      }

      // Verify objects are gone from S3
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: store.getFilename(fid),
      });
      const listResult = await s3Client.send(listCommand);
      expect(listResult.Contents || []).to.have.lengthOf(0);
    });

    it('should not throw error if file does not exist', async () => {
      await store.del('nonexistent++key');
      // Should complete without throwing
    });
  });

  describe('update()', () => {
    it('should update metadata in S3', async () => {
      const fid = 'test-sid++update-test';

      await store.create(fid, {
        uploadLength: 100,
        metadata: { name: 'original.txt' },
      });

      const updatedData = {
        uploadLength: 100,
        metadata: {
          name: 'updated.txt',
          lastDownload: Date.now(),
        },
      };

      await store.update(fid, updatedData);

      const info = await store.info(fid);
      expect(info.metadata.name).to.equal('updated.txt');
      expect(info.metadata).to.have.property('lastDownload');
    });
  });

  describe('S3 multipart buffer management', () => {
    it('should clean up buffers after completion', async () => {
      const fid = 'test-sid++buffer-cleanup';
      const testData = Buffer.alloc(1024, 'a');

      await store.create(fid, { uploadLength: testData.length });

      expect(store.uploadBuffers.has(fid)).to.be.false;

      const readStream = Readable.from([testData]);
      await store.append(fid, readStream, 0);

      // Buffer should be cleaned up after completion
      expect(store.uploadBuffers.has(fid)).to.be.false;
    });

    it('should handle multiple concurrent uploads', async () => {
      const uploads = [];

      for (let i = 0; i < 3; i++) {
        const fid = `test-sid++concurrent-${i}`;
        const testData = Buffer.alloc(2 * 1024 * 1024, String(i));

        const upload = (async () => {
          await store.create(fid, { uploadLength: testData.length });
          const readStream = Readable.from([testData]);
          await store.append(fid, readStream, 0);
          return fid;
        })();

        uploads.push(upload);
      }

      const results = await Promise.all(uploads);
      expect(results).to.have.lengthOf(3);

      // Verify all uploads completed
      for (const fid of results) {
        const info = await store.info(fid);
        expect(info.size).to.equal(2 * 1024 * 1024);
      }
    });
  });
});
