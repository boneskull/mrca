'use strict';
const {paperwork} = require('precinct');
const cabinet = require('filing-cabinet');
const path = require('path');
const multimatch = require('multimatch');
const debug = require('debug')('mrca:resolver');
const {existsSync} = require('fs');
const resolveFrom = require('resolve-from');
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
   * Event emitted by {@link Resolver} when it has resolved a dependency
   */
  EVENT_DEPENDENCY: 'dependency',

  /**
   * Event emitted by {@link Resolver} when it has finished resolving dependencies for a file
   */
  EVENT_RESOLVE_DEPENDENCIES_COMPLETE: 'resolve-dependencies-complete',

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
   * @param {Partial<ResolveDependenciesOptions>} [opts]
   */
  constructor({
    cwd = process.cwd(),
    tsConfigPath,
    webpackConfigPath,
    ignore = [],
  } = {}) {
    super();
    this.cwd = cwd;
    this.tsConfigPath = tsConfigPath;
    this.webpackConfigPath = webpackConfigPath;
    this.ignore = new Set(ignore);
    /* istanbul ignore next */
    if (require('debug').enabled('mrca:resolver')) {
      this.on(constants.EVENT_DEPENDENCY, (data) => {
        debug('event EVENT_DEPENDENCY emitted with data %o', data);
      });
      this.on(constants.EVENT_RESOLVE_DEPENDENCIES_COMPLETE, (data) => {
        debug('event EVENT_RESOLVE_DEPENDENCIES_COMPLETE w/ data %o', data);
      });
    }
  }

  /**
   * Returns a `Set` of all resolved dependency paths for `filepath`
   * @param {string} filepath - Filepath
   * @fires Resolver#dependency
   * @returns {Set<string>}
   */
  resolveDependencies(filepath) {
    // `paperwork` finds referenced modules in source files
    /* istanbul ignore next */
    debug('looking for partials in %s', filepath);
    /**
     * @type {Set<string>}
     * @ignore
     */
    let unfilteredPartials;
    try {
      unfilteredPartials = new Set(paperwork(filepath, {includeCore: false}));
      /* istanbul ignore next */
      debug('found partials in %s: %o', filepath, unfilteredPartials);
    } catch (err) {
      // unclear how to reliably cause paperwork to throw
      /* istanbul ignore next */
      debug('precinct could not parse %s; %s', filepath, err);
      /* istanbul ignore next */
      return new Set();
    }

    const extname = path.extname(filepath);
    /**
     * @type {Set<string>}
     * @ignore
     */
    const resolvedDeps = new Set();

    /**
     * Whether or not to perform "naive" module resolution via `require-from`.
     * This is more performant, and is desirable if neither TypeScript nor
     * Webpack is in use.
     * @ignore
     */
    let shouldDoNaiveResolution = true;
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

    if (constants.EXTENSIONS_TS.has(extname)) {
      /* istanbul ignore next */
      debug('file %s is probably TS', filepath);
      const foundTsConfigPath = this.tryFindTSConfigPath();
      if (foundTsConfigPath) {
        resolvedDeps.add(foundTsConfigPath);
        this.emit(constants.EVENT_DEPENDENCY, {
          filepath,
          resolved: foundTsConfigPath,
        });
        shouldDoNaiveResolution = false;
        tsConfigPath = foundTsConfigPath;
      }
    } else if (constants.EXTENSIONS_JS.has(extname)) {
      /* istanbul ignore next */
      debug('file %s is probably JS', filepath);
      const foundWebpackConfigPath = this.tryFindWebpackConfigPath();
      if (foundWebpackConfigPath) {
        resolvedDeps.add(foundWebpackConfigPath);
        this.emit(constants.EVENT_DEPENDENCY, {
          filepath,
          resolved: foundWebpackConfigPath,
        });
        shouldDoNaiveResolution = false;
        webpackConfigPath = foundWebpackConfigPath;
      }
    }

    /**
     * @type {Set<string>}
     * @ignore
     */
    let naivelyResolvedDeps = new Set();

    /**
     * @type {Set<string>}
     * @ignore
     */
    let unresolvedPartials;
    if (shouldDoNaiveResolution) {
      const naiveResult = this.tryNaivelyResolvePartials(
        filepath,
        unfilteredPartials
      );
      naivelyResolvedDeps = naiveResult.naivelyResolvedPartials;
      unresolvedPartials = naiveResult.unresolvedPartials;
    } else {
      unresolvedPartials = new Set(unfilteredPartials);
    }

    /* istanbul ignore next */
    if (naivelyResolvedDeps.size) {
      /* istanbul ignore next */
      debug('naively resolved deps: %o', naivelyResolvedDeps);
    }

    /**
     * @type {Set<string>}
     * @ignore
     */
    let filingCabinetResolvedDeps = new Set();

    if (unresolvedPartials.size) {
      /**
       * @type {Partial<FilingCabinetOptions>}
       * @ignore
       */
      const cabinetOptions = {
        webpackConfig: webpackConfigPath,
        tsConfig: tsConfigPath,
        noTypeDefinitions: true,
      };
      filingCabinetResolvedDeps = this.resolvePartials(
        unresolvedPartials,
        cabinetOptions,
        filepath
      );
    }

    this.emit(constants.EVENT_RESOLVE_DEPENDENCIES_COMPLETE, {filepath});
    return new Set([
      ...resolvedDeps,
      ...filingCabinetResolvedDeps,
      ...naivelyResolvedDeps,
    ]);
  }

  /**
   * Given a set of partial module names/paths, return an object containing a Set of paths to those that were found
   * via `require.resolve()`, and another Set containing partials which could not be found this way
   * @param {string} filepath
   * @param {Set<string>} unfilteredPartials
   * @private
   * @returns {{naivelyResolvedPartials: Set<string>, unresolvedPartials: Set<string>}}
   */
  tryNaivelyResolvePartials(filepath, unfilteredPartials) {
    const naivelyResolvedPartials = new Set();
    const ignore = [...this.ignore];
    const unresolvedPartials = [...unfilteredPartials].reduce(
      (acc, partial) => {
        try {
          const resolved = resolveFrom(path.dirname(filepath), partial);
          if (multimatch(resolved, ignore).length) {
            /* istanbul ignore next */
            debug('%s is ignored', filepath);
          } else {
            naivelyResolvedPartials.add(resolved);
            this.emit(constants.EVENT_DEPENDENCY, {filepath, resolved});
          }
        } catch (ignored) {
          acc.add(partial);
        }
        return acc;
      },
      new Set()
    );
    return {naivelyResolvedPartials, unresolvedPartials};
  }

  /**
   * Configures `filing-cabinet` to resolve modules referenced in JS files.
   *
   * Does not support RequireJS/AMD
   * @private
   * @returns {string|void} Object containing path to a webpack config file, if any
   */
  tryFindWebpackConfigPath() {
    if (!this.webpackConfigPath) {
      const defaultWebpackConfigPath = path.join(
        this.cwd,
        constants.DEFAULT_WEBPACK_CONFIG_FILENAME
      );
      if (existsSync(defaultWebpackConfigPath)) {
        return defaultWebpackConfigPath;
      }
    }
    return this.webpackConfigPath;
  }

  /**
   * Given a set of partial module names/paths, return an array of resolved paths via `filing-cabinet`'s static analysis
   *
   * @param {Set<string>} unresolvedPartials - A Set of partials
   * @param {Partial<FilingCabinetOptions>} cabinetOptions  - Options for `filing-cabinet`
   * @param {string} filepath - Filename for `filing-cabinet` options
   * @returns {Set<string>} Resolved paths
   * @private
   */
  resolvePartials(unresolvedPartials, cabinetOptions, filepath) {
    const resolvedPartials = new Set();
    const ignore = [...this.ignore];
    for (const partial of unresolvedPartials) {
      /* istanbul ignore next */
      debug(
        'using filing-cabinet to resolve partial "%s" with config %o',
        partial,
        cabinetOptions
      );
      const resolved = cabinet({
        partial,
        filename: filepath,
        directory: this.cwd,
        ...cabinetOptions,
      });
      if (resolved === '') {
        /* istanbul ignore next */
        debug('filing-cabinet could not resolve module "%s"!', partial);
      } else {
        if (multimatch(resolved, ignore).length) {
          /* istanbul ignore next */
          debug('%s is ignored', resolved);
        } else {
          /* istanbul ignore next */
          debug('filing-cabinet resolved %s: %o', partial, resolved);
          resolvedPartials.add(resolved);
          this.emit(constants.EVENT_DEPENDENCY, {filepath, resolved});
        }
      }
    }
    return resolvedPartials;
  }

  /**
   * Configures `filing-cabinet` to resolve modules referenced in TS files
   * @private
   * @returns {string|void} Object containing path to a TS config file, if any
   */
  tryFindTSConfigPath() {
    if (!this.tsConfigPath) {
      const defaultTsConfigPath = path.join(
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
   * @param {Partial<ResolveDependenciesOptions>} [opts] - Options
   */
  static resolveDependencies(filepath, opts = {}) {
    return new Resolver(opts).resolveDependencies(filepath);
  }
}

Resolver.constants = constants;

exports.Resolver = Resolver;
exports.resolveDependencies = Resolver.resolveDependencies;

/**
 * Options for {@link resolveDependencies}
 * @typedef {Object} ResolveDependenciesOptions
 * @property {string} cwd - Current working directory
 * @property {string} tsConfigPath - Path to `tsconfig.json`
 * @property {string} webpackConfigPath - Path to `webpack.config.js`
 * @property {Set<string>|string[]|string} ignore - Paths/globs to ignore
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
 * @typedef {import('filing-cabinet').Options} FilingCabinetOptions
 */

/**
 * Data emitted by {@link Resolver#dependency} event.
 * @typedef {Object} DependencyData
 * @property {string} filepath - Filepath having dependency `resolved`
 * @property {string} resolved - Resolved path to dependency
 */

/**
 * @typedef {Object} ResolveCompleteData
 * @property {string} filepath - Filepath having all dependencies found
 */

/**
 * Emitted when the {@link Resolver} resolves a dependency for a file
 * @event Resolver#dependency
 * @type {DependencyData}
 */
