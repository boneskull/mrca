'use strict';

const {Worker} = require('worker_threads');
const {ModuleMap} = require('./module-map');
const debug = require('debug')('mrca:threaded-module-map');
const path = require('path');
const WORKER_PATH = process.env.MRCA_PROJECT_ROOT_DIR
  ? path.resolve(process.env.MRCA_PROJECT_ROOT_DIR, 'src', 'resolver-worker.js')
  : require.resolve('./resolver-worker');
const {Resolver} = require('./resolver');

const constants = {
  DEFAULT_TIMEOUT: 1000,
};

class ThreadedModuleMap extends ModuleMap {
  /**
   *
   * @param {Partial<ThreadedModuleMapOptions>} [opts]
   */
  constructor(opts = {}) {
    super(opts);
    const worker = (this._worker = new Worker(WORKER_PATH, {
      workerData: {
        cwd: this.cwd,
        tsConfigPath: this.tsConfigPath,
        webpackConfigPath: this.webpackConfigPath,
        ignore: this.ignore,
      },
    }));
    const timeout = opts.workerTimeout || constants.DEFAULT_TIMEOUT;

    /**
     * When this resolves, the worker has come online.
     * @ignore
     * @type {Promise<void>}
     */
    this._online = new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        worker
          .terminate()
          .catch((err) => {
            /* istanbul ignore next */
            reject(err);
          })
          .then(() => {
            reject(new Error(`worker not ready in ${timeout} ms`));
          });
      }, timeout);
      this._worker
        .once('online', () => {
          clearTimeout(t);
          resolve();
        })
        .once('error', reject);
    });
  }

  /**
   * Given one or more `ModuleMapNode`s, find dependencies and add them to the map.
   * @ignore
   * @override
   * @param {Set<ModuleMapNode>|ModuleMapNode[]} nodes - One or more module nodes to find dependencies for
   */
  async _hydrate(nodes, {force = false} = {}) {
    await this._online;
    /* istanbul ignore next */
    debug('hydrating nodes: %s', [...nodes].map(String));
    return super._hydrate(nodes, {force});
  }

  /**
   * @override
   * @param {string[]} filepaths
   * @returns {Promise<Map<string,Set<string>>>}
   */
  async findAllDependencies(filepaths) {
    await this._online;
    const worker = this._worker;
    debug('finding all dependencies for %o', filepaths);
    return new Promise((resolve, reject) => {
      const resolvedDependencyMap = new Map();
      /**
       * @param {string[]} filepaths
       */
      const postFindDependenciesMessage = (filepaths) => {
        if (filepaths.length) {
          const filepath = filepaths.pop();
          worker.postMessage({
            command: 'find-dependencies',
            payload: {
              filepath,
            },
          });
          /* istanbul ignore next */
          debug('posted command "find-dependencies" w/ filepath %s', filepath);
        } else {
          worker.removeListener('message', onMessage);
          worker.removeListener('error', reject);
          /* istanbul ignore next */
          debug('worker done resolving deps for %d files', filepaths.length);
          resolve(resolvedDependencyMap);
        }
      };

      const onMessage = ({event, data}) => {
        debug('received event %s with data %o', event, data);
        switch (event) {
          // when the worker resolves a dependency for our file, it sends this event
          case Resolver.constants.EVENT_DEPENDENCY: {
            const {filepath, resolved} = data;
            /* istanbul ignore next */
            if (filepath === resolved) {
              // this should really never happen, but who knows
              throw new Error(`file ${filepath} should not resolve to itself!`);
            }
            if (resolvedDependencyMap.has(filepath)) {
              resolvedDependencyMap.get(filepath).add(resolved);
            } else {
              resolvedDependencyMap.set(filepath, new Set([resolved]));
            }
            break;
          }
          default:
            // here, the worker ostensibly sent a EVENT_RESOLVE_DEPENDENCIES_COMPLETE event,
            // which means "I'm done finding all deps for this file".  so we give it the next file.
            postFindDependenciesMessage(filepaths);
        }
      };

      worker.on('message', onMessage).on('error', reject);

      postFindDependenciesMessage(filepaths);
    });
  }

  /**
   * Create a new `ThreadedModuleMap` instance
   * @param {Partial<ThreadedModuleMapOptions>} [opts] - Options
   * @returns {ThreadedModuleMap}
   */
  static create(opts = {}) {
    return new ThreadedModuleMap(opts);
  }

  /**
   * Terminates the underlying worker.
   * Rejects if worker exits with non-zero exit code.
   * @returns {Promise<void>}
   */
  async terminate() {
    const code = await this._worker.terminate();
    if (code !== 1) {
      throw new Error(
        `received unexpected exit code from terminated worker: ${code}`
      );
    } else {
      debug('worker terminated successfully');
    }
  }
}

ThreadedModuleMap.constants = constants;
exports.ThreadedModuleMap = ThreadedModuleMap;

/**
 * @typedef {Object} ThreadedModuleMapSpecificOptions
 * @property {number} workerTimeout - How long to wait for worker to come online in ms; default 1000ms
 */

/**
 * @typedef {import('./module-map').ModuleMapOptions & ThreadedModuleMapSpecificOptions} ThreadedModuleMapOptions
 */

/** @typedef {import('./module-map-node').ModuleMapNode} ModuleMapNode */
