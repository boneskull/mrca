'use strict';

/**
 * Class used internally by {@link ModuleMap} which tracks the relationship between parents and children.
 *
 * You should not need to create one of these; {@link ModuleMap} will do it for you.
 *
 * Note: All "references" are by filename (string); there are no references to other {@link ModuleMapNode}s. Using references would complicate serialization, and we'd still need to maintain integrity (e.g., no `ModuleMapNode` should be referenced which is not within the values of a `ModuleMap`). Regardless, we may want to move to this strategy in future development.
 */
class ModuleMapNode {
  /**
   * Just sets some properties, folks.
   * @param {string} filepath - Absolute filepath. May not point to a "module" per se, but some other file.
   * @param {ModuleMapNodeOptions} opts
   */
  constructor(
    filepath,
    {entryFiles = new Set(), children = new Set(), parents = new Set()} = {}
  ) {
    this.filename = filepath;
    this.entryFiles = entryFiles;
    this.parents = parents;
    this.children = children;
  }

  /**
   * Returns an object suitable for JSON stringification
   * @returns {ModuleMapNodeJSON}
   */
  toJSON() {
    return {
      filename: this.filename,
      entryFiles: [...this.entryFiles].sort(),
      children: [...this.children].sort(),
      parents: [...this.parents].sort(),
    };
  }

  /**
   * Returns a short description of this `ModuleMapNode`
   * @returns {string}
   */
  toString() {
    return `[ModuleMapNode ${this.filename}]`;
  }

  /**
   * Creates a {@link ModuleMapNode}, saving you from the horror of the `new` keyword.
   * @param {string} filepath
   * @param {ModuleMapNodeOptions} [opts]
   * @returns {ModuleMapNode}
   */
  static create(filepath, opts) {
    return new ModuleMapNode(filepath, opts);
  }
}

exports.ModuleMapNode = ModuleMapNode;

/**
 * Options for {@link ModuleMapNode} constructor.
 * @typedef {Object} ModuleMapNodeOptions
 * @property {Set<string>} [parents] - List of parents (dependants), if any
 * @property {Set<string>} [children] - List of children (dependencies), if any
 * @property {Set<string>} [entryFiles] - List of associated test files
 */

/**
 * A representation of a {@link ModuleMapNode} suitable for JSON stringification.
 * @typedef {Object} ModuleMapNodeJSON
 * @property {string} filename - Filename
 * @property {string[]} entryFiles - Entry files
 * @property {string[]} children - Children
 * @property {string[]} parents - Parents
 */
