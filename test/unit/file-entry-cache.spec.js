'use strict';

const sinon = require('sinon');
const rewiremock = require('rewiremock/node');
const expect = require('../expect');

const DUMMY_CACHE_DIR = '/dummy/cache/dir';

describe('FileEntryCache', function () {
  let FileEntryCache;
  let mocks;

  afterEach(function () {
    sinon.restore();
  });

  beforeEach(function () {
    const stubs = {
      'file-entry-cache': {
        destroy: sinon.stub(),
        getUpdatedFiles: sinon.stub().returns([]),
        reconcile: sinon.stub(),
        hasFileChanged: sinon.stub().returns(true),
        normalizeEntries: sinon.stub().returns([]),
        removeEntry: sinon.stub(),
      },
    };

    mocks = {
      'file-entry-cache': {
        create: sinon.spy(() => Object.create(stubs['file-entry-cache'])),
      },
      util: {
        findCacheDir: sinon.stub().returns(DUMMY_CACHE_DIR),
      },
      constants: {
        DEFAULT_FILE_ENTRY_CACHE_FILENAME: 'happy-cache.json',
      },
    };
    const fileEntryCacheModule = rewiremock.proxy(
      () => require('../../src/file-entry-cache'),
      (r) => ({
        'file-entry-cache': r.with(mocks['file-entry-cache']).directChildOnly(),
        [require.resolve('../../src/util')]: r
          .with(mocks.util)
          .directChildOnly(),
        [require.resolve('../../src/constants')]: r
          .with(mocks.constants)
          .directChildOnly(),
      })
    );
    FileEntryCache = fileEntryCacheModule.FileEntryCache;
  });

  describe('constructor', function () {
    describe('when no cacheDir provided', function () {
      it('should find and/or create a default cache dir', function () {
        FileEntryCache.create();
        expect(mocks.util.findCacheDir, 'to have a call satisfying', [
          {dir: undefined, cwd: process.cwd()},
        ]);
      });
    });

    describe('when a cacheDir provided', function () {
      it('should create the cache dir, if needed', function () {
        FileEntryCache.create({cacheDir: DUMMY_CACHE_DIR});
        expect(mocks.util.findCacheDir, 'to have a call satisfying', [
          {dir: DUMMY_CACHE_DIR, cwd: process.cwd()},
        ]);
      });
    });

    describe('when a cwd provided', function () {
      it('should use the cwd to find the cache dir', function () {
        FileEntryCache.create({cwd: DUMMY_CACHE_DIR});
        expect(mocks.util.findCacheDir, 'to have a call satisfying', [
          {dir: undefined, cwd: DUMMY_CACHE_DIR},
        ]);
      });
    });

    describe('when no cwd provided', function () {
      it('should use the cwd of the process to find the cache dir', function () {
        FileEntryCache.create();
        expect(mocks.util.findCacheDir, 'to have a call satisfying', [
          {dir: undefined, cwd: process.cwd()},
        ]);
      });
    });

    it('should create an on-disk cache', function () {
      FileEntryCache.create();
      expect(mocks['file-entry-cache'].create, 'to have a call satisfying', [
        mocks.constants.DEFAULT_FILE_ENTRY_CACHE_FILENAME,
        DUMMY_CACHE_DIR,
      ]);
    });
  });
});
