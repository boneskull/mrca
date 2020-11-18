'use strict';

const {EventEmitter} = require('events');
const rewiremock = require('rewiremock/node');
const sinon = require('sinon');
const expect = require('../expect');

describe('class ThreadedModuleMap', function () {
  let stubs;
  let mocks;
  /**
   * @type {import('../../src/threaded-module-map').ThreadedModuleMap}
   */
  let tmm;
  /**
   * @type {typeof import('../../src/threaded-module-map').ThreadedModuleMap}
   */
  let ThreadedModuleMap;

  afterEach(function () {
    sinon.restore();
  });

  beforeEach(function () {
    /**
     * a Mock ModuleMapNode
     * @type {SinonSpy & {create: SinonSpy}}
     */
    const ModuleMapNode = Object.assign(
      sinon.spy(
        /**
         *
         * @param {string} filename
         * @param {ModuleMapNodeOptions} opts
         */
        (
          filename,
          {
            children = new Set(),
            parents = new Set(),
            entryFiles = new Set(),
          } = {}
        ) => {
          const proto = {
            toJSON() {
              return {
                filename: this.filename,
                children: [...this.children],
                parents: [...this.parents],
                entryFiles: [...this.entryFiles],
              };
            },
          };
          const obj = Object.create(proto);
          obj.filename = filename;
          obj.children = new Set(children);
          obj.parents = new Set(parents);
          obj.entryFiles = new Set(entryFiles);
          return obj;
        }
      ),
      {
        create: sinon.spy((...args) => ModuleMapNode(...args)),
      }
    );

    const FileEntryCache = Object.assign(
      sinon.spy(() =>
        Object.create({
          hasFileChanged: sinon.stub().returns(true),
        })
      ),
      {create: sinon.spy((...args) => FileEntryCache(...args))}
    );

    /**
     * This mock creates a Map containing a mapping of entryFiles to associated mock ModuleMapNode
     * @ignore
     */
    const ModuleMap = class MockModuleMap extends Map {
      constructor({entryFiles = []} = {}) {
        super(
          [...entryFiles].map((filename) => [
            filename,
            mocks.ModuleMapNode.create(filename),
          ])
        );
        this.fileEntryCache = FileEntryCache.create();
        this.entryFiles = new Set(entryFiles);
        this._hydrate = sinon.stub().resolves();
        this.ready = Promise.resolve();
      }
    };

    const Worker = class Worker extends EventEmitter {
      constructor() {
        super();
        setTimeout(() => {
          this.emit('online');
        }, 50);
      }
    };

    Worker.prototype.postMessage = sinon.stub();

    mocks = {
      ModuleMapNode,
      ModuleMap,
      Worker,
    };

    stubs = {
      resolver: {
        resolveDependencies: sinon.stub().returns(new Set()),
        Resolver: {
          constants: {
            EVENT_DEPENDENCY: 'test-dependency',
            EVENT_RESOLVE_DEPENDENCIES_COMPLETE: 'test-complete',
          },
        },
      },
      'module-map-node': {
        ModuleMapNode: mocks.ModuleMapNode,
      },
      'module-map': {
        ModuleMap: mocks.ModuleMap,
        constants: {},
      },
      worker_threads: {
        Worker: mocks.Worker,
      },
      /** @type {SinonStub} */
      cwd: undefined,
    };
    const threadedModuleMapModule = rewiremock.proxy(
      () => require('../../src/threaded-module-map'),
      (r) => ({
        [require.resolve('../../src/resolver')]: r
          .with(stubs.resolver)
          .directChildOnly(),
        [require.resolve('../../src/module-map-node')]: r
          .with(stubs['module-map-node'])
          .directChildOnly(),
        [require.resolve('../../src/module-map')]: r
          .with(stubs['module-map'])
          .directChildOnly(),
        worker_threads: r.with(stubs.worker_threads).directChildOnly(),
      })
    );
    ThreadedModuleMap = threadedModuleMapModule.ThreadedModuleMap;
  });

  describe('constructor', function () {
    it('should create a Worker', function () {
      expect(new ThreadedModuleMap(), 'to have property', '_worker');
    });

    it('should create a Promise which resolves when the Worker is online', async function () {
      const tmm = new ThreadedModuleMap();
      tmm._worker.emit('online');
      return expect(tmm._online, 'to be fulfilled');
    });
  });

  describe('instance method', function () {
    describe('findAllDependencies()', function () {
      let EVENT_RESOLVE_DEPENDENCIES_COMPLETE;
      let EVENT_DEPENDENCY;

      beforeEach(function () {
        EVENT_RESOLVE_DEPENDENCIES_COMPLETE =
          stubs.resolver.Resolver.constants.EVENT_RESOLVE_DEPENDENCIES_COMPLETE;
        EVENT_DEPENDENCY = stubs.resolver.Resolver.constants.EVENT_DEPENDENCY;
        tmm = new ThreadedModuleMap({
          entryFiles: ['foo.js', 'bar.js', 'baz.js'],
        });
      });

      it('should reject if the worker fails to come online', async function () {
        tmm._online = new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('bad')), 50);
        });
        return expect(
          tmm.findAllDependencies(['foo.js']),
          'to be rejected with',
          /bad/
        );
      });

      it('should post a `find-dependencies` command to the worker', async function () {
        // emitting the 'deps complete' event should cause `findAllDependencies()` to resolve.
        /** @type {SinonStub} */ (tmm._worker.postMessage)
          .onFirstCall()
          // NOT A LAMBDA
          .callsFake(function () {
            setTimeout(() => {
              this.emit('message', {
                event: EVENT_RESOLVE_DEPENDENCIES_COMPLETE,
              });
            }, 50);
          });
        // });
        await tmm.findAllDependencies(['foo.js']);
        expect(tmm._worker.postMessage, 'to have a call satisfying', [
          {command: 'find-dependencies', payload: {filepath: 'foo.js'}},
        ]);
      });

      describe('when dependencies have already been found', function () {
        it('should not attempt to find dependencies again', async function () {
          const postMessage = /** @type {SinonStub} */ (tmm._worker
            .postMessage);
          postMessage
            .onFirstCall()
            // NOT A LAMBDA
            .callsFake(function ({payload}) {
              setTimeout(() => {
                this.emit('message', {
                  event: EVENT_DEPENDENCY,
                  data: {
                    filepath: payload.filepath,
                    resolved: 'derp.js',
                  },
                });
                setTimeout(() => {
                  this.emit('message', {
                    event: EVENT_RESOLVE_DEPENDENCIES_COMPLETE,
                  });
                }, 50);
              }, 50);
            });
          postMessage.onSecondCall().callsFake(function ({payload}) {
            setTimeout(() => {
              this.emit('message', {
                event: EVENT_DEPENDENCY,
                data: {
                  filepath: payload.filepath,
                  resolved: 'some-other-file.js',
                },
              });
              setTimeout(() => {
                this.emit('message', {
                  event: EVENT_RESOLVE_DEPENDENCIES_COMPLETE,
                });
              }, 50);
            }, 50);
          });
          postMessage.onThirdCall().callsFake(function ({payload}) {
            setTimeout(() => {
              this.emit('message', {
                event: EVENT_DEPENDENCY,
                data: {
                  filepath: payload.filepath,
                  resolved: 'some-other-file.js',
                },
              });
              this.emit('message', {
                event: EVENT_DEPENDENCY,
                data: {
                  filepath: payload.filepath,
                  resolved: 'yet-another-file.js',
                },
              });
              setTimeout(() => {
                this.emit('message', {
                  event: EVENT_RESOLVE_DEPENDENCIES_COMPLETE,
                });
              }, 50);
            }, 50);
          });

          return expect(
            tmm.findAllDependencies(['bar.js', 'foo.js', 'some-other-file.js']),
            'to be fulfilled with value satisfying',
            new Map([
              ['some-other-file.js', new Set(['derp.js'])],
              ['foo.js', new Set(['some-other-file.js'])],
              [
                'bar.js',
                new Set(['some-other-file.js', 'yet-another-file.js']),
              ],
            ])
          );
        });
      });
    });
  });
});

/**
 * @typedef {import('sinon').SinonStub} SinonStub
 */

/**
 * @typedef {import('sinon').SinonSpy} SinonSpy
 */

/**
 * @typedef {import('../../src/module-map').ModuleMap} ModuleMap
 */

/**
 * @typedef {import('../../src/module-map-node').ModuleMapNodeOptions} ModuleMapNodeOptions
 */

/**
 * @typedef {import('../../src/module-map').ModuleMapOptions} ModuleMapOptions
 */
