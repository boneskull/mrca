'use strict';

const flatCache = require('flat-cache');
const path = require('path');
const debug = require('debug')('mrca:module-map-cache');
const {findCacheDir} = require('./util');

const {DEFAULT_MODULE_MAP_CACHE_FILENAME} = require('./constants');

/**
 * A wrapper around a `flat-cache` object keyed on filepath and containing
 * {@link ModuleMapNode} values. Essentially an on-disk representation of
 * a {@link ModuleMap}.
 *
 * You should not need to interface with this class directly.
 *
 * @see https://npm.im/flat-cache
 */
class ModuleMapCache {
  /**
   * Finds an appropriate cache dir (if necessary) and creates the cache on-disk.
   * @param {ModuleMapCacheOptions} [opts]
   */
  constructor({
    cacheDir,
    filename = DEFAULT_MODULE_MAP_CACHE_FILENAME,
    cwd = process.cwd(),
  } = {}) {
    /**
     * Current working directory
     * @type {string}
     */
    this.cwd = cwd;

    /**
     * @type {string}
     */
    this.cacheDir = findCacheDir({dir: cacheDir, cwd: this.cwd});

    /**
     * Filename of cache file
     * @type {string}
     */
    this.filename = filename;

    /**
     * Underlying cache object
     * @type {import('flat-cache').Cache}
     */
    this.cache = flatCache.create(this.filename, this.cacheDir);
    debug('created/loaded module mapcache at %s', this.filepath);
  }

  /**
   * Full filepath of the cache on disk
   * @type {string}
   */
  get filepath() {
    return path.resolve(this.cacheDir, this.filename);
  }

  /**
   * Persists the contents of a string-keyed `Map` to disk in cache
   * @todo Do we need to allow `noPrune` to be `false`?
   * @param {Map<string,any>} map - Map
   * @returns {ModuleMapCache}
   */
  save(map) {
    for (const [key, value] of map) {
      this.cache.setKey(key, value);
    }

    this.cache.save();
    debug(
      'persisted module map cache at %s with %d entries',
      this.filepath,
      this.cache.keys().length
    );
    return this;
  }

  /**
   * Return a `Set` of all _values_ contained in the cache.
   *
   * When consumed by {@link ModuleMap}, this is a `Set` of {@link ModuleMapNode} objects.
   * @returns {Set<any>}
   */
  values() {
    return new Set(Object.values(this.cache.all()));
  }

  /**
   * Destroys the on-disk cache.
   * @returns {ModuleMapCache}
   */
  reset() {
    this.cache.destroy();
    debug('destroyed module map cache at %s', this.filepath);
    return this;
  }

  /**
   * Constructs a {@link ModuleMapCache}.
   * @param {ModuleMapCacheOptions} [opts]
   * @returns {ModuleMapCache}
   */
  static create(opts) {
    return new ModuleMapCache(opts);
  }
}

exports.ModuleMapCache = ModuleMapCache;

/**
 * Options for {@link ModuleMapCache} constructor.
 * @typedef {Object} ModuleMapCacheOptions
 * @property {string} [cacheDir] - Explicit cache directory
 * @property {string} [filename] - Filename for cache
 * @property {string} [cwd] - Current working directory; affects location of cache dir if not provided
 */
