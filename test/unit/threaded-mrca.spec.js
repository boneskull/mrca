'use strict';

const {EventEmitter} = require('events');
const rewiremock = require('rewiremock/node');
const sinon = require('sinon');
const expect = require('../expect');

describe('class ThreadedMRCA', function () {
  let stubs;
  let mocks;
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
      }
    };

    MRCA.prototype._hydrate = sinon.stub().resolves();

    const Worker = class Worker extends EventEmitter {};

    Worker.prototype.unref = sinon.stub();
    Worker.prototype.terminate = sinon.stub().resolves();
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
    let tm;

    beforeEach(async function () {
      tm = new ThreadedMRCA({
        entryFiles: ['foo.js', 'bar.js', 'baz.js'],
      });
      setTimeout(() => {
        tm._worker.emit('online');
      });
      return tm._online;
    });

    describe('findAllDependencies()', function () {
      let EVENT_RESOLVED_DEPENDENCIES;

      beforeEach(async function () {
        EVENT_RESOLVED_DEPENDENCIES =
          stubs.resolver.Resolver.constants.EVENT_RESOLVED_DEPENDENCIES;
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

      describe('when the worker finds dependencies', function () {
        it('should aggregate into a single result', async function () {
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

    describe('terminate()', function () {
      describe('when worker exits successfully', function () {
        beforeEach(function () {
          tm._worker.terminate.resolves(0);
        });

        it('should resolve', async function () {
          return expect(tm.terminate(), 'to be fulfilled');
        });
      });

      describe('when the worker exits with a non-zero code', function () {
        beforeEach(function () {
          tm._worker.terminate.resolves(1);
        });

        it('should reject', async function () {
          return expect(tm.terminate(), 'to be rejected with', {code: 1});
        });
      });
    });

    describe('_hydrate()', function () {
      describe('when the worker is online', function () {
        it('should delegate to superclass', async function () {
          await tm._hydrate(['foo.js']);
          expect(
            // gets the superclass. thanks, stackoverflow!
            Object.getPrototypeOf(Object.getPrototypeOf(tm))._hydrate,
            'to have a call satisfying',
            [['foo.js']]
          );
        });
      });

      describe('when the worker is not yet online', function () {
        it('should not (yet) delegate to its superclass', async function () {
          tm._online = new Promise((resolve) => {
            setTimeout(resolve, 50);
          });
          tm._hydrate(['foo.js']);
          expect(
            Object.getPrototypeOf(Object.getPrototypeOf(tm))._hydrate,
            'was not called'
          );
          return tm._online;
        });
      });
    });
  });

  describe('static method', function () {
    describe('create()', function () {
      it('should return a new ThreadedMRCA instance', function () {
        expect(ThreadedMRCA.create(), 'to be a', ThreadedMRCA);
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
