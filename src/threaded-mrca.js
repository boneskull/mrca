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
    this._timeout =
      opts.workerTimeout === undefined
        ? constants.DEFAULT_TIMEOUT
        : opts.workerTimeout;

    this._online = this.startWorker().catch((err) => {
      this.emit('error', err);
    });
  }

  async startWorker() {
    return new Promise((resolve, reject) => {
      this._worker = new Worker(WORKER_PATH, {
        workerData: /**
         * @type {import('./resolver').ResolverOptions}
         */ ({
          cwd: this.cwd,
          tsConfigPath: this.tsConfigPath,
          webpackConfigPath: this.webpackConfigPath,
          ignore: this.ignore,
        }),
      });
      this._worker.unref();
      const t = setTimeout(async () => {
        try {
          await this._worker.terminate();
        } catch (err) {
          reject(
            new Error(
              `Worker not ready in ${this._timeout} ms. As a bonus, termination failed with: ${err}`
            )
          );
          return;
        }
        reject(new Error(`Worker not ready in ${this._timeout} ms`));
      }, this._timeout);
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
          case Resolver.constants.EVENT_RESOLVED_DEPENDENCIES: {
            const {
              filepath,
              resolved,
              missing,
            } = /** @type {import('./resolver').ResolvedDependenciesEventData} */ (data);
            resolvedDependencyMap.set(filepath, {
              resolved: new Set(resolved),
              missing: new Set(missing),
            });
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
    if (code !== 0) {
      /**
       * @type {import('child_process').ExecException}
       */
      const err = new Error(
        `received unexpected exit code from terminated worker: ${code}`
      );
      err.code = code;
      throw err;
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
