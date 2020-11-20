'use strict';

const path = require('path');
const rewiremock = require('rewiremock/node');
const sinon = require('sinon');
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
  /**
   * a Mock ModuleMapNode
   * @type {SinonSpy & {create: SinonSpy}}
   */
  let ModuleMapNode;

  afterEach(function () {
    sinon.restore();
  });

  beforeEach(function () {
    ModuleMapNode = Object.assign(
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
          yieldChangedFiles: sinon
            .stub()
            .returns({changed: new Set(), notFound: new Set()}),
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
        ModuleMapNode,
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
      sinon.stub(ModuleMap.prototype, '_init').resolves();

      moduleMap = new ModuleMap({
        entryFiles: ['foo.js', 'bar.js', 'baz.js'],
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

    beforeEach(async function () {
      sinon.stub(ModuleMap.prototype, '_init').resolves();

      moduleMap = ModuleMap.create({
        entryFiles: ['foo.js', 'bar.js', 'baz.js'],
        reset: true,
      });

      await moduleMap.ready;
      /** @type {SinonStub} */ (moduleMap._init).restore();
    });

    describe('_init()', function () {
      beforeEach(function () {
        sinon.stub(moduleMap, '_hydrate').returnsThis();
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
          it('should reject', async function () {
            return expect(() => moduleMap._init(), 'to be rejected');
          });
        });

        describe('when option `force` is truthy', function () {
          it('should reinit', function () {
            expect(() => moduleMap._init({force: true}), 'not to throw');
          });
        });
      });

      describe('when node already found for entry file', function () {
        beforeEach(async function () {
          /** @type {SinonStub} */ (moduleMap.fileEntryCache
            .yieldChangedFiles).returns({
            changed: new Set(['foo.js']),
            notFound: new Set(),
          });
          moduleMap.set('foo.js', ModuleMapNode.create('foo.js'));
          ModuleMapNode.create.resetHistory();
          return moduleMap._init();
        });

        it('should not create another node', function () {
          expect(ModuleMapNode.create, 'not to have calls satisfying', [
            'foo.js',
          ]).and('was called twice'); // for bar and baz
        });
      });

      describe('when entry files have changed', function () {
        beforeEach(async function () {
          /** @type {SinonStub} */ (moduleMap.fileEntryCache
            .yieldChangedFiles).returns({
            changed: new Set(['foo.js']),
            notFound: new Set(),
          });
          return moduleMap._init();
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
          expect(moduleMap._hydrate, 'to have a call satisfying', [
            new Set([{filename: 'foo.js'}]),
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
          expect(moduleMap._hydrate, 'was not called');
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
            'foo.js',
            ModuleMapNode.create('foo.js', {
              children: ['/some/child.js', '/some/other/child.js'],
            })
          );
          moduleMap.set('bar.js', ModuleMapNode.create('bar.js'));
          moduleMap.set(
            '/some/child.js',
            ModuleMapNode.create('/some/child.js', {
              parents: ['foo.js'],
            })
          );
          moduleMap.set(
            '/some/other/child.js',
            ModuleMapNode.create('/some/other/child.js', {
              parents: ['foo.js'],
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
                'foo.js',
                ModuleMapNode.create('foo.js', {
                  children: ['/some/child.js'],
                }),
              ],
              [
                'bar.js',
                ModuleMapNode.create('bar.js', {
                  children: [],
                }),
              ],
              [
                '/some/child.js',
                ModuleMapNode.create('/some/child.js', {
                  parents: ['foo.js'],
                }),
              ],
            ])
          );
        });
      });

      describe('when deletion creates orphaned children', function () {
        beforeEach(function () {
          moduleMap.set(
            'foo.js',
            ModuleMapNode.create('foo.js', {
              children: ['/some/child.js', '/some/other/child.js'],
            })
          );
          moduleMap.set('bar.js', ModuleMapNode.create('bar.js'));
          moduleMap.set(
            '/some/child.js',
            ModuleMapNode.create('/some/child.js', {
              parents: ['foo.js'],
            })
          );
          moduleMap.set(
            '/some/other/child.js',
            ModuleMapNode.create('/some/other/child.js', {
              parents: ['foo.js'],
            })
          );
        });

        it('should delete orphaned children (cascading delete)', function () {
          expect(moduleMap.delete('foo.js'), 'to be true');
          expect(moduleMap, 'to have size', 1).and(
            'to exhaustively satisfy',
            new Map([['bar.js', ModuleMapNode.create('bar.js')]])
          );
        });
      });

      describe('when deletion does not create orphaned children', function () {
        beforeEach(function () {
          moduleMap.set(
            'foo.js',
            ModuleMapNode.create('foo.js', {
              children: ['/some/child.js', '/some/other/child.js'],
            })
          );
          moduleMap.set(
            'bar.js',
            ModuleMapNode.create('bar.js', {
              children: ['/some/other/child.js'],
            })
          );
          moduleMap.set(
            '/some/child.js',
            ModuleMapNode.create('/some/child.js', {
              parents: ['foo.js'],
            })
          );
          moduleMap.set(
            '/some/other/child.js',
            ModuleMapNode.create('/some/other/child.js', {
              parents: ['bar.js', 'foo.js'],
            })
          );
        });

        it('should not delete children having other parents', function () {
          moduleMap.delete('foo.js');
          expect(
            moduleMap,
            'to exhaustively satisfy',
            new Map([
              [
                'bar.js',
                ModuleMapNode.create('bar.js', {
                  children: ['/some/other/child.js'],
                }),
              ],
              [
                '/some/other/child.js',
                ModuleMapNode.create('/some/other/child.js', {
                  parents: ['bar.js'],
                }),
              ],
            ])
          );
        });
      });
    });

    describe('save()', function () {
      describe('when `persistFileEntryCache` option is falsy', function () {
        beforeEach(function () {
          moduleMap.save();
        });

        it('should persist the module map cache', function () {
          expect(moduleMap.moduleMapCache.save, 'was called once');
        });

        it('should not persist the file entry cache', function () {
          expect(moduleMap.fileEntryCache.save, 'was not called');
        });
      });

      describe('when `persistFileEntryCache` option is truthy', function () {
        beforeEach(function () {
          moduleMap.save({persistFileEntryCache: true});
        });

        it('should persist the module map cache', function () {
          expect(moduleMap.moduleMapCache.save, 'was called once');
        });

        it('should persist the file entry cache', function () {
          expect(moduleMap.fileEntryCache.save, 'was called once');
        });
      });

      it('should return its context', function () {
        expect(moduleMap.save(), 'to be', moduleMap);
      });
    });

    describe('toJSON()', function () {
      it('should return a stable representation of the module map', function () {
        // the idea here is to assert the result of toJSON() is
        // the same, regardless of the order in which items are set.
        moduleMap.set('foo.js', ModuleMapNode.create('foo.js'));
        moduleMap.set('bar.js', ModuleMapNode.create('bar.js'));
        const a = moduleMap.toJSON();
        moduleMap.clear();
        moduleMap.set('bar.js', ModuleMapNode.create('bar.js'));
        moduleMap.set('foo.js', ModuleMapNode.create('foo.js'));
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
          ModuleMapNode.create('foo.js', {
            children: [],
            parents: [],
            entryFiles: [],
          })
        );
        moduleMap.set('bar.js', ModuleMapNode.create('bar.js'));
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
        sinon.stub(moduleMap, '_hydrate').returnsThis();
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
          expect(moduleMap._hydrate, 'was not called');
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
          expect(moduleMap._hydrate, 'was not called');
        });
      });
    });
    describe('_hydrate()', function () {
      let nodes;

      beforeEach(function () {
        nodes = new Map([
          ['foo.js', ModuleMapNode.create('foo.js')],
          ['bar.js', ModuleMapNode.create('bar.js')],
          ['baz.js', ModuleMapNode.create('baz.js')],
        ]);
      });

      describe('when no dependencies for the nodes are found', function () {
        beforeEach(function () {
          sinon.stub(moduleMap, 'findAllDependencies').resolves(new Map());
        });

        it('should only attempt to find dependencies for provided ModuleMapNodes', async function () {
          await moduleMap._hydrate([...nodes.values()]);
          expect(moduleMap.findAllDependencies, 'to have a call satisfying', [
            ['foo.js', 'bar.js', 'baz.js'],
          ]).and('was called once');
        });
      });

      describe('when dependencies are found', function () {
        beforeEach(async function () {
          sinon
            .stub(moduleMap, 'findAllDependencies')
            .resolves(new Map([['foo.js', new Set(['quux.js'])]]));
          return moduleMap._hydrate([...nodes.values()]);
        });

        it('should attempt to find dependencies for found dependencies', function () {
          expect(moduleMap.findAllDependencies, 'to have calls satisfying', [
            [['foo.js', 'bar.js', 'baz.js']],
            [['quux.js']],
          ]).and('was called twice');
        });

        it('should assign `children` property to provided nodes', function () {
          expect(
            nodes.get('foo.js'),
            'to have property',
            'children',
            new Set(['quux.js'])
          );
        });

        it('should assign `entryFiles` property to found dependency nodes', function () {
          expect(
            moduleMap.get('quux.js'),
            'to have property',
            'entryFiles',
            new Set(['foo.js'])
          );
        });

        it('should assign `parents` property to found dependency nodes', function () {
          expect(
            moduleMap.get('quux.js'),
            'to have property',
            'parents',
            new Set(['foo.js'])
          );
        });

        it('should create nodes for the dependencies if they do not exist', function () {
          expect(ModuleMapNode.create, 'to have a call satisfying', [
            'quux.js',
          ]);
        });
      });

      describe('when the same deps are found multiple times', function () {
        /** @type {SinonStub} */
        let findAllDependencies;
        beforeEach(async function () {
          findAllDependencies = sinon.stub(moduleMap, 'findAllDependencies');
          // foo.js depends on quux.js
          findAllDependencies
            .onFirstCall()
            .resolves(new Map([['foo.js', new Set(['quux.js'])]]));
          // quux.js depends on bar.js, but we've already processed bar.js in the first call.
          findAllDependencies
            .onSecondCall()
            .resolves(new Map([['quux.js', new Set(['bar.js'])]]));
          return moduleMap._hydrate([...nodes.values()]);
        });

        it('should not re-process the same deps', function () {
          expect(findAllDependencies, 'was called twice');
        });
      });
    });

    describe('findAffectedFilesForChangedFiles()', function () {
      beforeEach(function () {
        sinon.stub(moduleMap, 'markFileAsChanged');
        sinon.stub(moduleMap, '_yieldChangedFiles').returns(new Set());
        sinon.stub(moduleMap, '_hydrate').resolves();
        sinon.stub(moduleMap, '_findAffectedFiles').callsFake((value) =>
          value.size
            ? {
                entryFiles: new Set(['foo.js']),
                allFiles: new Set(['foo.js', 'bar.js']),
              }
            : {entryFiles: new Set(), allFiles: new Set()}
        );
        sinon.stub(moduleMap, 'mergeFromCache').returnsThis();
        sinon.stub(moduleMap, '_init').resolves();
      });

      it('should return the result of `_findAffectedFiles`', async function () {
        // this doesn't feel right, but a better assertion eludes me atm
        return expect(
          moduleMap.findAffectedFilesForChangedFiles({
            knownChangedFiles: ['foo.js', 'bar.js'],
          }),
          'when fulfilled',
          'to be',
          /** @type {SinonStub} */ (moduleMap._findAffectedFiles)
            .returnValues[0]
        );
      });

      describe('when provided known changed files', function () {
        it('should explicitly mark each file given as "changed"', async function () {
          await moduleMap.findAffectedFilesForChangedFiles({
            knownChangedFiles: ['foo.js', 'bar.js'],
          });
          expect(moduleMap.markFileAsChanged, 'to have calls satisfying', [
            [path.join(moduleMap.cwd, 'foo.js')],
            [path.join(moduleMap.cwd, 'bar.js')],
          ]).and('was called twice');
        });
      });

      describe('when not provided known changed files', function () {
        it('should not mark any file as explicitly changed', async function () {
          await moduleMap.findAffectedFilesForChangedFiles();
          expect(moduleMap.markFileAsChanged, 'was not called');
        });
      });

      it('should query for a list of changed files', async function () {
        await moduleMap.findAffectedFilesForChangedFiles();
        expect(moduleMap._yieldChangedFiles, 'was called once');
      });

      describe('when no files have changed', function () {
        it('should return a vast emptiness', async function () {
          return expect(
            moduleMap.findAffectedFilesForChangedFiles(),
            'to be fulfilled with',
            {entryFiles: new Set(), allFiles: new Set()}
          );
        });
      });

      describe('when files have changed', function () {
        beforeEach(function () {
          /** @type {SinonStub } */ (moduleMap._yieldChangedFiles).returns(
            new Set(['foo.js', 'bar.js'])
          );
        });

        it('should re-hydrate the changed files', async function () {
          sinon
            .stub(moduleMap, 'getAll')
            .returns(
              new Set([
                ModuleMapNode.create('foo.js'),
                ModuleMapNode.create('bar.js'),
              ])
            );
          await moduleMap.findAffectedFilesForChangedFiles({
            knownChangedFiles: ['foo.js', 'bar.js'],
          });
          expect(
            moduleMap._hydrate,
            'to have a call satisfying',
            new Set([
              ModuleMapNode.create('foo.js'),
              ModuleMapNode.create('bar.js'),
            ])
          ).and('was called once');
        });

        describe('when changed files are unknown', function () {
          it('should attempt to synchronize the cache from disk', async function () {
            await moduleMap.findAffectedFilesForChangedFiles({
              knownChangedFiles: ['foo.js', 'bar.js', 'baz.js'],
            });
            expect(moduleMap.mergeFromCache, 'to have a call satisfying', [
              {destructive: true},
            ]).and('was called once');
          });

          describe('when file entry cache is mismatched with module map', function () {
            it('should re-initialize the module map', async function () {
              await moduleMap.findAffectedFilesForChangedFiles({
                knownChangedFiles: ['foo.js', 'bar.js', 'baz.js'],
              });
              expect(moduleMap._init, 'to have a call satisfying', [
                {reset: true, force: true},
              ]).and('was called once');
            });
          });

          describe('when synchronization fixes the issue', function () {
            beforeEach(function () {
              sinon
                .stub(moduleMap, 'getAll')
                .returns(new Set())
                .onSecondCall()
                .returns(
                  new Set([
                    ModuleMapNode.create('foo.js'),
                    ModuleMapNode.create('bar.js'),
                  ])
                );
            });

            it('should not re-initialize the module map', async function () {
              await moduleMap.findAffectedFilesForChangedFiles({
                knownChangedFiles: ['foo.js', 'bar.js', 'baz.js'],
              });

              expect(moduleMap._init, 'was not called');
            });
          });
        });

        describe('when changed files are known', function () {
          beforeEach(function () {
            sinon
              .stub(moduleMap, 'getAll')
              .returns(
                new Set([
                  ModuleMapNode.create('foo.js'),
                  ModuleMapNode.create('bar.js'),
                ])
              );
          });

          it('should not attempt to merge from disk', async function () {
            await moduleMap.findAffectedFilesForChangedFiles({
              knownChangedFiles: ['foo.js', 'bar.js', 'baz.js'],
            });
            expect(moduleMap.mergeFromCache, 'was not called');
          });
        });
      });
    });

    describe('_findAffectedFiles', function () {
      beforeEach(function () {
        moduleMap.entryFiles = new Set(['foo.js', 'bar.js']);
        moduleMap.set('foo.js', ModuleMapNode.create('foo.js'));
        moduleMap.set('bar.js', ModuleMapNode.create('bar.js'));
      });

      describe('when not provided any parameters', function () {
        it('should throw', function () {
          expect(
            // @ts-ignore
            () => moduleMap._findAffectedFiles(),
            'to throw',
            expect.it('to be a', TypeError)
          );
        });
      });

      describe('when provided a list of ModuleMapNode objects', function () {
        it('should return an object containing list of entry files & all affected files', function () {
          expect(
            moduleMap._findAffectedFiles([
              moduleMap.get('foo.js'),
              moduleMap.get('bar.js'),
            ]),
            'to equal',
            {
              allFiles: new Set(['foo.js', 'bar.js']),
              entryFiles: new Set(['foo.js', 'bar.js']),
            }
          );
        });

        describe('when ModuleMapNode objects reference entry files', function () {
          beforeEach(function () {
            moduleMap.set(
              'baz.js',
              ModuleMapNode.create('baz.js', {entryFiles: new Set(['foo.js'])})
            );
          });

          it('should return an object with a prop containing the reference entry file(s)', function () {
            expect(
              moduleMap._findAffectedFiles([
                moduleMap.get('foo.js'),
                moduleMap.get('bar.js'),
                moduleMap.get('baz.js'),
              ]),
              'to equal',
              {
                allFiles: new Set(['foo.js', 'bar.js', 'baz.js']),
                entryFiles: new Set(['foo.js', 'bar.js']),
              }
            );
          });

          describe('when ModuleMapNode objects reference parent files', function () {
            beforeEach(function () {
              moduleMap.set(
                'quux.js',
                ModuleMapNode.create('quux.js', {parents: new Set(['baz.js'])})
              );
            });

            it('should return an object with a prop containing the affected parent(s)', function () {
              expect(
                moduleMap._findAffectedFiles([
                  moduleMap.get('foo.js'),
                  moduleMap.get('bar.js'),
                  moduleMap.get('quux.js'),
                ]),
                'to equal',
                {
                  allFiles: new Set(['foo.js', 'bar.js', 'baz.js', 'quux.js']),
                  entryFiles: new Set(['foo.js', 'bar.js']),
                }
              );
            });
          });
        });
      });
    });

    describe('markFileAsChanged()', function () {
      it('should delegate to the file entry cache', function () {
        moduleMap.markFileAsChanged('foo.js');
        expect(
          moduleMap.fileEntryCache.markFileChanged,
          'to have a call satisfying',
          ['foo.js']
        ).and('was called once');
      });

      it('should return its context', function () {
        expect(moduleMap.markFileAsChanged('foo'), 'to be', moduleMap);
      });

      describe('when not provided a filepath parameter', function () {
        it('should throw', function () {
          expect(
            // @ts-ignore
            () => moduleMap.markFileAsChanged(),
            'to throw',
            expect.it('to be a', TypeError)
          );
        });
      });
    });
  });

  describe('interesting computed properties', function () {
    beforeEach(async function () {
      sinon.stub(ModuleMap.prototype, '_init').resolves();
      moduleMap = new ModuleMap();
      return moduleMap.ready;
    });

    describe('getters', function () {
      describe('entryDirectories', function () {
        beforeEach(function () {
          sinon
            .stub(moduleMap, 'entryFiles')
            .get(() => new Set(['foo.js', '/some/other/path.js']));
        });

        it('should return a set of all parent directories of entry files', function () {
          expect(
            moduleMap.entryDirectories,
            'to equal',
            new Set(['.', '/some/other'])
          );
        });
      });

      describe('directories', function () {
        beforeEach(function () {
          sinon
            .stub(moduleMap, 'files')
            .get(() => new Set(['foo.js', '/some/other/path.js']));
        });

        it('should return a set of all parent directories of all files', function () {
          expect(
            moduleMap.directories,
            'to equal',
            new Set(['.', '/some/other'])
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
