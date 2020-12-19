'use strict';

const {ThreadedMRCA} = require('../../src/threaded-mrca');
const sinon = require('sinon');
const path = require('path');
const expect = require('../expect');

/**
 * @param {string} filename
 */
const resolveFixturePath = (filename) =>
  path.join(__dirname, 'fixtures', filename);

const TEST_MODULE_GRAPH_CACHE_FILENAME =
  'threaded-module-graph-integration-test.cache.json';
const TEST_FILE_ENTRY_CACHE_FILENAME =
  'threaded-file-entry-integration-test.cache.json';
const TEST_WITH_DEP_PATH = resolveFixturePath(
  'test-with-dependency.fixture.js'
);
const DEP_PATH = resolveFixturePath('dependency.fixture.js');
const TEST_WITH_TRANSITIVE_DEP_PATH = resolveFixturePath(
  'test-with-transitive-dep.fixture.js'
);
const TRANSITIVE_DEP_PATH = resolveFixturePath('transitive-dep.fixture.js');

describe('threaded-mrca', function () {
  /**
   * @type {ThreadedMRCA}
   */
  let tmrca;

  beforeEach(async function () {
    tmrca = ThreadedMRCA.create({
      fileEntryCacheFilename: TEST_FILE_ENTRY_CACHE_FILENAME,
      moduleGraphCacheFilename: TEST_MODULE_GRAPH_CACHE_FILENAME,
      entryFiles: [TEST_WITH_DEP_PATH, TEST_WITH_TRANSITIVE_DEP_PATH],
      reset: true,
    });
    return tmrca.ready;
  });

  afterEach(async function () {
    sinon.restore();
    return tmrca._worker.terminate();
  });

  describe('initialization', function () {
    it('should populate the ThreadedMRCA with all entry files and dependencies thereof', function () {
      expect(tmrca.moduleGraph, 'as JSON', 'to satisfy', {
        cacheDir: /\.cache\/mocha/,
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
  });
});
