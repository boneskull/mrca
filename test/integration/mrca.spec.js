'use strict';

const mockFs = require('mock-fs');
const {promises: fs} = require('fs');
const {MRCA} = require('../../src/mrca');
const {FileEntryCache} = require('../../src/file-entry-cache');
const sinon = require('sinon');
const path = require('path');
const expect = require('../expect');
const os = require('os');

/**
 * @param {string} filename
 */
const resolveFixturePath = (filename) =>
  path.join(__dirname, 'fixtures', filename);

const TEST_CACHE_DIR = path.join(os.tmpdir(), 'mocha-test-mrca');
const TEST_MODULE_GRAPH_CACHE_FILENAME =
  'module-graph-integration-test.cache.json';
const TEST_FILE_ENTRY_CACHE_FILENAME = 'file-entry-integration-test.cache.json';
const TEST_WITH_DEP_PATH = resolveFixturePath(
  'test-with-dependency.fixture.js'
);
const DEP_PATH = resolveFixturePath('dependency.fixture.js');
const TEST_WITH_TRANSITIVE_DEP_PATH = resolveFixturePath(
  'test-with-transitive-dep.fixture.js'
);
const TRANSITIVE_DEP_PATH = resolveFixturePath('transitive-dep.fixture.js');

describe('mrca', function () {
  /**
   * @type {MRCA}
   */
  let mrca;

  afterEach(function () {
    mockFs.restore();
    sinon.restore();
  });

  beforeEach(function () {
    mrca = MRCA.create({
      fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
      moduleGraphCacheFilename: TEST_MODULE_GRAPH_CACHE_FILENAME,
      entryFiles: [TEST_WITH_DEP_PATH, TEST_WITH_TRANSITIVE_DEP_PATH],
      cacheDir: TEST_CACHE_DIR,
      reset: true,
    });
  });

  describe('initialization', function () {
    it('should populate the MRCA with all entry files and dependencies thereof', function () {
      expect(mrca.moduleGraph, 'as JSON', 'to satisfy', {
        cacheDir: TEST_CACHE_DIR,
        cwd: process.cwd(),
        filename: TEST_MODULE_GRAPH_CACHE_FILENAME,
        graph: {
          attributes: {},
          edges: [
            {
              source: DEP_PATH,
              target: TEST_WITH_DEP_PATH,
            },
            {
              source: DEP_PATH,
              target: TEST_WITH_TRANSITIVE_DEP_PATH,
            },
            {
              source: TRANSITIVE_DEP_PATH,
              target: TEST_WITH_TRANSITIVE_DEP_PATH,
            },
            {
              source: DEP_PATH,
              target: TRANSITIVE_DEP_PATH,
            },
          ],
          nodes: [
            {
              attributes: {entryFile: true},
              key: TEST_WITH_DEP_PATH,
            },
            {
              attributes: {entryFile: true},
              key: TEST_WITH_TRANSITIVE_DEP_PATH,
            },
            {
              key: DEP_PATH,
            },
            {
              key: TRANSITIVE_DEP_PATH,
            },
          ],
          options: {allowSelfLoops: true, multi: false, type: 'directed'},
        },
        useRealPaths: expect.it('to be a boolean'),
      });
    });

    describe.only('when reloading', function () {
      describe('when known entry files were previously persisted to file entry cache', function () {
        beforeEach(function () {
          mrca.fileEntryCache.save(mrca.filepaths);
        });

        it('should inspect new (unknown) entry files', async function () {
          const someOtherFile = resolveFixturePath(
            'test-file-change.fixture.js'
          );
          const mrca2 = MRCA.create({
            fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
            moduleGraphCacheFilename: TEST_MODULE_GRAPH_CACHE_FILENAME,
            entryFiles: [
              TEST_WITH_DEP_PATH,
              TEST_WITH_TRANSITIVE_DEP_PATH,
              someOtherFile,
            ],
            cacheDir: TEST_CACHE_DIR,
          });

          await mrca2.ready;
          expect(mrca2.moduleGraph, 'as JSON', 'to satisfy', {
            cacheDir: TEST_CACHE_DIR,
            cwd: process.cwd(),
            filename: TEST_MODULE_GRAPH_CACHE_FILENAME,
            graph: {
              attributes: {},
              edges: [
                {
                  source: DEP_PATH,
                  target: TEST_WITH_DEP_PATH,
                },
                {
                  source: DEP_PATH,
                  target: TRANSITIVE_DEP_PATH,
                },
                {
                  source: TRANSITIVE_DEP_PATH,
                  target: TEST_WITH_TRANSITIVE_DEP_PATH,
                },
              ],
              nodes: [
                {
                  key: DEP_PATH,
                },
                {
                  attributes: {entryFile: true},
                  key: someOtherFile,
                },
                {
                  attributes: {entryFile: true},
                  key: TEST_WITH_DEP_PATH,
                },
                {
                  attributes: {entryFile: true},
                  key: TEST_WITH_TRANSITIVE_DEP_PATH,
                },
                {
                  key: TRANSITIVE_DEP_PATH,
                },
              ],
              options: {allowSelfLoops: true, multi: false, type: 'directed'},
            },
            useRealPaths: expect.it('to be a boolean'),
          });
        });
      });

      describe('when known entry files were not previously persisted to file entry cache', function () {
        beforeEach(async function () {
          mrca.fileEntryCache.reset();
        });

        it('should inspect all entry files', async function () {
          const someOtherFile = resolveFixturePath(
            'test-file-change.fixture.js'
          );
          const mrca2 = MRCA.create({
            fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
            moduleGraphCacheFilename: TEST_MODULE_GRAPH_CACHE_FILENAME,
            entryFiles: [
              TEST_WITH_DEP_PATH,
              TEST_WITH_TRANSITIVE_DEP_PATH,
              someOtherFile,
            ],
            cacheDir: TEST_CACHE_DIR,
          });
          await mrca2.ready;
          expect(mrca2.moduleGraph, 'as JSON', 'to satisfy', {
            cacheDir: TEST_CACHE_DIR,
            cwd: process.cwd(),
            filename: TEST_MODULE_GRAPH_CACHE_FILENAME,
            graph: {
              attributes: {},
              edges: [
                {
                  source: DEP_PATH,
                  target: TEST_WITH_DEP_PATH,
                },
                {
                  source: DEP_PATH,
                  target: TRANSITIVE_DEP_PATH,
                },
                {
                  source: TRANSITIVE_DEP_PATH,
                  target: TEST_WITH_TRANSITIVE_DEP_PATH,
                },
              ],
              nodes: [
                {
                  key: DEP_PATH,
                },
                {
                  attributes: {entryFile: true},
                  key: someOtherFile,
                },
                {
                  attributes: {entryFile: true},
                  key: TEST_WITH_DEP_PATH,
                },
                {
                  attributes: {entryFile: true},
                  key: TEST_WITH_TRANSITIVE_DEP_PATH,
                },
                {
                  key: TRANSITIVE_DEP_PATH,
                },
              ],
              options: {allowSelfLoops: true, multi: false, type: 'directed'},
            },
            useRealPaths: expect.it('to be a boolean'),
          });
        });
      });

      describe('when an entry file has changed', function () {
        beforeEach(async function () {
          mockFs({
            // [someOtherFile]: mockFs.load(someOtherFile),
            [path.join(
              TEST_CACHE_DIR,
              TEST_FILE_ENTRY_CACHE_FILENAME
            )]: mockFs.load(
              path.join(TEST_CACHE_DIR, TEST_FILE_ENTRY_CACHE_FILENAME)
            ),
            [path.join(
              TEST_CACHE_DIR,
              TEST_MODULE_GRAPH_CACHE_FILENAME
            )]: mockFs.load(
              path.join(TEST_CACHE_DIR, TEST_MODULE_GRAPH_CACHE_FILENAME)
            ),
            [path.join(__dirname, 'fixtures')]: mockFs.load(
              path.join(__dirname, 'fixtures')
            ),
            [path.join(process.cwd(), 'node_modules')]: mockFs.load(
              path.join(process.cwd(), 'node_modules')
            ),
          });
          await fs.writeFile(
            TEST_WITH_TRANSITIVE_DEP_PATH,
            `require('./dependency.fixture.js')`
          );
        });

        it('should inspect all changed and new entry files', async function () {
          const mrca2 = MRCA.create({
            fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
            moduleGraphCacheFilename: TEST_MODULE_GRAPH_CACHE_FILENAME,
            entryFiles: [TEST_WITH_DEP_PATH, TEST_WITH_TRANSITIVE_DEP_PATH],
            cacheDir: TEST_CACHE_DIR,
            reset: false,
          });
          await mrca2.ready;
          expect(mrca2.moduleGraph, 'as JSON', 'to satisfy', {
            cacheDir: TEST_CACHE_DIR,
            cwd: process.cwd(),
            filename: TEST_MODULE_GRAPH_CACHE_FILENAME,
            graph: {
              attributes: {},
              edges: expect.it('to equal', [
                {
                  source: DEP_PATH,
                  target: TEST_WITH_DEP_PATH,
                },
                {
                  source: DEP_PATH,
                  target: TEST_WITH_TRANSITIVE_DEP_PATH,
                },
              ]),
              nodes: [
                {
                  key: DEP_PATH,
                },
                {
                  attributes: {entryFile: true},
                  key: TEST_WITH_DEP_PATH,
                },
                {
                  attributes: {entryFile: true},
                  key: TEST_WITH_TRANSITIVE_DEP_PATH,
                },
              ],
              options: {allowSelfLoops: true, multi: false, type: 'directed'},
            },
            useRealPaths: expect.it('to be a boolean'),
          });
        });
      });

      describe('when a known dependency has changed', function () {
        beforeEach(async function () {
          mockFs({
            [path.join(
              TEST_CACHE_DIR,
              TEST_FILE_ENTRY_CACHE_FILENAME
            )]: mockFs.load(
              path.join(TEST_CACHE_DIR, TEST_FILE_ENTRY_CACHE_FILENAME)
            ),
            [path.join(
              TEST_CACHE_DIR,
              TEST_MODULE_GRAPH_CACHE_FILENAME
            )]: mockFs.load(
              path.join(TEST_CACHE_DIR, TEST_MODULE_GRAPH_CACHE_FILENAME)
            ),
            [path.join(__dirname, 'fixtures')]: mockFs.load(
              path.join(__dirname, 'fixtures')
            ),
            [path.join(process.cwd(), 'node_modules')]: mockFs.load(
              path.join(process.cwd(), 'node_modules')
            ),
          });
          await fs.writeFile(TRANSITIVE_DEP_PATH, '');
        });

        it('should inspect all changed dependencies', async function () {
          const mrca2 = MRCA.create({
            fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
            moduleGraphCacheFilename: TEST_MODULE_GRAPH_CACHE_FILENAME,
            entryFiles: [TEST_WITH_DEP_PATH, TEST_WITH_TRANSITIVE_DEP_PATH],
            cacheDir: TEST_CACHE_DIR,
            reset: false,
          });
          await mrca2.ready;
          expect(mrca2.moduleGraph, 'as JSON', 'to satisfy', {
            cacheDir: TEST_CACHE_DIR,
            cwd: process.cwd(),
            filename: TEST_MODULE_GRAPH_CACHE_FILENAME,
            graph: {
              attributes: {},
              edges: [
                {
                  source: DEP_PATH,
                  target: TEST_WITH_DEP_PATH,
                },
                {
                  source: TRANSITIVE_DEP_PATH,
                  target: TEST_WITH_TRANSITIVE_DEP_PATH,
                },
              ],
              nodes: [
                {
                  key: DEP_PATH,
                },
                {
                  attributes: {entryFile: true},
                  key: TEST_WITH_DEP_PATH,
                },
                {
                  attributes: {entryFile: true},
                  key: TEST_WITH_TRANSITIVE_DEP_PATH,
                },
                {
                  key: TRANSITIVE_DEP_PATH,
                },
              ],
              options: {allowSelfLoops: true, multi: false, type: 'directed'},
            },
            useRealPaths: expect.it('to be a boolean'),
          });
        });
      });
    });
  });

  describe('merging from disk', function () {
    describe('when run w/ option `destructive = true`', function () {
      it('should overwrite the MRCA contents', function () {
        mrca.set('/some/file', MRCANode.create('/some/file'));
        mrca.mergeFromCache({destructive: true});
        expect(mrca, 'not to have key', '/some/file').and(
          'to have key',
          TEST_WITH_DEP_PATH
        );
      });
    });

    describe('when run w/o options', function () {
      it('should merge into the MRCA contents', function () {
        mrca.set('/some/file', MRCANode.create('/some/file'));
        mrca.mergeFromCache();
        expect(mrca, 'to have key', '/some/file').and(
          'to have key',
          TEST_WITH_DEP_PATH
        );
      });
    });
  });

  describe('module map cache destruction', function () {
    describe('when a new MRCA is instantiated with a previously-reset module map cache', function () {
      beforeEach(function () {
        mrca.moduleMapCache.reset();
      });

      it('should be empty', function () {
        expect(
          MRCA.create({
            fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
            moduleGraphCacheFilename: TEST_MODULE_GRAPH_CACHE_FILENAME,
          }),
          'to be empty'
        );
      });
    });

    describe('when a MRCA has had its module map cache previously reset', function () {
      beforeEach(function () {
        mrca.moduleMapCache.reset();
      });

      it("should not affect the MRCA's in-memory contents", function () {
        expect(mrca, 'not to be empty');
      });

      describe('when a MRCA then persists its in-memory contents', function () {
        beforeEach(function () {
          mrca.moduleMapCache.save(mrca);
        });

        it('should contain a non-empty module map cache', function () {
          expect(mrca.moduleMapCache.values(), 'not to be empty');
        });

        it("should not affect the MRCA's in-memory contents", function () {
          expect(mrca, 'not to be empty');
        });
      });
    });
  });

  describe('file entry cache destruction', function () {
    describe('when a new MRCA is instantiated with a previously-reset file entry cache', function () {
      beforeEach(async function () {
        await mrca.ready;
        mrca.fileEntryCache.reset();
      });

      it('should repopulate the file entry cache', async function () {
        const moduleMap2 = MRCA.create({
          fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
          moduleGraphCacheFilename: TEST_MODULE_GRAPH_CACHE_FILENAME,
          entryFiles: [TEST_WITH_DEP_PATH, TEST_WITH_TRANSITIVE_DEP_PATH],
        });
        await moduleMap2.ready;
        // @ts-ignore
        expect(moduleMap2.fileEntryCache.cache.cache.all(), 'not to be empty');
      });
    });

    describe('when a MRCA has had its file entry cache previously reset', function () {
      beforeEach(function () {
        mrca.fileEntryCache.reset();
      });

      it('should clear the file entry cache', function () {
        // @ts-ignore
        expect(mrca.fileEntryCache.cache.cache.all(), 'to be empty');
      });

      it("should not affect the MRCA's in-memory contents", function () {
        expect(mrca, 'not to be empty');
      });

      describe('when a MRCA then updates & persists its file entry cache', function () {
        beforeEach(function () {
          mrca.fileEntryCache.save(mrca.files);
        });

        it('should add all known files back into the file entry cache', function () {
          // @ts-ignore
          expect(mrca.fileEntryCache.cache.cache.all(), 'not to be empty');
        });

        it("should not affect the MRCA's in-memory contents", function () {
          expect(mrca, 'not to be empty');
        });
      });
    });
  });

  describe('finding entry files affected by a file change', function () {
    beforeEach(function () {
      // this will effectively remove any "changed files" in memory from the file entry cache
      mrca.fileEntryCache.save(mrca.files);
    });

    describe('when a direct dependency of an entry file is known to have changed', function () {
      it('should return a list of related files', async function () {
        return expect(
          mrca.findAffectedFilesForChangedFiles({
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
          mrca.findAffectedFilesForChangedFiles({
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
          mrca.findAffectedFilesForChangedFiles({
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
          mrca.findAffectedFilesForChangedFiles({
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
