'use strict';

const {ThreadedModuleMap} = require('../../src/threaded-module-map');
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

describe.skip('threaded-module-map', function () {
  /**
   * @type {ThreadedModuleMap}
   */
  let tmm;

  beforeEach(async function () {
    tmm = ThreadedModuleMap.create({
      fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
      moduleMapCacheFilename: TEST_MODULE_MAP_CACHE_FILENAME,
      entryFiles: [TEST_WITH_DEP_PATH, TEST_WITH_TRANSITIVE_DEP_PATH],
      reset: true,
    });
    return Promise.all([tmm._online, tmm.ready]);
  });

  afterEach(async function () {
    sinon.restore();
    return tmm._worker.terminate();
  });

  describe('initialization', function () {
    it('should populate the ThreadedModuleMap with all entry files and dependencies thereof', async function () {
      expect(tmm, 'as JSON', 'to satisfy', {
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
  });
});
