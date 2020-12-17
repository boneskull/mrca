'use strict';

const sortKeys = require('sort-keys');
const {realpathSync} = require('fs');
const mem = require('mem');
const os = require('os');
const path = require('path');
const {sync: loadJSONFile} = require('load-json-file');
const {sync: writeJSONFile} = require('write-json-file');
const debug = require('debug')('mrca:module-graph');
const {DirectedGraph, NotFoundGraphError} = require('graphology');
const {bfsFromNode, bfs} = require('graphology-traversal');
const {allSimplePaths} = require('graphology-simple-path');

const PLATFORM = os.platform();

const {findCacheDir, createCacheFilename} = require('./util');
const {
  DEFAULT_BASE_MODULE_GRAPH_FILENAME,
  DEFAULT_CACHE_EXTENSION,
} = require('./constants');

const ENTRY_FILE_KEY = 'entryFile';
const MISSING_KEY = 'missing';

const realpath = mem(
  /**
   * @param {string} filepath
   * @returns {string}
   * @ignore
   */ (filepath) => {
    try {
      return realpathSync(filepath);
    } catch (ignored) {
      return filepath;
    }
  }
);

/**
 * @param {string} filepath
 * @returns {string}
 * @ignore
 */
const identity = String;

class ModuleGraph {
  /**
   * Creates an empty graph or deserializes `serialized`
   * @param {ModuleGraphOptions} [opts] - Options
   */
  constructor({
    serialized,
    cwd = process.cwd(),
    cacheDir,
    filename,
    useRealPaths = PLATFORM === 'darwin',
  } = {}) {
    /**
     * Current working directory
     * @type {string}
     */
    this.cwd = cwd;

    /**
     * @type {boolean}
     * @readonly
     * @see https://github.com/microsoft/TypeScript/issues/28694
     */
    this.useRealPaths = undefined;
    Object.defineProperty(this, 'useRealPaths', {
      value: Boolean(useRealPaths),
    });

    /**
     * @type {string}
     */
    this.cacheDir = findCacheDir({dir: cacheDir, cwd: this.cwd});

    /**
     * Filename of cache file
     * @type {string}
     */
    this.filename =
      filename ||
      createCacheFilename(
        DEFAULT_BASE_MODULE_GRAPH_FILENAME,
        this.cwd,
        DEFAULT_CACHE_EXTENSION
      );

    /**
     * Converts a filepath into a "real" filepath _if_ `useRealPaths` is truthy
     */
    this._toNodeKey = useRealPaths ? realpath : identity;

    if (!serialized) {
      /* istanbul ignore next */
      debug(
        'attempting to read module graph cache from %s',
        this.cacheFilepath
      );
      try {
        serialized = loadJSONFile(this.cacheFilepath);
        /* istanbul ignore next */
        debug('successfully read JSON from %s', this.cacheFilepath);
      } catch (err) {
        if (err.code === 'ENOENT') {
          this.graph = new DirectedGraph();
          /* istanbul ignore next */
          debug('no on-disk cache found; created empty graph');
        } else {
          throw err;
        }
      }
    } else {
      this.graph = new DirectedGraph();
    }

    if (serialized) {
      this.import(serialized);
    }

    debug(
      'created graph with node count %d and edge count %d',
      this.graph.order,
      this.graph.size
    );

    return this._setupListeners();
  }

  _setupListeners() {
    this.graph.on('edgeDropped', ({source}) => {
      if (!this.graph.edges(source).length) {
        this.remove(source);
        /* istanbul ignore next */
        debug('removed orphaned node %s', source);
      }
    });
    return this;
  }

  /**
   * Full filepath of the cache on disk
   * @type {string}
   */
  get cacheFilepath() {
    return path.resolve(this.cacheDir, this.filename);
  }

  /**
   *
   * @param {string} filepath
   * @param {SetOptions} param1
   * @returns {string}
   */
  set(
    filepath,
    {parents = new Set(), missing = false, entryFile = false} = {}
  ) {
    const attrs = {};

    if (missing) {
      attrs[MISSING_KEY] = true;
    }

    if (entryFile) {
      attrs[ENTRY_FILE_KEY] = true;
    }

    const nodeKey = this._toNodeKey(filepath);

    this.graph.mergeNode(nodeKey, attrs);
    for (const parent of parents) {
      this.graph.mergeDirectedEdge(nodeKey, parent);
    }

    return nodeKey;
  }

  /**
   *
   * @param {SerializedGraph} serialized - Serialized graph representation
   * @returns {SerializedGraph}
   */
  normalize(serialized) {
    if (this.useRealPaths) {
      for (const node of serialized.nodes) {
        node.key = String(this._toNodeKey(node.key));
      }
      for (const edge of serialized.edges) {
        edge.source = String(this._toNodeKey(edge.source));
        edge.target = String(this._toNodeKey(edge.target));
      }
      /* istanbul ignore next */
      debug('normalized %o', serialized);
    }
    return serialized;
  }

  /**
   *
   * @param {Partial<import('graphology-types').SerializedGraph>} serialized - Serialized graph representation
   * @returns {ModuleGraph}
   */
  import({edges = [], nodes = [], attributes = {}, options = {}} = {}) {
    this.graph.import(
      this.normalize({edges, nodes, attributes, options}),
      true
    );
    return this;
  }

  /**
   *
   * @param {string} filepath
   */
  importFromFile(filepath) {
    /**
     * @type {import('graphology-types').SerializedGraph}
     */
    let serialized;
    try {
      serialized = loadJSONFile(filepath);
    } catch (err) {
      throw new TypeError(`Unable to parse JSON at ${filepath}: ${err}`);
    }
    this.import(serialized);
    return this;
  }

  /**
   * Returns the subset of `filepaths` which are unknown to this `ModuleGraph`.
   * @param {string[]|Set<string>} [filepaths] - Filepaths to check
   * @returns {Set<string>}
   */
  filterUntrackedFiles(filepaths = []) {
    return new Set([...filepaths].filter((filepath) => !this.has(filepath)));
  }

  /**
   *
   * @param {string} filepath
   * @returns {boolean}
   */
  isMissing(filepath) {
    try {
      return this.graph.hasNodeAttribute(
        this._toNodeKey(filepath),
        MISSING_KEY
      );
    } catch (ignored) {
      return false;
    }
  }

  /**
   *
   * @param {string} filepath
   * @throws
   * @todo Error code
   * @returns {ModuleGraph}
   */
  markMissing(filepath) {
    try {
      this.graph.setNodeAttribute(this._toNodeKey(filepath), MISSING_KEY, true);
      return this;
    } catch (err) {
      if (err instanceof NotFoundGraphError) {
        throw new Error(
          `attempted to mark filepath ${filepath} as missing, but it does not exist`
        );
      }
      /* istanbul ignore next */
      throw err; // unknown error
    }
  }

  /**
   *
   * @param {string} filepath
   * @returns {ModuleGraph}
   */
  markFound(filepath) {
    try {
      this.graph.removeNodeAttribute(this._toNodeKey(filepath), MISSING_KEY);
      return this;
    } catch (err) {
      if (err instanceof NotFoundGraphError) {
        throw new Error(
          `attempted to mark filepath ${filepath} as found, but it does not exist`
        );
      }
      /* istanbul ignore next */
      throw err; // unknown error
    }
  }

  /**
   * Removes a node from the graph and any edges to parents. Can cause cascading deletes if it is a parent of a node which has no other parents.
   * @param {string} filepath
   * @returns {ModuleGraph}
   */
  remove(filepath) {
    this.graph.dropNode(this._toNodeKey(filepath));
    return this;
  }

  /**
   *
   * @param {string} filepath
   * @returns {boolean}
   */
  isEntryFile(filepath) {
    try {
      return this.graph.hasNodeAttribute(
        this._toNodeKey(filepath),
        ENTRY_FILE_KEY
      );
    } catch (ignored) {
      return false;
    }
  }

  /**
   * Find all entry file ancestors of `filepath`
   * Performs a breadth-first search
   * @todo May want to perform a depth-first search depending on the tree characteristics
   * @param {string} filepath
   * @returns {Set<string>} Entry file paths
   */
  getEntryFiles(filepath) {
    const nodes = [];
    bfsFromNode(this.graph, this._toNodeKey(filepath), (node, attrs) => {
      if (attrs[ENTRY_FILE_KEY]) {
        nodes.push(node);
      }
    });
    return new Set(nodes);
  }

  /**
   *
   * @param {string} filepath
   * @returns {AncestorsInfo}
   */
  getAncestors(filepath) {
    const entryFiles = this.getEntryFiles(this._toNodeKey(filepath));
    debug('looking for paths from %s to any of %o', filepath, entryFiles);
    const ancestors = new Set();
    for (const entryFile of entryFiles) {
      const pathsToEntry = allSimplePaths(this.graph, filepath, entryFile);
      for (const pathToEntry of pathsToEntry) {
        for (const ancestorOfPathToEntry of pathToEntry) {
          if (ancestorOfPathToEntry !== filepath) {
            ancestors.add(ancestorOfPathToEntry);
          }
        }
      }
    }
    return {ancestors, entryFiles};
  }

  getMissingDependencies() {}

  /**
   *
   * @param {string} filepath
   * @returns {boolean}
   */
  has(filepath) {
    return this.graph.hasNode(this._toNodeKey(filepath));
  }

  /**
   * @type {Set<string>}
   */
  get filepaths() {
    return new Set(this.graph.nodes());
  }

  /**
   * Returns a list of unique directories of all files
   * @type {Set<string>}
   */
  get directories() {
    const set = new Set();
    for (const filepath of this.filepaths) {
      set.add(path.dirname(filepath));
    }
    return set;
  }

  /**
   * @returns {ModuleGraph}
   */
  save() {
    writeJSONFile(this.cacheFilepath, this.graph.export(), {indent: undefined});
    return this;
  }

  /**
   * @returns {ModuleGraph}
   */
  reset() {
    this.graph.clear();
    return this;
  }

  /**
   * Removes missing nodes
   */
  compact() {
    const missing = new Set();
    const affected = new Set();
    bfs(this.graph, (node, attrs) => {
      const filepath = String(node);
      if (attrs[MISSING_KEY]) {
        this.graph.forEachOutNeighbor(filepath, (node) => {
          affected.add(node);
        });
        missing.add(filepath);
      }
    });
    for (const node of missing) {
      this.remove(node);
    }
    return {removed: missing, affected};
  }

  /**
   * Instantiates a {@link ModuleGraph}
   * @param {ModuleGraphOptions} [opts] - Optional serialized graph (from file)
   */
  static create(opts) {
    return new ModuleGraph(opts);
  }

  /**
   *
   * @param {string} filepath - Path to on-disk JSON file
   * @param {ModuleGraphOptions} [opts] - More options
   * @returns {ModuleGraph}
   */
  static fromFile(filepath, opts = {}) {
    return ModuleGraph.create({serialized: loadJSONFile(filepath), ...opts});
  }

  /**
   *
   * @param {string} json - JSON string
   * @param {ModuleGraphOptions} [opts] - More options
   * @returns {ModuleGraph}
   */
  static fromJSON(json, opts = {}) {
    return ModuleGraph.create({serialized: JSON.parse(json), ...opts});
  }

  toJSON() {
    return sortKeys(
      {
        cwd: this.cwd,
        cacheDir: this.cacheDir,
        filename: this.filename,
        useRealPaths: this.useRealPaths,
        graph: this.graph.export(),
      },
      {deep: true}
    );
  }
}

exports.ModuleGraph = ModuleGraph;

/**
 * @typedef {Object} ModuleGraphOptions
 * @property {SerializedGraph} [serialized]
 * @property {string} [cacheDir] - Explicit cache directory
 * @property {string} [filename] - Filename for cache
 * @property {string} [cwd] - Current working directory; affects location of cache dir if not provided
 * @property {boolean} [useRealPaths] - If `true`, compute real FS paths. Needed on darwin, maybe others
 */

/**
 * @typedef {Object} ImportOptions
 * @property {boolean} [merge] - If `true`, merge into existing graph
 */

/**
 * @typedef {Object} SetOptions
 * @property {Set<string>} [parents]
 * @property {boolean} [missing]
 * @property {boolean} [entryFile]
 */

/**
 * @typedef {Object} AncestorsInfo
 * @property {Set<string>} ancestors
 * @property {Set<string>} entryFiles
 */

/**
 * @typedef {import('graphology-types').SerializedGraph} SerializedGraph
 */
