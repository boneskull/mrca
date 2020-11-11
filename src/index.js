'use strict';

const {ModuleMap} = require('./module-map');
const {ModuleMapNode} = require('./module-map-node');
const {resolveDependencies} = require('./resolver');

exports.ModuleMap = ModuleMap;
exports.ModuleMapNode = ModuleMapNode;
exports.resolveDependencies = resolveDependencies;
