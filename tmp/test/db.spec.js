"use strict";
const fsp = require("fs-promise");
const path = require("path");
const Db = require("./db");
const Store = require("./store");
const uploadDir = path.resolve(__dirname, "data");

describe("psitransfer db", () => {
  let db;
  let store;
  beforeEach(() => {
    // TODO: atomic name
    store = new Store(uploadDir);
    db = new Db(
      uploadDir,
      store
    );
  });

  afterEach((next) => {
    fsp.remove(uploadDir, next);
  });

  it("should properly construct", () => {
    expect(db.initialized).toBeFalsy();
    expect(db.db).toEqual({});
    expect(db.expireTimers).toEqual({});
    expect(db.store).toBe(store);
    expect(db.uploadDir).toEqual(uploadDir);
  });

  it("should call sync on init", () => {
    spyOn(db, "sync");
    db.initialized = false;
    db.init();
    expect(db.sync).toHaveBeenCalled();
  });

  it("shouldn't call sync on initialize if already bootstrapped ", () => {
    spyOn(db, "sync");
    db.initialized = true;
    db.init();
    expect(db.sync).not.toHaveBeenCalled();
  });

  describe("testing CRUD", () => {
    let sid;
    let uuid;
    let metaData;

    beforeEach(() => {
      sid = "221813e1688d";
      uuid = "e40bc20e-5be3-4906-903c-895f05e49efe";
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

      fsp.ensureDirSync(uploadDir);
      fsp.ensureDirSync(path.resolve(uploadDir, sid));
      fsp.writeFileSync(path.resolve(uploadDir, sid, uuid), "");
      fsp.writeFileSync(path.resolve(uploadDir, sid, uuid + ".json"), JSON.stringify(metaData));
    });

    it("should sync upload dir", () => {
      spyOn(db, "import");
      db.sync();
      expect(db.import).toHaveBeenCalledWith(sid);
    });

    it("should import existing files", async() => {
      spyOn(db.store, "info").and.returnValue(Promise.resolve(metaData));
      spyOn(db, "add");
      db.initialized = true;
      await db.import(sid);
      expect(db.add).toHaveBeenCalledWith(sid, uuid, metaData);
    });

    it("should remove files", async() => {
      db.initialized = true;
      db.db[sid] = [ metaData ];
      spyOn(store, "del").and.returnValue(Promise.resolve());
      spyOn(fsp, "rmdir").and.returnValue(Promise.resolve());

      await db.remove(sid, uuid);

      expect(store.del).toHaveBeenCalledWith(sid + '++' + uuid);
      expect(db.db[sid]).not.toBeDefined();
      expect(fsp.rmdir).toHaveBeenCalledWith(path.resolve(uploadDir, sid));
    });

    it("should add new files to sid", () => {
      db.initialized = true;
      spyOn(db, "registerRemove");
      db.add(sid, uuid, metaData);
      expect(db.registerRemove).toHaveBeenCalled();
      expect(db.db[sid]).toEqual([metaData]);
    });

    it("should update already existing files", () => {
      db.initialized = true;
      db.add(sid, uuid, Object.assign(metaData, { bacon: "yammie"}));
      db.add(sid, uuid, metaData);
      expect(db.db[sid]).toEqual([metaData]);
    });
  });
});
