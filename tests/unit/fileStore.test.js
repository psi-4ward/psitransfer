const { expect } = require('chai');
const path = require('path');
const fsp = require('fs-promise');
const { Readable } = require('stream');
const FileStore = require('../../lib/stores/fileStore');

describe('FileStore', () => {
  let store;
  let testDir;

  beforeEach(async () => {
    testDir = path.join(__dirname, '../../.test-data');
    await fsp.ensureDir(testDir);
    store = new FileStore(testDir);
  });

  afterEach(async () => {
    try {
      await fsp.remove(testDir);
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('getType()', () => {
    it('should return "filesystem"', () => {
      expect(store.getType()).to.equal('filesystem');
    });
  });

  describe('getFilename()', () => {
    it('should convert ++ to / in file identifier', () => {
      const filename = store.getFilename('abc123++uuid-456');
      expect(filename).to.include('abc123');
      expect(filename).to.include('uuid-456');
      expect(filename).to.not.include('++');
    });

    it('should prevent path traversal attacks', () => {
      expect(() => {
        store.getFilename('../../../etc/passwd');
      }).to.throw('file name not in jail path');
    });

    it('should resolve to within upload directory', () => {
      const filename = store.getFilename('sid123++key456');
      expect(filename).to.include(testDir);
    });
  });

  describe('create()', () => {
    it('should create metadata file for new upload', async () => {
      const fid = 'test-sid++test-key';
      const opts = {
        uploadLength: 1000,
        metadata: {
          name: 'test.txt',
          type: 'text/plain',
        },
      };

      const result = await store.create(fid, opts);

      expect(result).to.have.property('uploadId', fid);

      const metadataPath = store.getFilename(fid) + '.json';
      const exists = await fsp.exists(metadataPath);
      expect(exists).to.be.true;

      const metadata = await fsp.readJson(metadataPath);
      expect(metadata).to.have.property('isPartial', true);
      expect(metadata).to.have.property('uploadLength', 1000);
    });

    it('should create directory structure if it does not exist', async () => {
      const fid = 'nested/path/sid++key';
      await store.create(fid, { uploadLength: 100 });

      const metadataPath = store.getFilename(fid) + '.json';
      const exists = await fsp.exists(metadataPath);
      expect(exists).to.be.true;
    });
  });

  describe('update()', () => {
    it('should update metadata file', async () => {
      const fid = 'test-sid++test-key';
      await store.create(fid, { uploadLength: 1000 });

      const updatedData = {
        uploadLength: 1000,
        isPartial: false,
        metadata: { completed: true },
      };

      await store.update(fid, updatedData);

      const metadataPath = store.getFilename(fid) + '.json';
      const metadata = await fsp.readJson(metadataPath);
      expect(metadata).to.have.property('isPartial', false);
      expect(metadata.metadata).to.have.property('completed', true);
    });
  });

  describe('append()', () => {
    it('should append data to file', async () => {
      const fid = 'test-sid++test-key';
      const testData = 'Hello, World!';

      await store.create(fid, { uploadLength: testData.length });

      const readStream = Readable.from([Buffer.from(testData)]);
      const result = await store.append(fid, readStream, 0);

      expect(result).to.have.property('offset', testData.length);

      const filePath = store.getFilename(fid);
      const content = await fsp.readFile(filePath, 'utf8');
      expect(content).to.equal(testData);
    });

    it('should append data at correct offset', async () => {
      const fid = 'test-sid++test-key';
      const firstChunk = 'Hello, ';
      const secondChunk = 'World!';

      await store.create(fid, { uploadLength: firstChunk.length + secondChunk.length });

      // First append
      let readStream = Readable.from([Buffer.from(firstChunk)]);
      await store.append(fid, readStream, 0);

      // Second append at offset
      readStream = Readable.from([Buffer.from(secondChunk)]);
      const result = await store.append(fid, readStream, firstChunk.length);

      expect(result.offset).to.equal(firstChunk.length + secondChunk.length);

      const filePath = store.getFilename(fid);
      const content = await fsp.readFile(filePath, 'utf8');
      expect(content).to.equal(firstChunk + secondChunk);
    });

    it('should mark upload as complete when all data received', async () => {
      const fid = 'test-sid++test-key';
      const testData = 'Complete!';

      await store.create(fid, { uploadLength: testData.length });

      const readStream = Readable.from([Buffer.from(testData)]);
      await store.append(fid, readStream, 0);

      const info = await store.info(fid);
      expect(info).to.not.have.property('isPartial');
    });
  });

  describe('info()', () => {
    it('should return file information including size', async () => {
      const fid = 'test-sid++test-key';
      const testData = 'Test data';

      await store.create(fid, {
        uploadLength: testData.length,
        metadata: { name: 'test.txt' },
      });

      const readStream = Readable.from([Buffer.from(testData)]);
      await store.append(fid, readStream, 0);

      const info = await store.info(fid);

      expect(info).to.have.property('size', testData.length);
      expect(info).to.have.property('offset', testData.length);
      expect(info).to.have.property('uploadLength', testData.length);
      expect(info.metadata).to.have.property('name', 'test.txt');
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
    it('should create readable stream for file', async () => {
      const fid = 'test-sid++test-key';
      const testData = 'Stream test data';

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
      const fid = 'test-sid++test-key';
      const testData = 'Hello, World!';

      await store.create(fid, { uploadLength: testData.length });
      const writeStream = Readable.from([Buffer.from(testData)]);
      await store.append(fid, writeStream, 0);

      const readStream = store.createReadStream(fid, 7, 11, (info) => {
        expect(info.contentLength).to.equal(5); // "World" = 5 chars
      });

      const chunks = [];
      for await (const chunk of readStream) {
        chunks.push(chunk);
      }

      const result = Buffer.concat(chunks).toString('utf8');
      expect(result).to.equal('World');
    });
  });

  describe('del()', () => {
    it('should delete file and metadata', async () => {
      const fid = 'test-sid++test-key';

      await store.create(fid, { uploadLength: 100 });
      const writeStream = Readable.from([Buffer.from('test')]);
      await store.append(fid, writeStream, 0);

      const filePath = store.getFilename(fid);
      const metadataPath = filePath + '.json';

      expect(await fsp.exists(filePath)).to.be.true;
      expect(await fsp.exists(metadataPath)).to.be.true;

      await store.del(fid);

      expect(await fsp.exists(filePath)).to.be.false;
      expect(await fsp.exists(metadataPath)).to.be.false;
    });

    it('should not throw error if file does not exist', async () => {
      await store.del('nonexistent++key');
      // Should complete without throwing
    });
  });
});
