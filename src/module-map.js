'use strict';

const path = require('path');
const debug = require('debug')('mrca:module-map');
const {FileEntryCache} = require('./file-entry-cache');
const {ModuleMapCache} = require('./module-map-cache');
const {resolveDependencies} = require('./resolver');
const {ModuleMapNode} = require('./module-map-node');
const {findCacheDir} = require('./util');
const {
  DEFAULT_MODULE_MAP_CACHE_FILENAME,
  DEFAULT_FILE_ENTRY_CACHE_FILENAME,
} = require('./constants');

/**
 * A very fancy `Map` which provides high-level information about dependency trees and file changes therein.
 *
 * This class is the main point of entry for this package; use {@link ModuleMap.create} to get going.
 * @extends {Map<string,ModuleMapNode>}
 */
class ModuleMap extends Map {
  /**
   * Initializes cache, map, loads from disk, finds deps, etc.
   * Cannot be instantiated like a normal map.
   * @param {Partial<ModuleMapOptions>} opts
   */
  constructor({
    moduleMapCacheFilename = DEFAULT_MODULE_MAP_CACHE_FILENAME,
    fileEntryCacheFilename = DEFAULT_FILE_ENTRY_CACHE_FILENAME,
    cacheDir,
    reset = false,
    entryFiles = [],
    ignore = [],
    cwd = process.cwd(),
    tsConfigPath,
    webpackConfigPath,
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
     * @type {ModuleMapCache}
     */
    this.moduleMapCache = ModuleMapCache.create({
      filename: moduleMapCacheFilename,
      cacheDir: this.cacheDir,
      cwd: this.cwd,
    });

    /**
     * Cache of the file entry cache (tracks changes)
     * @type {FileEntryCache}
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
     * Set to `true` after {@link ModuleMap#_init} has been called successfully.
     * @ignore
     */
    this._initialized = false;

    this._init({reset});

    debug(
      'instantiated ModuleMap <%s> with %d initial files and caches in %s',
      this.files.size,
      this.cacheDir
    );
  }

  /**
   * Like `Map#keys()` (for our purposes) but returns a `Set` instead.
   * @type {Set<string>}
   */
  get files() {
    return new Set([...this.keys()]);
  }

  /**
   * Returns a list of unique directories of all files
   * @type {Set<string>}
   */
  get directories() {
    const set = new Set();
    for (const filepath of this.files) {
      set.add(path.dirname(filepath));
    }
    return set;
  }

  /**
   * Returns a list of unique directories of all entry files
   * @type {Set<string>}
   */
  get entryDirectories() {
    const set = new Set();
    for (const filepath of this.entryFiles) {
      set.add(path.dirname(filepath));
    }
    return set;
  }

  /**
   * Returns a set of changed files
   * @ignore
   * @param {Set<string>} [filepaths] - List of files to check for changes
   * @returns {Set<string>}
   */
  _yieldChangedFiles(filepaths = this.files) {
    return this.fileEntryCache.yieldChangedFiles(filepaths);
  }

  /**
   * Initializes map from cache on disk.  Should only be called once, by constructor.
   * Re-populates map from entry files
   * Persists caches
   * @param {InitOptions} [opts] - Init options
   * @ignore
   * @returns {ModuleMap}
   */
  _init({reset = false, force = false} = {}) {
    if (!force && this._initialized) {
      // XXX: needs error code
      throw new Error('already initialized');
    }
    if (reset) {
      this.moduleMapCache.reset();
      this.fileEntryCache.reset();
    }
    this.mergeFromCache({destructive: true});

    // ensure we add unknown entry files
    for (const entryFile of this.entryFiles) {
      if (!this.has(entryFile)) {
        debug('added new entry file: %s', entryFile);
        this.set(entryFile, ModuleMapNode.create(entryFile));
      } else {
        debug('already know about entry file: %s', entryFile);
      }
    }
    // figure out what files have changed.
    // on a clean cache, this will return all the files
    const changedFiles = this._yieldChangedFiles(this.entryFiles);
    const nodes = this.getAll(changedFiles);

    /* istanbul ignore next */
    if (changedFiles.size > nodes.size) {
      debug(
        '%d files changed but are missing from the ModuleMap!',
        changedFiles.size - nodes.size
      );
    }

    if (nodes.size) {
      this._populate(nodes, {force: true});
    }

    this.moduleMapCache.save(this);

    this._initialized = true;

    return this;
  }

  /**
   * Persists both the module map cache and file entry cache.
   * @returns {ModuleMap}
   */
  save() {
    this.moduleMapCache.save(this);
    this.fileEntryCache.save(this.files);
    return this;
  }

  /**
   * Returns a JSON representation of the ModuleMap.
   * @returns {string}
   */
  toString() {
    return JSON.stringify(this.toJSON());
  }

  /**
   * Returns `true` if `filename` is an entry file.
   * If a relative path is provided, it's resolved from `this.cwd`.
   * @param {string} filename
   * @returns {boolean}
   */
  isEntryFile(filename) {
    return this.entryFiles.has(path.resolve(this.cwd, filename));
  }

  /**
   * Return a `Set<ModuleMapNode>` for the list of filenames provided.
   * Filenames not appearing in this map will not be included--in other words,
   * the `size` of the returned value may be less than the `size`/`length` of the `filenames` parameter.
   * @param {string[]|Set<string>} [filenames] - List of filenames
   * @returns {Set<ModuleMapNode>}
   */
  getAll(filenames = []) {
    const set = new Set();
    for (const filename of filenames) {
      if (this.has(filename)) {
        set.add(this.get(filename));
        /* istanbul ignore next */
      } else {
        debug('could not find %s in module map. corrupted?', filename);
      }
    }
    return set;
  }

  /**
   * Adds an entry file to the map, and populates its dependences
   * @param {string} filepath
   * @returns {ModuleMap}
   */
  addEntryFile(filepath) {
    filepath = path.resolve(this.cwd, filepath);

    if (!this.entryFiles.has(filepath)) {
      this.entryFiles.add(filepath);
    }

    if (this.has(filepath)) {
      debug('marked file %s as an entry file', filepath);
    } else {
      this.set(filepath, ModuleMapNode.create(filepath));
      this._populate([this.get(filepath)]);
      debug('added new entry file %s', filepath);
    }
    return this;
  }

  /**
   * Syncs module map cache _from_ disk
   * @param {Partial<MergeFromCacheOptions>} [opts] - Options
   * @returns {ModuleMap}
   */
  mergeFromCache({destructive = false} = {}) {
    if (destructive) {
      this.clear();
      debug('cleared in-memory ModuleMap');
    }

    const cacheValues = this.moduleMapCache.values();
    for (const {
      filename,
      children,
      entryFiles,
      parents,
    } of this.moduleMapCache.values()) {
      this.set(
        filename,
        ModuleMapNode.create(filename, {
          children: new Set(children),
          entryFiles: new Set(entryFiles),
          parents: new Set(parents),
        })
      );
    }
    debug(
      'merged %d files from on-disk cache into ModuleMap',
      cacheValues.size
    );
    return this;
  }

  /**
   * Removes a file from the map (and all references within the map's `ModuleMapNode` values)
   * @param {string} filepath
   * @override
   * @returns {boolean}
   */
  delete(filepath) {
    filepath = path.resolve(this.cwd, filepath);
    if (this.has(filepath)) {
      const {
        filename,
        children,
        parents,
      } = /** @type {ModuleMapNode} */ (this.get(filepath));

      for (const childFilepath of children) {
        const {parents} = this.get(childFilepath);
        parents.delete(filename);
        if (!parents.size) {
          this.delete(childFilepath);
          debug('cascading delete: %s', childFilepath);
        }
      }
      for (const parentFilepath of parents) {
        this.get(parentFilepath).children.delete(filename);
      }
      this.entryFiles.delete(filename);
    }
    return super.delete(filepath);
  }

  /**
   * Given one or more `ModuleMapNode`s, find dependencies and add them to the map.
   * @ignore
   * @param {Set<ModuleMapNode>|ModuleMapNode[]} nodes - One or more module nodes to find dependencies for
   */
  _populate(nodes, {force = false} = {}) {
    /**
     * @typedef {Object} PopulateStackEntry
     * @property {ModuleMapNode} node
     * @property {ModuleMapNode} [entryNode]
     * @ignore
     * */
    /**
     * @type {PopulateStackEntry[]}
     * @ignore
     */
    const stack = [];
    const seen = new Set();
    for (const node of nodes) {
      stack.push(
        this.entryFiles.has(node.filename) ? {node, entryNode: node} : {node}
      );
    }
    while (stack.length) {
      const {node, entryNode} = stack.pop();
      /** @type {Set<string>} */
      let children;
      if (force || this.fileEntryCache.hasFileChanged(node.filename)) {
        children = this.findDependencies(node.filename);
        node.children = children;
        debug('added %d children to %s', children.size, node.filename);
      } else {
        children = node.children;
      }
      // TODO I think entry files can get out-of-date here.  test it
      seen.add(node);
      for (const child of children) {
        const childNode = this.get(child) || ModuleMapNode.create(child);
        if (entryNode) {
          childNode.entryFiles.add(entryNode.filename);
        }
        childNode.parents.add(node.filename);
        this.set(child, childNode);
        if (!seen.has(childNode)) {
          stack.push({node: childNode, entryNode});
          seen.add(childNode);
        }
      }
    }
  }

  /**
   * Find all dependencies for `filepath`.
   *
   * You probably don't need to call this directly.
   * @param {string} filepath
   * @returns {Set<string>}
   */
  findDependencies(filepath) {
    return resolveDependencies(path.resolve(this.cwd, filepath), {
      cwd: this.cwd,
      ignore: this.ignore,
      tsConfigPath: this.tsConfigPath,
      webpackConfigPath: this.webpackConfigPath,
    });
  }

  /**
   * Marks a file as changed in-memory
   * @param {string} filepath - Filepath to mark changed
   * @returns {ModuleMap}
   */
  markFileAsChanged(filepath) {
    this.fileEntryCache.markFileChanged(filepath);
    return this;
  }

  /**
   * Find affected files given a set of nodes
   * @param {Set<ModuleMapNode>} nodes
   * @returns {{allFiles: Set<string>, entryFiles: Set<string>}}
   */
  findAffectedFiles(nodes) {
    const affected = new Set();
    const entries = new Set();
    for (const {filename, parents, entryFiles} of nodes) {
      affected.add(filename);
      if (this.entryFiles.has(filename)) {
        entries.add(filename);
      }
      for (const entryFile of entryFiles) {
        entries.add(entryFile);
        affected.add(entryFile);
      }

      const stack = [...parents];
      while (stack.length) {
        const parentFilename = stack.pop();
        if (!affected.has(parentFilename)) {
          affected.add(parentFilename);
          stack.push(...this.get(parentFilename).parents);
        }
      }
    }
    return {allFiles: affected, entryFiles: entries};
  }

  /**
   * Given a list of filenames which potentially have changed recently, find all files which depend upon these files
   * @param {FindAffectedFilesOptions} [opts]
   * @returns {{entryFiles: Set<string>, allFiles: Set<string>}} Zero or more files impacted by a given change
   */
  findAffectedFilesForChangedFiles({knownChangedFiles = []} = {}) {
    knownChangedFiles = new Set(
      [...knownChangedFiles].map((filename) => path.resolve(this.cwd, filename))
    );

    for (const knownChangedFile of knownChangedFiles) {
      this.markFileAsChanged(knownChangedFile);
    }

    const changedFilepaths = this._yieldChangedFiles();

    if (changedFilepaths.size) {
      let changedNodes = this.getAll(changedFilepaths);

      /* istanbul ignore next */
      if (changedNodes.size !== changedFilepaths.size) {
        debug(
          'found %d nodes for %d changed files; attemping sync from disk',
          changedNodes.size,
          changedFilepaths.size
        );
        this.mergeFromCache({destructive: true});
        changedNodes = this.getAll(changedFilepaths);
        if (changedNodes.size !== changedFilepaths.size) {
          debug('syncing from disk did not help; rebuilding');
          this._init({reset: true, force: true});
          changedNodes = this.getAll(changedFilepaths);
          if (changedNodes.size === changedFilepaths.size) {
            debug('successfully reconciled map');
          } else {
            debug(
              'found %d nodes for %d changed files; just gonna go with that',
              changedNodes.size,
              changedFilepaths.size
            );
          }
        }
      }
      this._populate(changedNodes);

      return this.findAffectedFiles(changedNodes);
    } else {
      debug('no changed files!');
      return {entryFiles: new Set(), allFiles: new Set()};
    }
  }

  /**
   * Returns a stable object representation of this ModuleMap.
   * Keys (filenames) will be sorted; values (`ModuleMapNode`
   * instances) will be the result of calling {@link ModuleMapNode#toJSON()} on each
   * @returns {Object<string,ModuleMapNodeJSON>}
   */
  toJSON() {
    return [...this]
      .sort(([filenameA], [filenameB]) => filenameA.localeCompare(filenameB))
      .reduce(
        (acc, [filename, node]) => ({...acc, [filename]: node.toJSON()}),
        {}
      );
  }

  /**
   * Create a new `ModuleMap` instance
   * @param {Partial<ModuleMapOptions>} [opts] - Options
   */
  static create(opts) {
    return new ModuleMap(opts);
  }
}

exports.ModuleMap = ModuleMap;

/**
 * Options for {@link ModuleMap}
 * @typedef {Object} ModuleMapOptions
 * @property {string} moduleMapCacheFilename - Filename of on-disk module map cache
 * @property {string} fileEntryCacheFilename - Filename of on-disk file entry cache
 * @property {string} cacheDir - Path to Mocha-specific cache directory
 * @property {boolean} reset - If `true`, will obliterate caches
 * @property {string[]|Set<string>} entryFiles - List of test files
 * @property {string[]|Set<string>} ignore - List of ignored globs
 * @property {string} cwd - Current working directory
 * @property {string} tsConfigPath - Path to TypeScript config file
 * @property {string} webpackConfigPath - Path to Webpack config file
 */

/**
 * Options for {@link ModuleMap#findAffectedFiles}
 * @typedef {Object} FindAffectedFilesOptions
 * @property {Set<string>|Array<string>} [knownChangedFiles] - A list of files to explicitly consider changed (as a hint)
 */

/**
 * Options for {@link ModuleMap#init}
 * @typedef {Object} InitOptions
 * @property {boolean} [reset] - If `true` will obliterate caches
 * @property {boolean} [force] - If `true`, force re-init. Normally should only be called once
 */

/**
 * @typedef {import('./module-map-node').ModuleMapNodeJSON} ModuleMapNodeJSON
 */
/**
 * Options for {@link ModuleMapNode#mergeFromCache}.
 * @typedef {Object} MergeFromCacheOptions
 * @property {boolean} destructive - If true, destroy the in-memory cache
 */
