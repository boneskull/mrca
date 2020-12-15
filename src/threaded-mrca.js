'use strict';

const {Worker} = require('worker_threads');
const {MRCA} = require('./mrca');
const debug = require('debug')('mrca:threaded-mrca');
const path = require('path');
const WORKER_PATH = process.env.MRCA_PROJECT_ROOT_DIR
  ? path.resolve(process.env.MRCA_PROJECT_ROOT_DIR, 'src', 'resolver-worker.js')
  : require.resolve('./resolver-worker');
const {Resolver} = require('./resolver');

const constants = {
  DEFAULT_TIMEOUT: 1000,
};

class ThreadedMRCA extends MRCA {
  /**
   *
   * @param {ThreadedMRCAOptions} [opts]
   */
  constructor(opts = {}) {
    super(opts);
    const worker = (this._worker = new Worker(WORKER_PATH, {
      workerData: /**
       * @type {import('./resolver').ResolverOptions}
       */ ({
        cwd: this.cwd,
        tsConfigPath: this.tsConfigPath,
        webpackConfigPath: this.webpackConfigPath,
        ignore: this.ignore,
      }),
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
   * Same as {@link MRCA#_hydrate}, except waits for worker to be ready.
   * @ignore
   * @override
   * @param {Set<string>|string[]} filepaths -
   */
  async _hydrate(filepaths) {
    await this._online;
    /* istanbul ignore next */
    debug('hydrating nodes: %o', filepaths);
    return super._hydrate(filepaths);
  }

  /**
   * @override
   * @param {string[]} filepaths
   * @returns {Promise<import('./mrca').DependencyInfo>}
   */
  async findAllDependencies(filepaths) {
    await this._online;
    const worker = this._worker;
    debug('finding all dependencies for %o', filepaths);
    return new Promise((resolve, reject) => {
      /**
       * @type {import('./mrca').DependencyInfo}
       * @ignore
       */
      const resolvedDependencyMap = new Map();
      /**
       * @param {string[]} filepathStack
       * @ignore
       */
      const postFindDependenciesMessage = (filepathStack) => {
        if (filepathStack.length) {
          const filepath = filepathStack.pop();
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
          worker.postMessage({
            command: 'disconnect',
          });
          resolve(resolvedDependencyMap);
        }
      };

      const onMessage = ({event, data}) => {
        /* istanbul ignore next */
        debug('received event %s with data %o', event, data);
        switch (event) {
          // when the worker resolves a dependency for our file, it sends this event
          case Resolver.constants.EVENT_RESOLVED_DEPENDENCIES: {
            const {
              filepath,
              resolved,
              missing,
            } = /** @type {import('./resolver').ResolvedDependenciesEventData} */ (data);
            if (resolvedDependencyMap.has(filepath)) {
              const dependencyData = resolvedDependencyMap.get(filepath);
              dependencyData.resolved = new Set(resolved);
              dependencyData.missing = new Set(missing);
            } else {
              resolvedDependencyMap.set(filepath, {
                resolved: new Set(resolved),
                missing: new Set(missing),
              });
            }
            postFindDependenciesMessage(filepathStack);
          }
        }
      };

      worker.on('message', onMessage).on('error', reject);

      const filepathStack = [...filepaths];
      postFindDependenciesMessage(filepathStack);
    });
  }

  /**
   * Create a new `ThreadedMRCA` instance
   * @param {Partial<ThreadedMRCAOptions>} [opts] - Options
   * @returns {ThreadedMRCA}
   */
  static create(opts = {}) {
    return new ThreadedMRCA(opts);
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

ThreadedMRCA.constants = constants;
exports.ThreadedMRCA = ThreadedMRCA;

/**
 * @typedef {Object} ThreadedMRCASpecificOptions
 * @property {number} [workerTimeout] - How long to wait for worker to come online in ms; default 1000ms
 */

/**
 * @typedef {import('./mrca').MRCAOptions & ThreadedMRCASpecificOptions} ThreadedMRCAOptions
 */
