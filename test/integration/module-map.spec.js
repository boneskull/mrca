'use strict';

const {ModuleMap} = require('../../src/module-map');
const {ModuleMapNode} = require('../../src/module-map-node');
const {FileEntryCache} = require('../../src/file-entry-cache');
const sinon = require('sinon');
const path = require('path');
const expect = require('../expect');

/**
 * @param {string} filename
 */
const resolveFixturePath = (filename) =>
  path.join(__dirname, 'fixtures', 'module-map', filename);

const TEST_MODULE_MAP_CACHE_FILENAME = 'module-map-integration-test.cache.json';
const TEST_FILE_ENTRY_CACHE_FILENAME = 'file-entry-integration-test.cache.json';
const TEST_WITH_DEP_PATH = resolveFixturePath(
  'test-with-dependency.fixture.js'
);
const DEP_PATH = resolveFixturePath('dependency.fixture.js');
const TEST_WITH_TRANSITIVE_DEP_PATH = resolveFixturePath(
  'test-with-transitive-dep.fixture.js'
);
const TRANSITIVE_DEP_PATH = resolveFixturePath('transitive-dep.fixture.js');

describe('module-map', function () {
  /**
   * @type {ModuleMap}
   */
  let moduleMap;

  afterEach(function () {
    sinon.restore();
  });

  beforeEach(function () {
    moduleMap = ModuleMap.create({
      fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
      moduleMapCacheFilename: TEST_MODULE_MAP_CACHE_FILENAME,
      entryFiles: [TEST_WITH_DEP_PATH, TEST_WITH_TRANSITIVE_DEP_PATH],
      reset: true,
    });
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('initialization', function () {
    it('should populate the ModuleMap with all entry files and dependencies thereof', function () {
      expect(moduleMap, 'as JSON', 'to satisfy', {
        [TEST_WITH_DEP_PATH]: {
          filename: TEST_WITH_DEP_PATH,
          entryFiles: [],
          children: [DEP_PATH],
          parents: [],
        },
        [TEST_WITH_TRANSITIVE_DEP_PATH]: {
          filename: TEST_WITH_TRANSITIVE_DEP_PATH,
          entryFiles: [],
          children: [TRANSITIVE_DEP_PATH],
          parents: [],
        },
        [DEP_PATH]: {
          filename: DEP_PATH,
          entryFiles: [TEST_WITH_DEP_PATH, TEST_WITH_TRANSITIVE_DEP_PATH],
          children: [],
          parents: [TEST_WITH_DEP_PATH, TRANSITIVE_DEP_PATH],
        },
        [TRANSITIVE_DEP_PATH]: {
          filename: TRANSITIVE_DEP_PATH,
          entryFiles: [TEST_WITH_TRANSITIVE_DEP_PATH],
          children: [DEP_PATH],
          parents: [TEST_WITH_TRANSITIVE_DEP_PATH],
        },
      });
    });

    describe('when reloading', function () {
      beforeEach(function () {
        sinon.spy(ModuleMap.prototype, '_hydrate');
      });

      describe('when known entry files were previously persisted to file entry cache', function () {
        beforeEach(function () {
          moduleMap.fileEntryCache.save(moduleMap.files);
        });

        it('should inspect only new (unknown) entry files', function () {
          const someOtherFile = resolveFixturePath(
            'test-file-change.fixture.js'
          );
          const map2 = ModuleMap.create({
            fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
            moduleMapCacheFilename: TEST_MODULE_MAP_CACHE_FILENAME,
            entryFiles: [
              TEST_WITH_DEP_PATH,
              TEST_WITH_TRANSITIVE_DEP_PATH,
              someOtherFile,
            ],
          });
          expect(map2._hydrate, 'to have a call satisfying', [
            expect
              .it('as array', 'to have an item satisfying', {
                filename: someOtherFile,
              })
              .and('as array', 'to have length', 1),
            {force: true},
          ]);
        });
      });

      describe('when known entry files were not previously persisted to file entry cache', function () {
        beforeEach(async function () {
          await moduleMap.ready;
          moduleMap.fileEntryCache.reset();
        });

        it('should inspect all entry files', async function () {
          const someOtherFile = resolveFixturePath(
            'test-file-change.fixture.js'
          );
          const map2 = ModuleMap.create({
            fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
            moduleMapCacheFilename: TEST_MODULE_MAP_CACHE_FILENAME,
            entryFiles: [
              TEST_WITH_DEP_PATH,
              TEST_WITH_TRANSITIVE_DEP_PATH,
              someOtherFile,
            ],
          });
          await map2.ready;
          // a less awkward way to do this might be to just instantiate a bunch
          // of `ModuleMapNode` objects with the proper properties
          return expect(map2._hydrate, 'to have a call satisfying', [
            expect
              .it('as array', 'to have an item satisfying', {
                filename: someOtherFile,
              })
              .and('as array', 'to have an item satisfying', {
                filename: TEST_WITH_DEP_PATH,
              })
              .and('as array', 'to have an item satisfying', {
                filename: TEST_WITH_TRANSITIVE_DEP_PATH,
              })
              .and('to have size', 3),
            {force: true},
          ]);
        });
      });

      describe('when an entry file has changed', function () {
        let someOtherFile;

        beforeEach(function () {
          someOtherFile = resolveFixturePath('test-file-change.fixture.js');
          sinon.stub(FileEntryCache.prototype, 'yieldChangedFiles').returns({
            changed: new Set([TEST_WITH_DEP_PATH, someOtherFile]),
            notFound: new Set(),
          });
        });

        it('should inspect all changed and new entry files', function () {
          const map2 = ModuleMap.create({
            fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
            moduleMapCacheFilename: TEST_MODULE_MAP_CACHE_FILENAME,
            entryFiles: [
              TEST_WITH_DEP_PATH,
              TEST_WITH_TRANSITIVE_DEP_PATH,
              someOtherFile,
            ],
          });
          expect(map2._hydrate, 'to have a call satisfying', [
            new Set([
              ModuleMapNode.create(someOtherFile),
              ModuleMapNode.create(TEST_WITH_DEP_PATH, {
                children: new Set([DEP_PATH]),
              }),
            ]),
            {force: true},
          ]);
        });
      });

      describe('when a known dependency has changed', function () {
        beforeEach(function () {
          sinon.stub(FileEntryCache.prototype, 'yieldChangedFiles').returns({
            changed: new Set([DEP_PATH]),
            notFound: new Set([]),
          });
        });

        it('should inspect all changed dependencies', function () {
          const map2 = ModuleMap.create({
            fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
            moduleMapCacheFilename: TEST_MODULE_MAP_CACHE_FILENAME,
            entryFiles: [TEST_WITH_DEP_PATH, TEST_WITH_TRANSITIVE_DEP_PATH],
          });
          expect(map2._hydrate, 'to have a call satisfying', [
            new Set([
              ModuleMapNode.create(DEP_PATH, {
                entryFiles: new Set([
                  TEST_WITH_DEP_PATH,
                  TEST_WITH_TRANSITIVE_DEP_PATH,
                ]),
                parents: new Set([TEST_WITH_DEP_PATH, TRANSITIVE_DEP_PATH]),
              }),
            ]),
            {force: true},
          ]);
        });
      });
    });
  });

  describe('merging from disk', function () {
    describe('when run w/ option `destructive = true`', function () {
      it('should overwrite the ModuleMap contents', function () {
        moduleMap.set('/some/file', ModuleMapNode.create('/some/file'));
        moduleMap.mergeFromCache({destructive: true});
        expect(moduleMap, 'not to have key', '/some/file').and(
          'to have key',
          TEST_WITH_DEP_PATH
        );
      });
    });

    describe('when run w/o options', function () {
      it('should merge into the ModuleMap contents', function () {
        moduleMap.set('/some/file', ModuleMapNode.create('/some/file'));
        moduleMap.mergeFromCache();
        expect(moduleMap, 'to have key', '/some/file').and(
          'to have key',
          TEST_WITH_DEP_PATH
        );
      });
    });
  });

  describe('module map cache destruction', function () {
    describe('when a new ModuleMap is instantiated with a previously-reset module map cache', function () {
      beforeEach(function () {
        moduleMap.moduleMapCache.reset();
      });

      it('should be empty', function () {
        expect(
          ModuleMap.create({
            fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
            moduleMapCacheFilename: TEST_MODULE_MAP_CACHE_FILENAME,
          }),
          'to be empty'
        );
      });
    });

    describe('when a ModuleMap has had its module map cache previously reset', function () {
      beforeEach(function () {
        moduleMap.moduleMapCache.reset();
      });

      it("should not affect the ModuleMap's in-memory contents", function () {
        expect(moduleMap, 'not to be empty');
      });

      describe('when a ModuleMap then persists its in-memory contents', function () {
        beforeEach(function () {
          moduleMap.moduleMapCache.save(moduleMap);
        });

        it('should contain a non-empty module map cache', function () {
          expect(moduleMap.moduleMapCache.values(), 'not to be empty');
        });

        it("should not affect the ModuleMap's in-memory contents", function () {
          expect(moduleMap, 'not to be empty');
        });
      });
    });
  });

  describe('file entry cache destruction', function () {
    describe('when a new ModuleMap is instantiated with a previously-reset file entry cache', function () {
      beforeEach(async function () {
        await moduleMap.ready;
        moduleMap.fileEntryCache.reset();
      });

      it('should repopulate the file entry cache', async function () {
        const moduleMap2 = ModuleMap.create({
          fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
          moduleMapCacheFilename: TEST_MODULE_MAP_CACHE_FILENAME,
          entryFiles: [TEST_WITH_DEP_PATH, TEST_WITH_TRANSITIVE_DEP_PATH],
        });
        await moduleMap2.ready;
        // @ts-ignore
        expect(moduleMap2.fileEntryCache.cache.cache.all(), 'not to be empty');
      });
    });

    describe('when a ModuleMap has had its file entry cache previously reset', function () {
      beforeEach(function () {
        moduleMap.fileEntryCache.reset();
      });

      it('should clear the file entry cache', function () {
        // @ts-ignore
        expect(moduleMap.fileEntryCache.cache.cache.all(), 'to be empty');
      });

      it("should not affect the ModuleMap's in-memory contents", function () {
        expect(moduleMap, 'not to be empty');
      });

      describe('when a ModuleMap then updates & persists its file entry cache', function () {
        beforeEach(function () {
          moduleMap.fileEntryCache.save(moduleMap.files);
        });

        it('should add all known files back into the file entry cache', function () {
          // @ts-ignore
          expect(moduleMap.fileEntryCache.cache.cache.all(), 'not to be empty');
        });

        it("should not affect the ModuleMap's in-memory contents", function () {
          expect(moduleMap, 'not to be empty');
        });
      });
    });
  });

  describe('finding entry files affected by a file change', function () {
    beforeEach(function () {
      // this will effectively remove any "changed files" in memory from the file entry cache
      moduleMap.fileEntryCache.save(moduleMap.files);
    });

    describe('when a direct dependency of an entry file is known to have changed', function () {
      it('should return a list of related files', async function () {
        return expect(
          moduleMap.findAffectedFilesForChangedFiles({
            knownChangedFiles: [DEP_PATH],
          }),
          'to be fulfilled with',
          {
            entryFiles: new Set([
              TEST_WITH_DEP_PATH,
              TEST_WITH_TRANSITIVE_DEP_PATH,
            ]),
            allFiles: new Set([
              TEST_WITH_DEP_PATH,
              TEST_WITH_TRANSITIVE_DEP_PATH,
              TRANSITIVE_DEP_PATH,
              DEP_PATH,
            ]),
          }
        );
      });
    });

    describe('when an entry file itself is known to have changed', function () {
      it('should return a list of affected files', async function () {
        return expect(
          moduleMap.findAffectedFilesForChangedFiles({
            knownChangedFiles: [TEST_WITH_DEP_PATH],
          }),
          'to be fulfilled with',
          {
            entryFiles: new Set([TEST_WITH_DEP_PATH]),
            allFiles: new Set([TEST_WITH_DEP_PATH]),
          }
        );
      });
    });

    describe('when a transitive dependency of an entry file is known to have changed', function () {
      it('should return a list of affected files', async function () {
        return expect(
          moduleMap.findAffectedFilesForChangedFiles({
            knownChangedFiles: [TRANSITIVE_DEP_PATH],
          }),
          'to be fulfilled with',
          {
            entryFiles: new Set([TEST_WITH_TRANSITIVE_DEP_PATH]),
            allFiles: new Set([
              TEST_WITH_TRANSITIVE_DEP_PATH,
              TRANSITIVE_DEP_PATH,
            ]),
          }
        );
      });
    });

    describe('when an entry file which depends on another entry file is known to have changed', function () {
      it('should return a list of entry files');
    });

    describe('when a previously-unknown file is known to have changed', function () {
      it('should return no affected files', async function () {
        return expect(
          moduleMap.findAffectedFilesForChangedFiles({
            knownChangedFiles: [resolveFixturePath('hook.fixture.js')],
          }),
          'to be fulfilled with',
          {entryFiles: new Set(), allFiles: new Set()}
        );
      });
    });
  });
});

/**
 * @typedef {import('sinon').SinonStub} SinonStub
 */

/**
 * @typedef {import('sinon').SinonSpy} SinonSpy
 */
