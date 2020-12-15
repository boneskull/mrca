'use strict';

const dependencyTree = require('dependency-tree');
const {resolve, extname} = require('path');
const multimatch = require('multimatch');
const debug = require('debug')('mrca:resolver');
const {existsSync} = require('fs');
const {EventEmitter} = require('events');

const constants = {
  /**
   * Default name of webpack config file
   */
  DEFAULT_WEBPACK_CONFIG_FILENAME: 'webpack.config.js',

  /**
   * Default name of TypeScript config file
   */
  DEFAULT_TS_CONFIG_FILENAME: 'tsconfig.json',

  /**
   * Event emitted by {@link Resolver} when it has resolved dependencies for a file
   */
  EVENT_RESOLVED_DEPENDENCIES: 'resolved-dependencies',

  /**
   * List of extensions to interpret as TypeScript
   */
  EXTENSIONS_TS: new Set(['.ts', '.tsx']),

  /**
   * List of extensions to interpret as JavaScript
   */
  EXTENSIONS_JS: new Set(['.js', '.jsx', '.mjs', '.cjs']),
};

/**
 * A class which helps resolve dependencies.
 *
 * Unless you need to listen for the events emitted by this class, use {@link Resolver.resolveDependencies} instead.
 */
class Resolver extends EventEmitter {
  /**
   * Sets some lovely instance properties
   * @param {Partial<ResolverOptions>} [opts]
   */
  constructor({
    cwd = process.cwd(),
    tsConfigPath,
    webpackConfigPath,
    ignore = new Set(),
  } = {}) {
    super();
    /**
     * Object for `dependency-tree` to track "seen" modules
     * @private
     */
    this._cache = Object.create(null);
    /**
     * Current working directory
     * @type {string}
     */
    this.cwd = cwd;
    /**
     * Path to TS config file
     * @type {string}
     */
    this.tsConfigPath = tsConfigPath;
    /**
     * Path to webpack config file
     * @type {string}
     */
    this.webpackConfigPath = webpackConfigPath;
    /**
     * Paths/globs to ignore
     * @type {Set<string>}
     */
    this.ignore = new Set([...ignore]);

    /* istanbul ignore next */
    if (require('debug').enabled('mrca:resolver')) {
      this.on(
        constants.EVENT_RESOLVED_DEPENDENCIES,
        /** @param {ResolvedDependenciesEventData} data */ (data) => {
          debug('event EVENT_RESOLVED_DEPENDENCIES emitted with data %o', data);
        }
      );
    }
    /* istanbul ignore next */
    debug('instantiated resolver working from cwd %s', this.cwd);
  }

  /**
   * Returns a `Set` of all resolved dependency paths for `filepath`
   * @param {string} filepath - Filepath
   * @param {ResolveDependenciesOptions} opts - Options
   * @public
   * @returns {ResolvedDependencyInfo}
   */
  resolveDependencies(
    filepath,
    {refreshPaths = new Set(), force = false} = {}
  ) {
    if (!filepath) {
      throw new TypeError('expected nonempty string parameter `filepath`');
    }
    filepath = resolve(this.cwd, filepath);

    if (force) {
      this.clearCache();
    } else {
      refreshPaths = new Set(refreshPaths);
      if (refreshPaths.size) {
        this.clearCacheForFiles(refreshPaths);
      }
    }

    const ignore = [...this.ignore];
    const nonExistent = [];
    /**
     * @type {string}
     * @ignore
     */
    let tsConfigPath;
    /**
     * @type {string}
     * @ignore
     */
    let webpackConfigPath;

    const extension = extname(filepath);
    /**
     * @type {Set<string>}
     * @ignore
     */
    const deps = new Set();

    if (constants.EXTENSIONS_TS.has(extension)) {
      /* istanbul ignore next */
      debug('file %s is probably TS', filepath);
      const foundTsConfigPath = this._tryFindTSConfigPath();
      if (foundTsConfigPath) {
        deps.add(foundTsConfigPath);
        tsConfigPath = foundTsConfigPath;
      }
    } else if (constants.EXTENSIONS_JS.has(extension)) {
      /* istanbul ignore next */
      debug('file %s is probably JS', filepath);
      const foundWebpackConfigPath = this._tryFindWebpackConfigPath();
      if (foundWebpackConfigPath) {
        deps.add(foundWebpackConfigPath);
        webpackConfigPath = foundWebpackConfigPath;
      }
    }

    /**
     * @type {import('dependency-tree').Options}
     * @ignore
     */
    const depTreeOpts = {
      tsConfig: tsConfigPath,
      webpackConfig: webpackConfigPath,
      directory: this.cwd,
      filename: filepath.trim(),
      // `dot: true` is for matching `.foo/node_modules/bar` when `**/node_modules/*` given.
      filter: (filepath) => !multimatch(filepath, ignore, {dot: true}).length,
      nonExistent,
      visited: this._cache,
      // @ts-ignore
      noTypeDefinitions: true,
    };
    debug('dep tree opts: %o', depTreeOpts);
    const tree = dependencyTree.toList(depTreeOpts);
    debug('resolved: %o', tree);
    debug('missing: %o', nonExistent);

    const resolved = new Set([...deps, ...tree]);
    // the filepath always appears in this list, but we don't want it.
    resolved.delete(filepath);

    const missing = new Set(nonExistent);

    this.emit(
      constants.EVENT_RESOLVED_DEPENDENCIES,
      /** @type {ResolvedDependenciesEventData} */ ({
        filepath,
        resolved,
        missing,
      })
    );
    return {resolved, missing};
  }

  /**
   * Configures `filing-cabinet` to resolve modules referenced in JS files.
   *
   * Does not support RequireJS/AMD
   * @ignore
   * @returns {string|void} Object containing path to a webpack config file, if any
   */
  _tryFindWebpackConfigPath() {
    if (this.webpackConfigPath) {
      if (!existsSync(this.webpackConfigPath)) {
        throw new Error(
          `provided webpack config path ${this.webpackConfigPath} not found`
        );
      }
    } else {
      const defaultWebpackConfigPath = resolve(
        this.cwd,
        constants.DEFAULT_WEBPACK_CONFIG_FILENAME
      );
      if (existsSync(defaultWebpackConfigPath)) {
        /* istanbul ignore next */
        debug('found default webpack config at %s', defaultWebpackConfigPath);
        return defaultWebpackConfigPath;
      }
    }
    return this.webpackConfigPath;
  }

  /**
   * Configures `filing-cabinet` to resolve modules referenced in TS files
   * @ignore
   * @returns {string|void} Object containing path to a TS config file, if any
   */
  _tryFindTSConfigPath() {
    if (this.tsConfigPath) {
      if (!existsSync(this.tsConfigPath)) {
        throw new Error(
          `provided TS config path ${this.tsConfigPath} not found`
        );
      }
    } else {
      const defaultTsConfigPath = resolve(
        this.cwd,
        constants.DEFAULT_TS_CONFIG_FILENAME
      );
      if (existsSync(defaultTsConfigPath)) {
        /* istanbul ignore next */
        debug('found default TS config at %s', defaultTsConfigPath);
        return defaultTsConfigPath;
      }
    }
    return this.tsConfigPath;
  }

  /**
   * Resolve deps for a file
   * @param {string} filepath - File to resolve dependencies for
   * @param {ResolverOptions} [opts] - Options
   */
  static resolveDependencies(filepath, opts = {}) {
    return Resolver.create(opts).resolveDependencies(filepath);
  }

  /**
   * Instantiates a new {@link Resolver}
   * @param {ResolverOptions} [opts] - Options
   */
  static create(opts = {}) {
    return new Resolver(opts);
  }

  /**
   * Removes filepaths from cache
   * @param {string[]|Set<string>} filepaths - Filepaths to remove from cache
   * @returns {Resolver}
   */
  clearCacheForFiles(filepaths) {
    filepaths = new Set(filepaths);
    for (const filepath of filepaths) {
      delete this._cache[filepath];
    }
    debug('cleared files from cache: %o', filepaths);
    return this;
  }

  /**
   * Clears entire cache
   * @returns {Resolver}
   */
  clearCache() {
    this._cache = Object.create(null);
    return this;
  }
}

Resolver.constants = constants;

exports.Resolver = Resolver;
exports.resolveDependencies = Resolver.resolveDependencies;

/**
 * Options for {@link resolveDependencies} and {@link Resolver} constructor
 * @typedef {Object} ResolverOptions
 * @property {string} [cwd] - Current working directory
 * @property {string} [tsConfigPath] - Path to `tsconfig.json`
 * @property {string} [webpackConfigPath] - Path to `webpack.config.js`
 * @property {Set<string>|string[]} [ignore] - Paths/globs to ignore
 */

/**
 * Options for `tryFindWebpackConfigPath`
 * @private
 * @typedef {Object} ConfigureFilingCabinetForJSOptions
 * @property {string} cwd - Current working directory
 * @property {string} webpackConfigPath - Path to webpack config
 */

/**
 * Options for {@link configureFilingCabinetForTS}
 * @private
 * @typedef {Object} ConfigureFilingCabinetForTSOptions
 * @property {string} cwd - Current working directory
 * @property {string} tsConfigPath - Path to TS config
 */

/**
 * Data emitted by {@link Resolver#dependency} event.
 * @typedef {Object} DependencyData
 * @property {string} filepath - Filepath having dependency `resolved`
 * @property {string} resolved - Resolved path to dependency
 */

/**
 * Emitted when the {@link Resolver} resolves a dependency for a file
 * @event Resolver#dependency
 * @type {DependencyData}
 */

/**
 * @typedef {Object} ResolvedDependencyInfo
 * @property {Set<string>} resolved - List of resolved deps
 * @property {Set<string>} missing - List of unresolvable deps
 */

/**
 * @typedef {ResolvedDependencyInfo & {filepath: string}} ResolvedDependenciesEventData
 * @property {string} filepath - Filepath which deps were resolved for
 */

/**
 * @typedef {Object} ResolveDependenciesOptions
 * @property {string[]|Set<string>} [refreshPaths] - List of paths to force-refresh; removes from cache
 * @property {boolean} [force=false] - If truthy, obliterate cache first. Takes precedence over `refreshPaths`
 */

/**
 * @typedef {Object} ClearCacheOptions
 * @property {string[]|Set<string>} [filepaths] - Only clear cache for these files
 */
