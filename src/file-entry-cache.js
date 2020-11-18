'use strict';

const fileEntryCache = require('file-entry-cache');
const path = require('path');
const debug = require('debug')('mrca:file-entry-cache');
const {findCacheDir} = require('./util');

const {DEFAULT_FILE_ENTRY_CACHE_FILENAME} = require('./constants');

/**
 * A wrapper around the `file-entry-cache` module.
 *
 * You should not need to interface directly with this class.
 *
 * @see https://npm.im/file-entry-cache
 */
class FileEntryCache {
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
    /* istanbul ignore next */
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
   * @todo Do we need to allow `noPrune` to be `false`?
   * @param {Set<string>} filepaths - Filepaths to record
   * @returns {FileEntryCache}
   */
  save(filepaths = new Set()) {
    const normalized = this.cache.normalizeEntries([...filepaths]);
    this.cache.reconcile(true);
    /* istanbul ignore next */
    debug(
      'persisted file entry cache at %s with %d files',
      this.filepath,
      normalized.length
    );
    return this;
  }

  /**
   * Returns `true` if a filepath has changed since we last called {@link FileEntryCache#save}.
   * @param {string} filepath - Absolute path
   * @returns {boolean}
   */
  hasFileChanged(filepath) {
    return this.cache.hasFileChanged(filepath);
  }

  /**
   * Marks a filepath as "changed" by removing it from the underlying cache.
   * @param {string} filepath - Absolute path of file to remove from the underlying cache
   */
  markFileChanged(filepath) {
    this.cache.removeEntry(filepath);
    return this;
  }

  /**
   * Returns a `Set` of changed files based on the list provided.
   * Resets the state of all files to "not changed" until this method is run again
   * by calling {@link FileEntryCache#save}.
   * @param {Set<string>} filepaths - List of filepaths
   * @returns {Set<string>} Changed filepaths
   */
  yieldChangedFiles(filepaths) {
    const files = new Set(this.cache.getUpdatedFiles([...filepaths]));
    /* istanbul ignore next */
    debug('found %d changed out of %d known files', files.size, filepaths.size);
    this.save(filepaths);
    return files;
  }

  /**
   * Destroys the underlying cache.
   * @returns {FileEntryCache}
   */
  reset() {
    this.cache.destroy();
    /* istanbul ignore next */
    debug('destroyed file entry cache at %s', this.filepath);
    return this;
  }

  /**
   * Creates a {@link FileEntryCache}.
   * @param {FileEntryCacheOptions} [opts]
   * @returns {FileEntryCache}
   */
  static create(opts) {
    return new FileEntryCache(opts);
  }
}

exports.FileEntryCache = FileEntryCache;

/**
 * Options for {@link FileEntryCache} constructor.
 * @typedef {Object} FileEntryCacheOptions
 * @property {string} [cacheDir] - Explicit cache directory
 * @property {string} [filename] - Filename for cache
 * @property {string} [cwd] - Current working directory; affects location of cache dir if not provided
 */

/**
 * Options for {@link FileEntryCache#yieldChangedFiles}
 * @typedef {Object} YieldChangedFilesOptions
 * @property {Set<string>} filepaths - List of filepaths to check; defaults to all keys in the Map
 */
