'use strict';

const {EventEmitter} = require('events');
const rewiremock = require('rewiremock/node');
const sinon = require('sinon');
const expect = require('../expect');

describe('class ThreadedMRCA', function () {
  let stubs;
  let mocks;
  /**
   * @type {import('../../src/threaded-mrca').ThreadedMRCA}
   */
  let tm;
  /**
   * @type {typeof import('../../src/threaded-mrca').ThreadedMRCA}
   */
  let ThreadedMRCA;

  afterEach(function () {
    sinon.restore();
  });

  beforeEach(function () {
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
    const MRCA = class MockMRCA extends EventEmitter {
      constructor({entryFiles = []} = {}) {
        super();
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
      MRCA,
      Worker,
    };

    stubs = {
      resolver: {
        resolveDependencies: sinon.stub().returns(new Set()),
        Resolver: {
          constants: {
            EVENT_RESOLVED_DEPENDENCIES: 'test-resolved-dependencies',
          },
        },
      },
      mrca: {
        MRCA: mocks.MRCA,
        constants: {},
      },
      worker_threads: {
        Worker: mocks.Worker,
      },
      /** @type {SinonStub} */
      cwd: undefined,
    };
    const threadedMRCAModule = rewiremock.proxy(
      () => require('../../src/threaded-mrca'),
      (r) => ({
        [require.resolve('../../src/resolver')]: r
          .with(stubs.resolver)
          .directChildOnly(),
        [require.resolve('../../src/mrca')]: r
          .with(stubs.mrca)
          .directChildOnly(),
        worker_threads: r.with(stubs.worker_threads).directChildOnly(),
      })
    );
    ThreadedMRCA = threadedMRCAModule.ThreadedMRCA;
  });

  describe('constructor', function () {
    it('should create a Worker', function () {
      expect(new ThreadedMRCA(), 'to have property', '_worker');
    });

    it('should create a Promise which resolves when the Worker is online', async function () {
      const tm = new ThreadedMRCA();
      tm._worker.emit('online');
      return expect(tm._online, 'to be fulfilled');
    });
  });

  describe('instance method', function () {
    describe('findAllDependencies()', function () {
      let EVENT_RESOLVED_DEPENDENCIES;

      beforeEach(function () {
        EVENT_RESOLVED_DEPENDENCIES =
          stubs.resolver.Resolver.constants.EVENT_RESOLVED_DEPENDENCIES;
        tm = new ThreadedMRCA({
          entryFiles: ['foo.js', 'bar.js', 'baz.js'],
        });
      });

      it('should reject if the worker fails to come online', async function () {
        tm._online = new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('bad')), 50);
        });
        return expect(
          tm.findAllDependencies(['foo.js']),
          'to be rejected with',
          /bad/
        );
      });

      it('should post a `find-dependencies` command to the worker', async function () {
        // emitting the 'deps complete' event should cause `findAllDependencies()` to resolve.
        /** @type {SinonStub} */ (tm._worker.postMessage)
          .onFirstCall()
          // NOT A LAMBDA
          .callsFake(function () {
            setTimeout(() => {
              this.emit('message', {
                data: {filepath: 'foo.js'},
                event: EVENT_RESOLVED_DEPENDENCIES,
              });
            }, 50);
          });
        // });
        await tm.findAllDependencies(['foo.js']);
        expect(tm._worker.postMessage, 'to have a call satisfying', [
          {command: 'find-dependencies', payload: {filepath: 'foo.js'}},
        ]);
      });

      describe('when dependencies have already been found', function () {
        it('should not attempt to find dependencies again', async function () {
          const postMessage = /** @type {SinonStub} */ (tm._worker.postMessage);
          postMessage
            .onFirstCall()
            // NOT A LAMBDA
            .callsFake(function ({payload}) {
              setTimeout(() => {
                this.emit('message', {
                  event: EVENT_RESOLVED_DEPENDENCIES,
                  data: {
                    filepath: payload.filepath,
                    resolved: new Set(['derp.js']),
                    mising: new Set(),
                  },
                });
              }, 50);
            });
          postMessage.onSecondCall().callsFake(function ({payload}) {
            setTimeout(() => {
              this.emit('message', {
                event: EVENT_RESOLVED_DEPENDENCIES,
                data: {
                  filepath: payload.filepath,
                  resolved: new Set(['some-other-file.js']),
                  missing: new Set(),
                },
              });
            }, 50);
          });
          postMessage.onThirdCall().callsFake(function ({payload}) {
            setTimeout(() => {
              this.emit('message', {
                event: EVENT_RESOLVED_DEPENDENCIES,
                data: {
                  filepath: payload.filepath,
                  resolved: new Set([
                    'some-other-file.js',
                    'yet-another-file.js',
                  ]),
                  missing: new Set(),
                },
              });
            }, 50);
          });

          return expect(
            tm.findAllDependencies(['bar.js', 'foo.js', 'some-other-file.js']),
            'to be fulfilled with',
            new Map([
              [
                'some-other-file.js',
                {resolved: new Set(['derp.js']), missing: new Set()},
              ],
              [
                'foo.js',
                {resolved: new Set(['some-other-file.js']), missing: new Set()},
              ],
              [
                'bar.js',
                {
                  resolved: new Set([
                    'some-other-file.js',
                    'yet-another-file.js',
                  ]),
                  missing: new Set(),
                },
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
