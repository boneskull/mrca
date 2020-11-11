'use strict';

/**
 * Class used internally by `ModuleMap` which tracks the relationship between parents and children.
 * All "references" are by filename (string); there are no references to other `ModuleMap`s.
 */
exports.ModuleMapNode = class ModuleMapNode {
  /**
   * Sets properties
   * @param {string} filename
   * @param {ModuleMapNodeOptions} opts
   */
  constructor(
    filename,
    {entryFiles = new Set(), children = new Set(), parents = new Set()} = {}
  ) {
    this.filename = filename;
    this.entryFiles = entryFiles;
    this.parents = parents;
    this.children = children;
  }

  /**
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

  toString() {
    return JSON.stringify(this.toJSON());
  }

  /**
   * @param {string} filename
   * @param {ModuleMapNodeOptions} [opts]
   */
  static create(filename, opts) {
    return new ModuleMapNode(filename, opts);
  }
};

/**
 * @typedef {Object} ModuleMapNodeOptions
 * @property {Set<string>} [parents] - List of parents (dependants), if any
 * @property {Set<string>} [children] - List of children (dependencies), if any
 * @property {Set<string>} [entryFiles] - List of associated test files
 */

/**
 * @typedef {Object} ModuleMapNodeJSON
 * @property {string} filename - Filename
 * @property {string[]} entryFiles - Entry files
 * @property {string[]} children - Children
 * @property {string[]} parents - Parents
 */
