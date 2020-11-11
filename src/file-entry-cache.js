'use strict';

const fileEntryCache = require('file-entry-cache');
const path = require('path');
const debug = require('debug')('mrca:file-entry-cache');
const {findCacheDir} = require('./util');

const {DEFAULT_FILE_ENTRY_CACHE_FILENAME} = require('./constants');

exports.FileEntryCache = class FileEntryCache {
  /**
   * Finds an appropriate cache dir (if necessary) and creates the cache on-disk.
   * @param {FileEntryCacheOptions} [opts]
   */
  constructor({
    cacheDir,
    filename = DEFAULT_FILE_ENTRY_CACHE_FILENAME,
    cwd = process.cwd(),
  } = {}) {
    this.cwd = cwd;
    this.cacheDir = findCacheDir({dir: cacheDir, cwd: this.cwd});
    this.filename = filename;
    this.cache = fileEntryCache.create(this.filename, this.cacheDir);
    debug('created/loaded file entry cache at %s', this.filepath);
  }

  /**
   * Full filepath of the cache on disk
   * @type {string}
   */
  get filepath() {
    return path.resolve(this.cacheDir, this.filename);
  }

  /**
   * Persists file entry cache to disk
   * @todo Do we need to accept an optional list of filenames?
   * @todo Do we need to allow `noPrune` to be `false`?
   * @returns {FileEntryCache}
   */
  save() {
    this.cache.normalizeEntries();
    this.cache.reconcile(true);
    debug('persisted file entry cache at %s', this.filepath);
    return this;
  }

  /**
   *
   * @param {string} filepath - Filename
   * @returns {boolean}
   */
  hasFileChanged(filepath) {
    return this.cache.hasFileChanged(filepath);
  }

  markFileChanged(filepath) {
    this.cache.removeEntry(filepath);
    return this;
  }

  /**
   * Returns a `Set` of changed files out of those provided.
   * If no filepaths provided, returns list of all _known_ changed files.
   * Resets the state of all files to "not changed" until this method is run again.
   * @param {string[]|Set<string>} [filepaths] - Filepaths to check for changes
   * @returns {Set<string>} Changed filepaths
   */
  yieldChangedFiles(filepaths = []) {
    filepaths = new Set(filepaths);
    const files = new Set(this.cache.getUpdatedFiles([...filepaths]));
    debug('found %d changed out of %d known files', files.size, filepaths.size);
    this.save();
    return files;
  }

  reset() {
    this.cache.destroy();
    debug('destroyed file entry cache at %s', this.filepath);
    return this;
  }

  /**
   *
   * @param {FileEntryCacheOptions} [opts]
   */
  static create(opts) {
    return new FileEntryCache(opts);
  }
};

/**
 * @typedef {Object} FileEntryCacheOptions
 * @property {string} [cacheDir] - Explicit cache directory
 * @property {string} [filename] - Filename for cache
 * @property {string} [cwd] - Current working directory; affects location of cache dir if not provided
 */
