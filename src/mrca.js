'use strict';

const debug = require('debug')('mrca');
const {findCacheDir} = require('./util');
const {ModuleGraph} = require('./module-graph');
const {FileEntryCache} = require('./file-entry-cache');
const {resolveDependencies} = require('./resolver');
const path = require('path');
const {EventEmitter} = require('events');
const sortKeys = require('sort-keys');

class MRCA extends EventEmitter {
  /**
   *
   * @param {MRCAOptions} opts
   */
  constructor({
    moduleGraphCacheFilename,
    fileEntryCacheFilename,
    cacheDir,
    reset = false,
    entryFiles = [],
    ignore = [],
    cwd = process.cwd(),
    tsConfigPath,
    webpackConfigPath,
    useRealPaths,
  } = {}) {
    super();
    /**
     * Current working directory
     * @type {string}
     */
    this.cwd = cwd;
    /**
     * Directory containing cache files
     * @type {string}
     */
    this.cacheDir = findCacheDir({dir: cacheDir, cwd: this.cwd});

    /**
     * Cache of the module map (cache of dep tree)
     * @type {ModuleGraph}
     */
    this.moduleGraph = ModuleGraph.create({
      filename: moduleGraphCacheFilename,
      cacheDir: this.cacheDir,
      cwd: this.cwd,
      useRealPaths,
    });

    /**
     * Cache of the file entry cache (tracks changes)
     */
    this.fileEntryCache = FileEntryCache.create({
      filename: fileEntryCacheFilename,
      cacheDir: this.cacheDir,
      cwd: this.cwd,
    });

    /**
     * List of entry files (top-level files)
     * @type {Set<string>}
     */
    this.entryFiles = new Set(entryFiles);

    /**
     * Globs to ignore
     * @type {Set<string>}
     */
    this.ignore = new Set(ignore);

    // ensure we don't accidentally end up watching the cache directory!
    this.ignore.add(this.cacheDir);
    debug('ignoring %o', this.ignore);
    /**
     * Path to TypeScript config file, if any
     * @type {string?}
     */
    this.tsConfigPath = tsConfigPath;

    /**
     * Path to Webpack config file, if any
     * @type {string?}
     */
    this.webpackConfigPath = webpackConfigPath;

    /**
     * When this resolves, the module map has been hydrated.
     * @type {Promise<void>}
     */
    this.ready = undefined;
    Object.defineProperty(this, 'ready', {
      value: this._init({reset})
        .then(() => {
          this.emit(MRCA.events.READY);
        })
        .catch((err) => {
          this.emit(MRCA.events.ERROR, err);
        }),
      enumerable: false,
    });
  }

  async _init({reset = false} = {}) {
    if (reset) {
      this.moduleGraph.reset();
      this.fileEntryCache.reset();
      debug('reset caches');
    }

    const newEntryFiles = new Set();
    for (const entryFile of this.entryFiles) {
      if (!this.moduleGraph.isEntryFile(entryFile)) {
        debug('known file %s became an entry file', entryFile);
        newEntryFiles.add(this.moduleGraph.set(entryFile, {isEntryFile: true}));
      }
    }

    const {changed, missing} = this._yieldChangedFiles(this.entryFiles);

    const changedFilepaths = new Set([
      ...newEntryFiles,
      ...changed,
      ...missing,
    ]);

    if (changedFilepaths.size) {
      debug('found %d changed files; hydrating', changedFilepaths.size);
      await this._hydrate(changedFilepaths);
      this.save();
    }
  }

  /**
   *
   * @param {Set<string>|string[]} filepaths
   */
  async _hydrate(filepaths) {
    let stack = [...filepaths];

    const seen = new Set();
    while (stack.length) {
      const toResolve = stack.filter((filepath) => !seen.has(filepath));

      if (toResolve.length) {
        const resolvedDeps = await this.findAllDependencies(toResolve);
        /* istanbul ignore next */
        debug(
          'found all deps for %d files: %o',
          toResolve.length,
          resolvedDeps
        );

        /**
         * @ignore
         * @type {Set<string>}
         */
        const next = new Set();
        for (const filepath of stack) {
          if (resolvedDeps.has(filepath)) {
            const {resolved: children, missing} = resolvedDeps.get(filepath);
            for (const child of children) {
              this.moduleGraph.set(child, {parents: new Set([filepath])});
              next.add(child);
            }
            for (const missingChild of missing) {
              this.moduleGraph.set(missingChild, {
                parents: new Set([filepath]),
                missing: true,
              });
            }
          }
          seen.add(filepath);
        }
        stack = [...next];
      } else {
        // no changed files found and/or we only found deps we've already processed
        stack = [];
      }
    }
  }

  /**
   * Returns a set of changed files
   * @ignore
   * @param {Set<string>} [filepaths] - List of files to check for changes
   * @returns {import('./file-entry-cache').FilesInfo}
   */
  _yieldChangedFiles(filepaths = this.moduleGraph.filepaths) {
    for (const filepath of filepaths) {
      if (!this.has(filepath)) {
        throw new ReferenceError(`expected file ${filepath} to be known`);
      }
    }
    const {changed, missing} = this.fileEntryCache.yieldChangedFiles(filepaths);
    if (missing.size) {
      for (const missingFile of missing) {
        this.moduleGraph.markMissing(missingFile);
        debug('marked %s as missing', missingFile);
      }
      this.save();
    } else if (changed.size) {
      this.save();
    }
    return {changed, missing};
  }

  /**
   * Persists the module map cache and optionally the file entry cache.
   * @param {Partial<SaveOptions>} opts - Options
   * @returns {MRCA}
   */
  save({persistFileEntryCache = false} = {}) {
    this.moduleGraph.save();
    debug('saved module graph cache at %s', this.moduleGraph.cacheFilepath);
    if (persistFileEntryCache) {
      this.fileEntryCache.save(this.moduleGraph.filepaths);
      debug('saved file entry cache at %s', this.fileEntryCache.filename);
    }
    return this;
  }

  /**
   *
   * @param {string} filepath
   */
  has(filepath) {
    return this.moduleGraph.has(filepath);
  }

  /**
   * Given a list of filepaths, return a `Map` keyed by filepath with the value being a `Set` of dependency paths
   * @param {Set<string>|string[]} filepaths - List of filepaths
   * @returns {Promise<DependencyInfo>}
   */
  async findAllDependencies(filepaths) {
    if (!filepaths || !filepaths[Symbol.iterator]) {
      throw new TypeError('expected a Set or array of filepaths');
    }
    const dependencies = new Map();
    /* istanbul ignore next */
    debug('finding all dependencies for: %o', filepaths);
    for (const filepath of filepaths) {
      const result = resolveDependencies(path.resolve(this.cwd, filepath), {
        cwd: this.cwd,
        ignore: this.ignore,
        tsConfigPath: this.tsConfigPath,
        webpackConfigPath: this.webpackConfigPath,
      });
      dependencies.set(filepath, result);
    }
    return dependencies;
  }

  /**
   * Given a list of filenames which potentially have changed recently, find all files which depend upon these files
   * @param {FindAffectedFilesOptions} [opts]
   * @returns {Promise<{entryFiles: Set<string>, allFiles: Set<string>}>} Zero or more files impacted by a given change
   */
  async findAffectedFilesForChangedFiles({knownChangedFiles = []} = {}) {
    knownChangedFiles = new Set(
      [...knownChangedFiles].map((filename) => path.resolve(this.cwd, filename))
    );

    for (const knownChangedFile of knownChangedFiles) {
      this.markFileChanged(knownChangedFile);
    }

    const {changed, missing} = this._yieldChangedFiles();

    const untrackedFilepaths = this.moduleGraph.filterUntrackedFiles([
      ...changed,
      ...missing,
    ]);

    /* istanbul ignore next */
    if (untrackedFilepaths.size) {
      debug(
        'found untracked changed (or missing) files: %o',
        untrackedFilepaths
      );
    }
    await this._hydrate(changed);

    return this._findAffectedFiles([...changed, ...missing]);
  }

  /**
   *
   * @param {string} filepath
   */
  markFileChanged(filepath) {
    this.fileEntryCache.markFileChanged(filepath);
    return this;
  }

  /**
   * Find affected files given a set of nodes
   * @param {Set<string>|string[]} filepaths
   * @returns {{allFiles: Set<string>, entryFiles: Set<string>}}
   */
  _findAffectedFiles(filepaths) {
    let affected = new Set();
    let entries = new Set();
    debug('finding all affected files in %o', filepaths);
    for (const filepath of filepaths) {
      affected.add(filepath);
      if (this.entryFiles.has(filepath)) {
        entries.add(filepath);
      }

      const {ancestors, entryFiles} = this.moduleGraph.getAncestors(filepath);
      debug('filepath %s has ancestors %o', filepath, ancestors);
      affected = new Set([...affected, ...ancestors]);
      entries = new Set([...entries, ...entryFiles]);
    }
    debug('entry files: %o', entries);
    debug('allFiles: %o', affected);
    return {allFiles: affected, entryFiles: entries};
  }

  /**
   * Adds an entry file to the map, and populates its dependences
   * @param {string} filepath
   * @returns {Promise<MRCA>}
   */
  async addEntryFile(filepath) {
    filepath = path.resolve(this.cwd, filepath);

    if (!this.entryFiles.has(filepath)) {
      this.entryFiles.add(filepath);
    }

    this.moduleGraph.set(filepath, {isEntryFile: true});
    if (this.has(filepath)) {
      /* istanbul ignore next */
      debug('marked file %s as an entry file', filepath);
    } else {
      await this._hydrate([filepath]);
      /* istanbul ignore next */
      debug('added new entry file %s', filepath);
    }
    return this;
  }

  async terminate() {}

  get filepaths() {
    return this.moduleGraph.filepaths;
  }

  get directories() {
    return this.moduleGraph.directories;
  }

  getFilesWithMissingDependencies() {}

  static create(opts) {
    return new MRCA(opts);
  }

  toJSON() {
    return sortKeys(
      {
        cacheDir: this.cacheDir,
        cwd: this.cwd,
        tsConfigPath: this.tsConfigPath,
        webpackConfigPath: this.webpackConfigPath,
        entryFiles: [...this.entryFiles],
        ignore: [...this.ignore],
        moduleGraph: this.moduleGraph.toJSON(),
      },
      {deep: true}
    );
  }

  clear() {
    this.moduleGraph.reset();
    return this;
  }
}

/**
 * @enum {string}
 */
MRCA.events = {
  READY: 'ready',
  ERROR: 'error',
};

exports.MRCA = MRCA;

/**
 * @typedef {Object} SaveOptions
 * @property {boolean} persistFileEntryCache - If true, save the file entry cache as well
 */

/**
 * Options for {@link ModuleMap#findAffectedFiles}
 * @typedef {Object} FindAffectedFilesOptions
 * @property {Set<string>|Array<string>} [knownChangedFiles] - A list of files to explicitly consider changed (as a hint)
 */

/**
 * Options for {@link MRCA}
 * @typedef {Object} MRCAOptions
 * @property {string} [moduleGraphCacheFilename] - Filename of on-disk module map cache
 * @property {string} [fileEntryCacheFilename] - Filename of on-disk file entry cache
 * @property {string} [cacheDir] - Path to Mocha-specific cache directory
 * @property {boolean} [reset] - If `true`, will obliterate caches
 * @property {string[]|Set<string>} [entryFiles] - List of test files
 * @property {string[]|Set<string>} [ignore] - List of ignored globs
 * @property {string} [cwd] - Current working directory
 * @property {string} [tsConfigPath] - Path to TypeScript config file
 * @property {string} [webpackConfigPath] - Path to Webpack config file
 * @property {boolean} [threaded] - If `true`, spawn resolver in a worker thread
 * @property {boolean} [useRealPaths] - If `true`, compute real paths for all modules
 */

/**
 * @typedef {Map<string,{resolved: Set<string>, missing: Set<string>}>} DependencyInfo
 */
