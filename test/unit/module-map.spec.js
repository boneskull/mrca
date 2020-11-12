'use strict';

const rewiremock = require('rewiremock/node');
const sinon = require('sinon');
const path = require('path');
const expect = require('../expect');

describe('class ModuleMap', function () {
  let stubs;
  let mocks;
  /**
   * @type {ModuleMap}
   */
  let moduleMap;
  /**
   * @type {typeof import('../../src/module-map').ModuleMap}
   */
  let ModuleMap;

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

    /**
     * @type {SinonSpy & {create: SinonSpy}}
     */
    const FileEntryCache = Object.assign(
      sinon.spy(() =>
        Object.create({
          reset: sinon.stub().returnsThis(),
          save: sinon.stub().returnsThis(),
          yieldChangedFiles: sinon.stub().returns(new Set()),
          hasFileChanged: sinon.stub().returns(true),
          markFileChanged: sinon.stub().returnsThis(),
        })
      ),
      {create: sinon.spy((...args) => FileEntryCache(...args))}
    );

    /**
     * @type {SinonSpy & {create: SinonSpy}}
     */
    const ModuleMapCache = Object.assign(
      sinon.spy(() =>
        Object.create({
          reset: sinon.stub().returnsThis(),
          save: sinon.stub().returnsThis(),
          values: sinon.stub().returns(new Set()),
        })
      ),
      {create: sinon.spy((...args) => ModuleMapCache(...args))}
    );
    mocks = {
      FileEntryCache,
      ModuleMapCache,
      ModuleMapNode,
    };

    stubs = {
      'file-entry-cache': {
        FileEntryCache: mocks.FileEntryCache,
      },
      'flat-cache': {
        create: sinon.stub().returns({...mocks.ModuleMapCache}),
      },
      resolver: {
        resolveDependencies: sinon.stub().returns(new Set()),
      },
      'module-map-node': {
        ModuleMapNode: mocks.ModuleMapNode,
      },
      'module-map-cache': {
        ModuleMapCache: mocks.ModuleMapCache,
      },
      util: {
        findCacheDir: sinon.stub().returns('/some/cache/dir'),
      },
      /** @type {SinonStub} */
      cwd: undefined,
    };
    const moduleMapModule = rewiremock.proxy(
      () => require('../../src/module-map'),
      (r) => ({
        [require.resolve('../../src/file-entry-cache')]: r
          .with(stubs['file-entry-cache'])
          .directChildOnly(),
        precinct: r.with(stubs.precinct).directChildOnly(),
        [require.resolve('../../src/util')]: r
          .with(stubs.util)
          .directChildOnly(),
        [require.resolve('../../src/resolver')]: r
          .with(stubs.resolver)
          .directChildOnly(),
        [require.resolve('../../src/module-map-node')]: r
          .with(stubs['module-map-node'])
          .directChildOnly(),
        [require.resolve('../../src/module-map-cache')]: r
          .with(stubs['module-map-cache'])
          .directChildOnly(),
      })
    );
    ModuleMap = moduleMapModule.ModuleMap;
  });

  describe('constructor', function () {
    beforeEach(function () {
      sinon.stub(ModuleMap.prototype, '_init').returnsThis();

      moduleMap = new ModuleMap({
        entryFiles: ['/some/file.js'],
      });
    });

    it('should initialize', function () {
      expect(moduleMap._init, 'was called once');
    });

    it('should create/load a module map cache', function () {
      expect(mocks.ModuleMapCache.create, 'was called once');
    });

    it('should create/load a file entry cache', function () {
      expect(mocks.FileEntryCache.create, 'was called once');
    });

    it('should always add `cacheDir` to the `ignore` list', function () {
      expect(moduleMap.ignore, 'to contain', '/some/cache/dir');
    });
  });

  describe('instance method', function () {
    /**
     * @type {ModuleMap}
     */
    let moduleMap;

    beforeEach(function () {
      sinon.stub(ModuleMap.prototype, '_init').returnsThis();

      moduleMap = ModuleMap.create({
        entryFiles: ['/some/file.js', '/some/other/file.js'],
      });

      /** @type {SinonStub} */ (moduleMap._init).restore();
    });

    describe('init()', function () {
      beforeEach(function () {
        sinon.stub(moduleMap, '_populate').returnsThis();
        // sinon.stub(moduleMap, 'persistModuleMapCache').returnsThis();
        sinon.stub(moduleMap, 'mergeFromCache').returnsThis();
        // sinon.stub(moduleMap, 'moduleMapCache.reset').returnsThis();
        moduleMap._initialized = false;
      });

      describe('when already initialized', function () {
        beforeEach(function () {
          moduleMap._initialized = true;
        });

        describe('when option `force` is falsy', function () {
          it('should throw', function () {
            expect(() => moduleMap._init(), 'to throw');
          });
        });

        describe('when option `force` is truthy', function () {
          it('should reinit', function () {
            expect(() => moduleMap._init({force: true}), 'not to throw');
          });
        });
      });

      it('should return its context', function () {
        expect(moduleMap._init(), 'to be', moduleMap);
      });

      describe('when node already found for entry file', function () {
        beforeEach(function () {
          /** @type {SinonStub} */ (moduleMap.fileEntryCache
            .yieldChangedFiles).returns(new Set(['/some/file.js']));
          moduleMap.set(
            '/some/file.js',
            mocks.ModuleMapNode.create('/some/file.js')
          );
          mocks.ModuleMapNode.create.resetHistory();
          moduleMap._init();
        });

        it('should not create another node', function () {
          expect(mocks.ModuleMapNode.create, 'not to have calls satisfying', [
            '/some/file.js',
          ]).and('was called once');
        });
      });

      describe('when entry files have changed', function () {
        beforeEach(function () {
          /** @type {SinonStub} */ (moduleMap.fileEntryCache
            .yieldChangedFiles).returns(new Set(['/some/file.js']));
          moduleMap._init();
        });

        it('should clear and load from map', function () {
          expect(moduleMap.mergeFromCache, 'to have a call satisfying', [
            {destructive: true},
          ]);
        });

        it('should yield changed files (which will persist the file entry cache)', function () {
          expect(moduleMap.fileEntryCache.yieldChangedFiles, 'was called once');
        });

        it('should populate starting from entry files', function () {
          expect(moduleMap._populate, 'to have a call satisfying', [
            new Set([{filename: '/some/file.js'}]),
            {force: true},
          ]);
        });

        it('should persist the module map cache', function () {
          expect(moduleMap.moduleMapCache.save, 'was called once');
        });
      });

      describe('when no files have changed', function () {
        beforeEach(function () {
          moduleMap._init();
        });

        it('should not populate anything', function () {
          expect(moduleMap._populate, 'was not called');
        });
      });

      describe('when provided no options', function () {
        beforeEach(function () {
          moduleMap._init();
        });

        it('should not reset the module map cache', function () {
          expect(moduleMap.moduleMapCache.reset, 'was not called');
        });

        it('should not reset the file entry cache', function () {
          expect(moduleMap.fileEntryCache.reset, 'was not called');
        });
      });

      describe('when option `reset` is truthy', function () {
        beforeEach(function () {
          moduleMap._init({reset: true});
        });
        it('should reset the module map cache', function () {
          expect(moduleMap.moduleMapCache.reset, 'was called once');
        });

        it('should reset the file entry cache', function () {
          expect(moduleMap.fileEntryCache.reset, 'was called once');
        });
      });
    });

    describe('delete()', function () {
      describe('when deleting a child', function () {
        beforeEach(function () {
          moduleMap.set(
            '/some/file.js',
            mocks.ModuleMapNode.create('/some/file.js', {
              children: ['/some/child.js', '/some/other/child.js'],
            })
          );
          moduleMap.set(
            '/some/other/file.js',
            mocks.ModuleMapNode.create('/some/other/file.js')
          );
          moduleMap.set(
            '/some/child.js',
            mocks.ModuleMapNode.create('/some/child.js', {
              parents: ['/some/file.js'],
            })
          );
          moduleMap.set(
            '/some/other/child.js',
            mocks.ModuleMapNode.create('/some/other/child.js', {
              parents: ['/some/file.js'],
            })
          );
        });

        it('should remove the child from all parents', function () {
          moduleMap.delete('/some/other/child.js');
          expect(
            moduleMap,
            'to exhaustively satisfy',
            new Map([
              [
                '/some/file.js',
                mocks.ModuleMapNode.create('/some/file.js', {
                  children: ['/some/child.js'],
                }),
              ],
              [
                '/some/other/file.js',
                mocks.ModuleMapNode.create('/some/other/file.js', {
                  children: [],
                }),
              ],
              [
                '/some/child.js',
                mocks.ModuleMapNode.create('/some/child.js', {
                  parents: ['/some/file.js'],
                }),
              ],
            ])
          );
        });
      });

      describe('when deletion creates orphaned children', function () {
        beforeEach(function () {
          moduleMap.set(
            '/some/file.js',
            mocks.ModuleMapNode.create('/some/file.js', {
              children: ['/some/child.js', '/some/other/child.js'],
            })
          );
          moduleMap.set(
            '/some/other/file.js',
            mocks.ModuleMapNode.create('/some/other/file.js')
          );
          moduleMap.set(
            '/some/child.js',
            mocks.ModuleMapNode.create('/some/child.js', {
              parents: ['/some/file.js'],
            })
          );
          moduleMap.set(
            '/some/other/child.js',
            mocks.ModuleMapNode.create('/some/other/child.js', {
              parents: ['/some/file.js'],
            })
          );
        });

        it('should delete orphaned children (cascading delete)', function () {
          moduleMap.delete('/some/file.js');
          expect(moduleMap, 'to have size', 1).and(
            'to exhaustively satisfy',
            new Map([
              [
                '/some/other/file.js',
                mocks.ModuleMapNode.create('/some/other/file.js'),
              ],
            ])
          );
        });
      });

      describe('when deletion does not create orphaned children', function () {
        beforeEach(function () {
          moduleMap.set(
            '/some/file.js',
            mocks.ModuleMapNode.create('/some/file.js', {
              children: ['/some/child.js', '/some/other/child.js'],
            })
          );
          moduleMap.set(
            '/some/other/file.js',
            mocks.ModuleMapNode.create('/some/other/file.js', {
              children: ['/some/other/child.js'],
            })
          );
          moduleMap.set(
            '/some/child.js',
            mocks.ModuleMapNode.create('/some/child.js', {
              parents: ['/some/file.js'],
            })
          );
          moduleMap.set(
            '/some/other/child.js',
            mocks.ModuleMapNode.create('/some/other/child.js', {
              parents: ['/some/other/file.js', '/some/file.js'],
            })
          );
        });

        it('should not delete children having other parents', function () {
          moduleMap.delete('/some/file.js');
          expect(moduleMap, 'to have size', 2).and(
            'to exhaustively satisfy',
            new Map([
              [
                '/some/other/file.js',
                mocks.ModuleMapNode.create('/some/other/file.js', {
                  children: ['/some/other/child.js'],
                }),
              ],
              [
                '/some/other/child.js',
                mocks.ModuleMapNode.create('/some/other/child.js', {
                  parents: ['/some/other/file.js'],
                }),
              ],
            ])
          );
        });
      });
    });

    describe('save()', function () {
      beforeEach(function () {
        // sinon.stub(ModuleMap.prototype, 'persistModuleMapCache');
        moduleMap.save();
      });

      it('should persist the module map cache', function () {
        expect(moduleMap.moduleMapCache.save, 'was called once');
      });

      it('should persist the file entry cache', function () {
        expect(moduleMap.fileEntryCache.save, 'was called once');
      });

      it('should return its context', function () {
        expect(moduleMap.save(), 'to be', moduleMap);
      });
    });

    describe('findDependencies()', function () {
      it('should delegate to the resolver', function () {
        const retval = moduleMap.findDependencies('some-file.js');
        expect(
          stubs.resolver.resolveDependencies,
          'to have a call satisfying',
          {
            args: [
              path.join(moduleMap.cwd, 'some-file.js'),
              {cwd: moduleMap.cwd, ignore: moduleMap.ignore},
            ],
            returnValue: retval,
          }
        ).and('was called once');
      });
    });

    describe('toJSON()', function () {
      it('should return a stable representation of the module map', function () {
        // the idea here is to assert the result of toJSON() is
        // the same, regardless of the order in which items are set.
        moduleMap.set('foo.js', mocks.ModuleMapNode.create('foo.js'));
        moduleMap.set('bar.js', mocks.ModuleMapNode.create('bar.js'));
        const a = moduleMap.toJSON();
        moduleMap.clear();
        moduleMap.set('bar.js', mocks.ModuleMapNode.create('bar.js'));
        moduleMap.set('foo.js', mocks.ModuleMapNode.create('foo.js'));
        const b = moduleMap.toJSON();
        expect(JSON.stringify(a), 'to be', JSON.stringify(b));
      });
    });

    describe('mergeFromCache()', function () {
      beforeEach(function () {
        sinon.spy(moduleMap, 'clear');
      });

      describe('when provided option destructive = true', function () {
        it('should clear the module map', function () {
          moduleMap.mergeFromCache({destructive: true});
          expect(moduleMap.clear, 'was called once');
        });
      });

      describe('when not provided option destructive = true', function () {
        it('should not clear the module map', function () {
          moduleMap.mergeFromCache();
          expect(moduleMap.clear, 'was not called');
        });
      });

      it('should overwrite existing values with the contents of the cache', function () {
        moduleMap.set(
          'foo.js',
          mocks.ModuleMapNode.create('foo.js', {
            children: [],
            parents: [],
            entryFiles: [],
          })
        );
        moduleMap.set('bar.js', mocks.ModuleMapNode.create('bar.js'));
        // should use new value for `children` and leave `bar.js` untouched
        /** @type {SinonStub} */ (moduleMap.moduleMapCache.values).returns(
          new Set([
            {
              filename: 'foo.js',
              children: ['bar.js'],
              entryFiles: [],
              parents: [],
            },
          ])
        );

        moduleMap.mergeFromCache();
        expect(moduleMap, 'as JSON', 'to satisfy', {
          'foo.js': {filename: 'foo.js', children: ['bar.js']},
          'bar.js': {filename: 'bar.js'},
        });
      });
    });

    describe('addEntryFile()', function () {
      beforeEach(function () {
        sinon.stub(moduleMap, 'cwd').get(() => '/some/farm/animals');
        sinon.stub(moduleMap, '_populate');
        sinon.spy(moduleMap, 'set');
        sinon.spy(moduleMap.entryFiles, 'add');
      });

      describe('when provided a relative filepath', function () {
        it('should resolve the filepath relative to the `cwd` prop', function () {
          moduleMap.addEntryFile('foo.js');
          expect(moduleMap.entryFiles.add, 'to have a call satisfying', [
            '/some/farm/animals/foo.js',
          ]);
        });
      });

      describe('when provided a file which is already known but not an entry file', function () {
        beforeEach(function () {
          sinon
            .stub(moduleMap, 'has')
            .withArgs('/some/farm/animals/foo.js')
            .returns(true);
          moduleMap.addEntryFile('/some/farm/animals/foo.js');
        });

        it('should add the entry file', function () {
          expect(moduleMap.entryFiles.add, 'was called once');
        });

        it('should not attempt to re-populate from an already known file', function () {
          moduleMap.addEntryFile('/some/farm/animals/foo.js');
          expect(moduleMap._populate, 'was not called');
        });
      });

      describe('when provided a file which is already an entry file', function () {
        beforeEach(function () {
          moduleMap.entryFiles.add('/some/farm/animals/foo.js');
          sinon
            .stub(moduleMap, 'has')
            .withArgs('/some/farm/animals/foo.js')
            .returns(true);
        });

        it('should not attempt to add the entry file', function () {
          moduleMap.addEntryFile('/some/farm/animals/foo.js');
          expect(moduleMap.entryFiles.add, 'was called once');
        });

        it('should not attempt to re-populate from an already known file', function () {
          moduleMap.addEntryFile('/some/farm/animals/foo.js');
          expect(moduleMap._populate, 'was not called');
        });
      });
    });
  });

  describe('interesting computed properties', function () {
    beforeEach(function () {
      sinon.stub(ModuleMap.prototype, '_init');
      moduleMap = new ModuleMap();
    });

    describe('getters', function () {
      describe('entryDirectories', function () {
        beforeEach(function () {
          sinon
            .stub(moduleMap, 'entryFiles')
            .get(() => new Set(['/some/file.js', '/some/other/path.js']));
        });

        it('should return a set of all parent directories of entry files', function () {
          expect(
            moduleMap.entryDirectories,
            'to equal',
            new Set(['/some', '/some/other'])
          );
        });
      });

      describe('directories', function () {
        beforeEach(function () {
          sinon
            .stub(moduleMap, 'files')
            .get(() => new Set(['/some/file.js', '/some/other/path.js']));
        });

        it('should return a set of all parent directories of all files', function () {
          expect(
            moduleMap.directories,
            'to equal',
            new Set(['/some', '/some/other'])
          );
        });
      });

      describe('files', function () {
        beforeEach(function () {
          sinon
            .stub(moduleMap, 'keys')
            .returns(new Set(['a', 'b', 'c']).values());
        });

        it('should return a Set of all keys', function () {
          expect(moduleMap.files, 'to equal', new Set(['a', 'b', 'c']));
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
