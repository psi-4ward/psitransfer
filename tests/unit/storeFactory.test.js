const { expect } = require('chai');
const { createStore } = require('../../lib/stores');
const FileStore = require('../../lib/stores/fileStore');
const S3Store = require('../../lib/stores/s3Store');

describe('Store Factory', () => {
  describe('createStore()', () => {
    it('should create FileStore by default', () => {
      const config = {
        uploadDir: '/tmp/test',
      };

      const store = createStore(config);

      expect(store).to.be.instanceOf(FileStore);
      expect(store.getType()).to.equal('filesystem');
    });

    it('should create FileStore when type is "filesystem"', () => {
      const config = {
        uploadDir: '/tmp/test',
        storage: {
          type: 'filesystem',
        },
      };

      const store = createStore(config);

      expect(store).to.be.instanceOf(FileStore);
      expect(store.getType()).to.equal('filesystem');
    });

    it('should create S3Store when type is "s3"', () => {
      const config = {
        storage: {
          type: 's3',
          bucket: 'test-bucket',
          region: 'us-east-1',
        },
      };

      const store = createStore(config);

      expect(store).to.be.instanceOf(S3Store);
      expect(store.getType()).to.equal('s3');
    });

    it('should throw error if S3 bucket is not configured', () => {
      const config = {
        storage: {
          type: 's3',
          region: 'us-east-1',
        },
      };

      expect(() => createStore(config)).to.throw('S3 storage requires storage.bucket');
    });

    it('should throw error if S3 region is not configured', () => {
      const config = {
        storage: {
          type: 's3',
          bucket: 'test-bucket',
        },
      };

      expect(() => createStore(config)).to.throw('S3 storage requires storage.region');
    });

    it('should throw error for unknown storage type', () => {
      const config = {
        storage: {
          type: 'unknown',
        },
      };

      expect(() => createStore(config)).to.throw('Unknown storage type: unknown');
    });

    it('should pass credentials to S3Store', () => {
      const config = {
        storage: {
          type: 's3',
          bucket: 'test-bucket',
          region: 'us-east-1',
          credentials: {
            accessKeyId: 'test-key',
            secretAccessKey: 'test-secret',
          },
        },
      };

      const store = createStore(config);

      expect(store).to.be.instanceOf(S3Store);
      expect(store.bucket).to.equal('test-bucket');
      expect(store.region).to.equal('us-east-1');
    });

    it('should pass signedUrlExpiry to S3Store', () => {
      const config = {
        storage: {
          type: 's3',
          bucket: 'test-bucket',
          region: 'us-east-1',
          signedUrlExpiry: 7200,
        },
      };

      const store = createStore(config);

      expect(store.signedUrlExpiry).to.equal(7200);
    });

    it('should use default signedUrlExpiry if not provided', () => {
      const config = {
        storage: {
          type: 's3',
          bucket: 'test-bucket',
          region: 'us-east-1',
        },
      };

      const store = createStore(config);

      expect(store.signedUrlExpiry).to.equal(3600);
    });
  });
});
