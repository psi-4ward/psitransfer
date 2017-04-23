"use strict";
const fsp = require("fs-promise");
const path = require("path");
const Store = require("./store");
const httpErrors = require('http-errors');

const uploadDir = path.resolve(__dirname, "data");

describe("psitransfer store", () => {

  let store;
  let sid;
  let uuid;
  let fid;
  let metaData;
  let info;
  let stat;

  beforeEach(() => {
    store = new Store(uploadDir);

    sid = "221813e1688d";
    uuid = "e40bc20e-5be3-4906-903c-895f05e49efe";

    fsp.ensureDirSync(path.resolve(uploadDir, sid));

    fid = `${sid}++${uuid}`;
    metaData = {
      uploadLength: 0,
      metadata: {
        sid,
        retention: "259200",
        password: "",
        name: "test.txt",
        key: uuid,
        createdAt: "" + Date.now()
      },
      size: 0,
      offset: 0
    };

    info = {
      offset: 100,
      uploadLength: 100,
      metadata: {
        sid: 'fea60a1beba6',
        retention: '259200',
        password: '',
        name: 'bacon.ham',
        key: '1215182b-ca57-4212-9e87-c7028190ff69',
        createdAt: '1483890816120'
      },
      isPartial: true,
    };

    stat = {
      size: 287
    };
  });

  afterEach((next) => {
    fsp.remove(uploadDir, next);
  });

  it("should properly construct", () => {
    expect(store.dir).toEqual(uploadDir);
  });

  it("should create new files", async() => {

    let fileName = store.getFilename(fid);

    spyOn(store, "getFilename").and.callThrough();
    spyOn(fsp, "ensureDir").and.returnValue(Promise.resolve());
    spyOn(fsp, "writeJson").and.returnValue(Promise.resolve());

    expect(await store.create(fid, metaData)).toEqual({
      uploadId: fid
    });

    expect(store.getFilename).toHaveBeenCalled();
    expect(fsp.ensureDir).toHaveBeenCalled();
    expect(fsp.writeJson).toHaveBeenCalled();
  });

  it("should evaluate file info", async() => {

    spyOn(fsp, "readJson").and.returnValue(Promise.resolve(info));
    spyOn(fsp, "stat").and.returnValue(Promise.resolve(stat));
    expect(await store.info(fid)).toEqual(Object.assign({}, info, stat));
  });

  it("should throw an http error on file info if file doesn't exist", (next) => {
    store.info(fid)
    // TODO use always when available
    // .always(() => next());
      .then(() => {
        // if this test fails you accidently created that file and didn't cleanup
        expect(true).toBeFalsy();
        next();
      })
      .catch((e) => {
        expect(e).toEqual(jasmine.any(httpErrors.NotFound().constructor));
        next();
      });
  });

  it("should append file content", async() => {
    let readStream = fsp.createReadStream('/dev/urandom', {start: 0, end: 99});

    spyOn(store, "info").and.returnValue(Promise.resolve(info));
    spyOn(fsp, "writeJson").and.returnValue(Promise.resolve());
    spyOn(fsp, "createWriteStream").and.callThrough();

    let retVal = await store.append(fid, readStream, 0);
    expect(retVal).toEqual({offset: 100, upload: info});

    expect(store.info).toHaveBeenCalledWith(fid);
    expect(fsp.writeJson).toHaveBeenCalled();
  });

  it("should create a read stream", (next) => {
    let cb = jasmine.createSpy('cb');
    spyOn(store, "info").and.returnValue(Promise.resolve(info));
    spyOn(store, "getFilename");
    spyOn(fsp, "createReadStream");

    store.createReadStream(fid, 0, 100, cb);

    expect(store.getFilename).toHaveBeenCalledTimes(2);
    expect(store.info).toHaveBeenCalled();
    expect(fsp.createReadStream).toHaveBeenCalled();
    setTimeout(() => {
      expect(cb).toHaveBeenCalled();
      next();
    }, 0);
  });

  it("should delete files", async() => {
    spyOn(fsp, "unlink");
    spyOn(store, "getFilename");

    await store.del(fid);

    expect(fsp.unlink).toHaveBeenCalledTimes(2);
    expect(store.getFilename).toHaveBeenCalledTimes(3);
  });
});
