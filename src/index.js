'use strict';

const {MRCA} = require('./mrca');
const {ThreadedModuleMap} = require('./threaded-module-map');
const {ModuleMap} = require('./module-map');
const {ModuleMapNode} = require('./module-map-node');
const {FileEntryCache} = require('./file-entry-cache');
const {ModuleMapCache} = require('./module-map-cache');
const {Resolver} = require('./resolver');
const constants = require('./constants');

exports.ModuleMap = ModuleMap;
exports.ModuleMapNode = ModuleMapNode;
exports.resolveDependencies = Resolver.resolveDependencies;
exports.FileEntryCache = FileEntryCache;
exports.ModuleMapCache = ModuleMapCache;
exports.constants = constants;
exports.Resolver = Resolver;
exports.MRCA = MRCA;

/**
 * Creates a module map.  Use option `threaded: true` to create a module map which
 * resolves dependencies via a worker thread
 * @param {Partial<import('./module-map').ModuleMapOptions|import('./threaded-module-map').ThreadedModuleMapOptions>} [opts]
 */
exports.createModuleMap = (opts = {}) => {
  if (opts.threaded) {
    return ThreadedModuleMap.create(opts);
  }
  return ModuleMap.create(opts);
};
