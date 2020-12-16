'use strict';

const path = require('path');
const rewiremock = require('rewiremock/node');
const sinon = require('sinon');
const expect = require('../expect');
const sortKeys = require('sort-keys');

describe('class MRCA', function () {
  let stubs;
  let mocks;

  /**
   * @type {typeof import('../../src/mrca').MRCA}
   */
  let MRCA;

  afterEach(function () {
    sinon.restore();
  });

  beforeEach(function () {
    /**
     * @type {MockFileEntryCache}
     */
    const FileEntryCache = Object.assign(
      /**
       * @type {import('sinon').SinonStub<any,import('sinon').SinonStubbedInstance<import('../../src/file-entry-cache').FileEntryCache>>}
       */
      sinon.stub().returns(
        Object.create({
          yieldChangedFiles: sinon
            .stub()
            .returns({changed: new Set(), missing: new Set()}),
          save: sinon.stub().returnsThis(),
          markFileChanged: sinon.stub().returnsThis(),
          reset: sinon.stub().returnsThis(),
        })
      ),
      {create: sinon.spy((...args) => FileEntryCache(...args))}
    );

    /**
     * @type {MockModuleGraph}
     */
    const ModuleGraph = Object.assign(
      sinon.stub().returns(
        Object.create({
          has: sinon.stub(),
          set: sinon.stub().returnsArg(0),
          normalize: sinon.stub(),
          import: sinon.stub().returnsThis(),
          isEntryFile: sinon.stub(),
          importFromFile: sinon.stub().returnsThis(),
          filterUntrackedFiles: sinon.stub().returns(new Set()),
          save: sinon.stub().returnsThis(),
          reset: sinon.stub().returnsThis(),
          toJSON: sinon.stub().returns({
            graph: {
              nodes: [],
              edges: [],
              attributes: [],
              options: [],
            },
          }),
          filepaths: new Set(),
          directories: new Set(),
          markMissing: sinon.stub().returnsThis(),
          getAncestors: sinon
            .stub()
            .returns({ancestors: new Set(), entryFiles: new Set()}),
        })
      ),
      {
        create: sinon.spy((...args) => ModuleGraph(...args)),
      }
    );

    mocks = {
      FileEntryCache,
      ModuleGraph,
    };

    stubs = {
      'file-entry-cache': {
        FileEntryCache: mocks.FileEntryCache,
      },
      'module-graph': {
        ModuleGraph: mocks.ModuleGraph,
      },
      resolver: {
        resolveDependencies: sinon.stub().returns(new Set()),
      },
      util: {
        findCacheDir: sinon.stub().returns('/some/cache/dir'),
      },
    };
    const mrcaModule = rewiremock.proxy(
      () => require('../../src/mrca'),
      (r) => ({
        [require.resolve('../../src/file-entry-cache')]: r
          .with(stubs['file-entry-cache'])
          .directChildOnly(),
        [require.resolve('../../src/util')]: r
          .with(stubs.util)
          .directChildOnly(),
        [require.resolve('../../src/resolver')]: r
          .with(stubs.resolver)
          .directChildOnly(),
        [require.resolve('../../src/module-graph')]: r
          .with(stubs['module-graph'])
          .directChildOnly(),
      })
    );
    MRCA = mrcaModule.MRCA;
  });

  describe('constructor', function () {
    /**
     * @type {MRCA}
     */
    let mrca;

    beforeEach(function () {
      sinon.stub(MRCA.prototype, '_init').resolves();

      mrca = new MRCA({
        entryFiles: ['foo.js', 'bar.js', 'baz.js'],
      });

      sinon.stub(mrca, 'cwd').get(() => '/pwd/');
    });

    it('should initialize', function () {
      expect(mrca._init, 'was called once');
    });

    it('should create/load a module graph', function () {
      expect(mocks.ModuleGraph.create, 'was called once');
    });

    it('should create/load a file entry cache', function () {
      expect(mocks.FileEntryCache.create, 'was called once');
    });

    it('should always add `cacheDir` to the `ignore` list', function () {
      expect(mrca.ignore, 'to contain', '/some/cache/dir');
    });
  });

  describe('instance method', function () {
    /** @type {MRCA & {moduleGraph: SinonStubbedInstance<ModuleGraph>, fileEntryCache: SinonStubbedInstance<FileEntryCache>}} */
    let mrca;

    beforeEach(async function () {
      const initStub = sinon.stub(MRCA.prototype, '_init').resolves();

      mrca = /** @type {MRCA & {moduleGraph: SinonStubbedInstance<ModuleGraph>, fileEntryCache: SinonStubbedInstance<FileEntryCache>}} */ (MRCA.create(
        {
          entryFiles: ['foo.js', 'bar.js', 'baz.js'],
          reset: true,
        }
      ));
      sinon.stub(mrca, 'cwd').get(() => '/pwd/');

      await mrca.ready;
      initStub.restore();
    });

    describe('_init()', function () {
      beforeEach(function () {
        sinon.stub(mrca, '_hydrate').resolves();
        sinon.stub(mrca, 'save').returnsThis();
        sinon
          .stub(mrca, '_yieldChangedFiles')
          .returns({changed: new Set(), missing: new Set()});
        mrca.moduleGraph.has.returns(true);
      });

      describe('when node already found for entry file', function () {
        beforeEach(async function () {
          mrca.moduleGraph.isEntryFile.withArgs('foo.js').returns(true);

          mrca.moduleGraph.set.resetHistory();
          return mrca._init();
        });

        it('should not create another node', function () {
          expect(mrca.moduleGraph.set, 'not to have calls satisfying', [
            'foo.js',
          ]).and('was called twice'); // for bar and baz
        });
      });

      describe('when entry files have changed', function () {
        beforeEach(async function () {
          /** @type {SinonStub<[filepaths?: Set<string>],FilesInfo>} */
          (mrca._yieldChangedFiles).returns({
            changed: new Set(['foo.js']),
            missing: new Set(),
          });
          mrca.moduleGraph.isEntryFile.returns(true);
          return mrca._init();
        });

        it('should yield changed files (which will persist the file entry cache)', function () {
          expect(mrca._yieldChangedFiles, 'was called once');
        });

        it('should populate starting from entry files', function () {
          expect(mrca._hydrate, 'to have a call satisfying', [
            new Set(['foo.js']),
          ]);
        });

        it('should persist the module graph', function () {
          expect(mrca.save, 'was called once');
        });
      });

      describe('when no files have changed', function () {
        beforeEach(async function () {
          mrca.moduleGraph.isEntryFile.returns(true);
          return mrca._init();
        });

        it('should not populate anything', function () {
          expect(mrca._hydrate, 'was not called');
        });
      });

      describe('when provided no options', function () {
        beforeEach(function () {
          mrca._init();
        });

        it('should not reset the module graph', function () {
          expect(mrca.moduleGraph.reset, 'was not called');
        });

        it('should not reset the file entry cache', function () {
          expect(mrca.fileEntryCache.reset, 'was not called');
        });
      });

      describe('when option `reset` is truthy', function () {
        beforeEach(function () {
          mrca._init({reset: true});
        });
        it('should reset the module graph', function () {
          expect(mrca.moduleGraph.reset, 'was called once');
        });

        it('should reset the file entry cache', function () {
          expect(mrca.fileEntryCache.reset, 'was called once');
        });
      });
    });

    // describe.skip('delete()', function () {
    //   describe('when deleting a child', function () {
    //     beforeEach(function () {
    //       mrca.set(
    //         'foo.js',
    //         ModuleMapNode.create('foo.js', {
    //           children: ['/some/child.js', '/some/other/child.js'],
    //         })
    //       );
    //       mrca.set('bar.js', ModuleMapNode.create('bar.js'));
    //       mrca.set(
    //         '/some/child.js',
    //         ModuleMapNode.create('/some/child.js', {
    //           parents: ['foo.js'],
    //         })
    //       );
    //       mrca.set(
    //         '/some/other/child.js',
    //         ModuleMapNode.create('/some/other/child.js', {
    //           parents: ['foo.js'],
    //         })
    //       );
    //     });

    //     it('should remove the child from all parents', function () {
    //       mrca.delete('/some/other/child.js');
    //       expect(
    //         mrca,
    //         'to exhaustively satisfy',
    //         new Map([
    //           [
    //             'foo.js',
    //             ModuleMapNode.create('foo.js', {
    //               children: ['/some/child.js'],
    //             }),
    //           ],
    //           [
    //             'bar.js',
    //             ModuleMapNode.create('bar.js', {
    //               children: [],
    //             }),
    //           ],
    //           [
    //             '/some/child.js',
    //             ModuleMapNode.create('/some/child.js', {
    //               parents: ['foo.js'],
    //             }),
    //           ],
    //         ])
    //       );
    //     });
    //   });

    //   describe('when deletion creates orphaned children', function () {
    //     beforeEach(function () {
    //       mrca.set(
    //         'foo.js',
    //         ModuleMapNode.create('foo.js', {
    //           children: ['/some/child.js', '/some/other/child.js'],
    //         })
    //       );
    //       mrca.set('bar.js', ModuleMapNode.create('bar.js'));
    //       mrca.set(
    //         '/some/child.js',
    //         ModuleMapNode.create('/some/child.js', {
    //           parents: ['foo.js'],
    //         })
    //       );
    //       mrca.set(
    //         '/some/other/child.js',
    //         ModuleMapNode.create('/some/other/child.js', {
    //           parents: ['foo.js'],
    //         })
    //       );
    //     });

    //     it('should delete orphaned children (cascading delete)', function () {
    //       expect(mrca.delete('foo.js'), 'to be true');
    //       expect(mrca, 'to have size', 1).and(
    //         'to exhaustively satisfy',
    //         new Map([['bar.js', ModuleMapNode.create('bar.js')]])
    //       );
    //     });
    //   });

    //   describe('when deletion does not create orphaned children', function () {
    //     beforeEach(function () {
    //       mrca.set(
    //         'foo.js',
    //         ModuleMapNode.create('foo.js', {
    //           children: ['/some/child.js', '/some/other/child.js'],
    //         })
    //       );
    //       mrca.set(
    //         'bar.js',
    //         ModuleMapNode.create('bar.js', {
    //           children: ['/some/other/child.js'],
    //         })
    //       );
    //       mrca.set(
    //         '/some/child.js',
    //         ModuleMapNode.create('/some/child.js', {
    //           parents: ['foo.js'],
    //         })
    //       );
    //       mrca.set(
    //         '/some/other/child.js',
    //         ModuleMapNode.create('/some/other/child.js', {
    //           parents: ['bar.js', 'foo.js'],
    //         })
    //       );
    //     });

    //     it('should not delete children having other parents', function () {
    //       mrca.delete('foo.js');
    //       expect(
    //         mrca,
    //         'to exhaustively satisfy',
    //         new Map([
    //           [
    //             'bar.js',
    //             ModuleMapNode.create('bar.js', {
    //               children: ['/some/other/child.js'],
    //             }),
    //           ],
    //           [
    //             '/some/other/child.js',
    //             ModuleMapNode.create('/some/other/child.js', {
    //               parents: ['bar.js'],
    //             }),
    //           ],
    //         ])
    //       );
    //     });
    //   });
    // });

    describe('save()', function () {
      describe('when `persistFileEntryCache` option is falsy', function () {
        beforeEach(function () {
          mrca.save();
        });

        it('should persist the module graph', function () {
          expect(mrca.moduleGraph.save, 'was called once');
        });

        it('should not persist the file entry cache', function () {
          expect(mrca.fileEntryCache.save, 'was not called');
        });
      });

      describe('when `persistFileEntryCache` option is truthy', function () {
        beforeEach(function () {
          mrca.save({persistFileEntryCache: true});
        });

        it('should persist the module graph', function () {
          expect(mrca.moduleGraph.save, 'was called once');
        });

        it('should persist the file entry cache', function () {
          expect(mrca.fileEntryCache.save, 'was called once');
        });
      });

      it('should return its context', function () {
        expect(mrca.save(), 'to be', mrca);
      });
    });

    describe('toJSON()', function () {
      beforeEach(function () {
        mrca.moduleGraph.toJSON.returns(
          sortKeys(
            {
              cwd: mrca.moduleGraph.cwd,
              cacheDir: mrca.moduleGraph.cacheDir,
              filename: mrca.moduleGraph.filename,
              useRealPaths: mrca.moduleGraph.useRealPaths,
              graph: {
                attributes: {},
                nodes: [
                  {key: 'herp.js', attributes: {entryFile: true}},
                  {key: 'quux.js', attributes: {entryFile: true}},
                  {key: 'derp.js', attributes: {entryFile: true}},
                  {key: 'foo.js'},
                  {key: 'bar.js'},
                  {key: 'baz.js'},
                  {key: 'spam.js'},
                ],
                edges: [
                  {source: 'foo.js', target: 'herp.js'},
                  {source: 'bar.js', target: 'foo.js'},
                  {source: 'baz.js', target: 'foo.js'},
                  {source: 'baz.js', target: 'quux.js'},
                  {source: 'spam.js', target: 'derp.js'},
                ],
                options: {type: 'directed', multi: false, allowSelfLoops: true},
              },
            },
            {deep: true}
          )
        );
      });

      it('should return a stable representation of the instance', function () {
        expect(mrca.toJSON(), 'to equal snapshot', {
          cacheDir: '/some/cache/dir',
          cwd: '/pwd/',
          entryFiles: ['foo.js', 'bar.js', 'baz.js'],
          ignore: ['/some/cache/dir'],
          moduleGraph: {
            cacheDir: undefined,
            cwd: undefined,
            filename: undefined,
            graph: {
              attributes: {},
              edges: [
                {source: 'foo.js', target: 'herp.js'},
                {source: 'bar.js', target: 'foo.js'},
                {source: 'baz.js', target: 'foo.js'},
                {source: 'baz.js', target: 'quux.js'},
                {source: 'spam.js', target: 'derp.js'},
              ],
              nodes: [
                {attributes: {entryFile: true}, key: 'herp.js'},
                {attributes: {entryFile: true}, key: 'quux.js'},
                {attributes: {entryFile: true}, key: 'derp.js'},
                {key: 'foo.js'},
                {key: 'bar.js'},
                {key: 'baz.js'},
                {key: 'spam.js'},
              ],
              options: {allowSelfLoops: true, multi: false, type: 'directed'},
            },
            useRealPaths: undefined,
          },
          tsConfigPath: undefined,
          webpackConfigPath: undefined,
        });
      });
    });

    describe('addEntryFile()', function () {
      beforeEach(function () {
        sinon.stub(mrca, 'cwd').get(() => '/some/farm/animals');
        sinon.stub(mrca, '_hydrate').returnsThis();
        sinon.spy(mrca.entryFiles, 'add');
      });

      describe('when provided a relative filepath', function () {
        it('should resolve the filepath relative to the `cwd` prop', function () {
          mrca.addEntryFile('foo.js');
          expect(mrca.entryFiles.add, 'to have a call satisfying', [
            '/some/farm/animals/foo.js',
          ]);
        });
      });

      describe('when provided a file which is already known but not an entry file', function () {
        beforeEach(function () {
          sinon
            .stub(mrca, 'has')
            .withArgs('/some/farm/animals/foo.js')
            .returns(true);
          mrca.addEntryFile('/some/farm/animals/foo.js');
        });

        it('should add the entry file', function () {
          expect(mrca.entryFiles.add, 'was called once');
        });

        it('should not attempt to re-populate from an already known file', function () {
          mrca.addEntryFile('/some/farm/animals/foo.js');
          expect(mrca._hydrate, 'was not called');
        });
      });

      describe('when provided a file which is already an entry file', function () {
        beforeEach(function () {
          mrca.entryFiles.add('/some/farm/animals/foo.js');
          sinon
            .stub(mrca, 'has')
            .withArgs('/some/farm/animals/foo.js')
            .returns(true);
        });

        it('should not attempt to add the entry file', function () {
          mrca.addEntryFile('/some/farm/animals/foo.js');
          expect(mrca.entryFiles.add, 'was called once');
        });

        it('should not attempt to re-populate from an already known file', function () {
          mrca.addEntryFile('/some/farm/animals/foo.js');
          expect(mrca._hydrate, 'was not called');
        });
      });
    });

    describe('_hydrate()', function () {
      let filepaths;

      beforeEach(function () {
        filepaths = ['foo.js', 'bar.js', 'baz.js'];
      });

      describe('when no dependencies for the nodes are found', function () {
        beforeEach(function () {
          sinon.stub(mrca, 'findAllDependencies').resolves(new Map());
        });

        it('should only attempt to find dependencies for provided filepaths', async function () {
          await mrca._hydrate(filepaths);
          expect(mrca.findAllDependencies, 'to have a call satisfying', [
            ['foo.js', 'bar.js', 'baz.js'],
          ]).and('was called once');
        });
      });

      describe('when dependencies are found', function () {
        beforeEach(async function () {
          sinon
            .stub(mrca, 'findAllDependencies')
            .resolves(
              new Map([
                [
                  'foo.js',
                  {resolved: new Set(['quux.js']), missing: new Set()},
                ],
              ])
            );
          return mrca._hydrate(filepaths);
        });

        it('should attempt to find transitive dependencies', function () {
          expect(mrca.findAllDependencies, 'to have a call satisfying', [
            ['quux.js'],
          ]);
        });

        it('should assign `parents` attribute to found dependency nodes', function () {
          expect(mrca.moduleGraph.set, 'to have a call satisfying', [
            'quux.js',
            {parents: new Set(['foo.js'])},
          ]);
        });
      });

      describe('when the same deps are found multiple times', function () {
        beforeEach(async function () {
          const findAllDependencies = sinon.stub(mrca, 'findAllDependencies');
          // foo.js depends on quux.js
          findAllDependencies
            .onFirstCall()
            .resolves(
              new Map([
                [
                  'foo.js',
                  {resolved: new Set(['quux.js']), missing: new Set()},
                ],
              ])
            );
          // quux.js depends on bar.js, but we've already processed bar.js in the first call.
          findAllDependencies
            .onSecondCall()
            .resolves(
              new Map([
                [
                  'quux.js',
                  {resolved: new Set(['bar.js']), missing: new Set()},
                ],
              ])
            );
          return mrca._hydrate([...filepaths.values()]);
        });

        it('should not re-process the same deps', function () {
          expect(mrca.findAllDependencies, 'was called twice');
        });
      });
    });

    describe('_yieldChangedFiles()', function () {
      /**
       * @type {SinonStub<[filepath?: string],boolean>}
       */
      let hasStub;

      beforeEach(function () {
        sinon
          .stub(mrca.moduleGraph, 'filepaths')
          .get(() => ['foo.js', 'bar.js', 'baz.js']);
        sinon.stub(mrca, 'save');
        hasStub = sinon.stub(mrca, 'has').returns(true);
      });

      it('should delegate to the file entry cache', function () {
        mrca._yieldChangedFiles();
        expect(
          mrca.fileEntryCache.yieldChangedFiles,
          'to have a call satisfying',
          [mrca.moduleGraph.filepaths]
        ).and('was called once');
      });

      describe('when the file entry cache returns a nonempty list of missing ("not found") files', function () {
        beforeEach(function () {
          mrca.fileEntryCache.yieldChangedFiles.returns({
            changed: new Set(['baz.js']),
            missing: new Set(['foo.js', 'bar.js']),
          });
        });

        it('should mark each "not found" file as missing', function () {
          mrca._yieldChangedFiles();
          expect(mrca.moduleGraph.markMissing, 'to have calls satisfying', [
            ['foo.js'],
            ['bar.js'],
          ]).and('was called twice');
        });

        it('should persist the module graph', function () {
          mrca._yieldChangedFiles();
          expect(mrca.save, 'was called once');
        });

        it('should pass thru the return value from the file entry cache', function () {
          expect(mrca._yieldChangedFiles(), 'to equal', {
            changed: new Set(['baz.js']),
            missing: new Set(['foo.js', 'bar.js']),
          });
        });
      });

      describe('when the file entry cache return an empty list of missing ("not found") files', function () {
        beforeEach(function () {
          mrca.fileEntryCache.yieldChangedFiles.returns({
            changed: new Set(['baz.js']),
            missing: new Set(),
          });
        });

        it('should persist the module graph', function () {
          mrca._yieldChangedFiles();
          expect(mrca.save, 'was called once');
        });

        it('should return the list of changed files', function () {
          expect(mrca._yieldChangedFiles(), 'to equal', {
            changed: new Set(['baz.js']),
            missing: new Set(),
          });
        });
      });

      describe('when the file entry cache returns empty lists', function () {
        beforeEach(function () {
          mrca.fileEntryCache.yieldChangedFiles.returns({
            changed: new Set(),
            missing: new Set(),
          });
        });

        it('should not persist the module graph', function () {
          mrca._yieldChangedFiles();
          expect(mrca.save, 'was not called');
        });

        it('should return the empty lists', function () {
          expect(mrca._yieldChangedFiles(), 'to equal', {
            changed: new Set(),
            missing: new Set(),
          });
        });
      });

      describe('when provided an explicit list of files', function () {
        describe('when a filepath provided is unknown to the module map', function () {
          beforeEach(function () {
            hasStub.returns(false);
          });

          it('should throw', function () {
            expect(
              () => mrca._yieldChangedFiles(new Set(['quux.js'])),
              'to throw',
              expect.it('to be a', ReferenceError)
            );
          });
        });

        describe('when all filepaths are known to the module map', function () {
          it('should provide the list to the file entry cache', function () {
            mrca._yieldChangedFiles(new Set(['quux.js', 'baz.js']));
            expect(
              mrca.fileEntryCache.yieldChangedFiles,
              'to have a call satisfying',
              [new Set(['quux.js', 'baz.js'])]
            ).and('was called once');
          });
        });
      });
    });

    describe('findAffectedFilesForChangedFiles()', function () {
      beforeEach(function () {
        sinon.stub(mrca, 'markFileChanged');
        sinon.stub(mrca, '_yieldChangedFiles').returns({
          changed: new Set(['changed.js']),
          missing: new Set(['missing.js']),
        });
        sinon.stub(mrca, '_hydrate').resolves();
        sinon.stub(mrca, '_findAffectedFiles').callsFake((value) => {
          const valueSet = new Set(value);
          return valueSet.size
            ? {
                entryFiles: valueSet,
                allFiles: valueSet,
              }
            : {entryFiles: new Set(), allFiles: new Set()};
        });
      });

      it('should pass list of changed and missing files into _findAffectedFiles', async function () {
        /**
         * @type {SinonStub<Parameters<MRCA['_yieldChangedFiles']>,ReturnType<MRCA['_yieldChangedFiles']>>}
         */ (mrca._yieldChangedFiles).returns({
          changed: new Set(['changed.js']),
          missing: new Set(['missing.js']),
        });

        return expect(
          mrca.findAffectedFilesForChangedFiles(),
          'to be fulfilled with',
          new Set()
        );
      });

      describe('when provided known changed files', function () {
        it('should explicitly mark each file given as "changed"', async function () {
          await mrca.findAffectedFilesForChangedFiles({
            knownChangedFiles: ['foo.js', 'bar.js'],
          });
          expect(mrca.markFileChanged, 'to have calls satisfying', [
            [path.join(mrca.cwd, 'foo.js')],
            [path.join(mrca.cwd, 'bar.js')],
          ]).and('was called twice');
        });
      });

      describe('when not provided known changed files', function () {
        it('should not mark any file as explicitly changed', async function () {
          await mrca.findAffectedFilesForChangedFiles();
          expect(mrca.markFileChanged, 'was not called');
        });
      });

      it('should query for a list of changed files', async function () {
        await mrca.findAffectedFilesForChangedFiles();
        expect(mrca._yieldChangedFiles, 'was called once');
      });

      describe('when no files have changed', function () {
        beforeEach(function () {
          /**
           * @type {SinonStub<Parameters<MRCA['_yieldChangedFiles']>,ReturnType<MRCA['_yieldChangedFiles']>>}
           */ (mrca._yieldChangedFiles).returns({
            changed: new Set(),
            missing: new Set(),
          });
        });
        it('should return a vast emptiness', async function () {
          return expect(
            mrca.findAffectedFilesForChangedFiles(),
            'to be fulfilled with value equal to',
            {
              entryFiles: new Set(),
              allFiles: new Set(),
            }
          );
        });
      });

      describe('when files have changed', function () {
        beforeEach(function () {
          /**
           * @type {SinonStub<Parameters<MRCA['_yieldChangedFiles']>,ReturnType<MRCA['_yieldChangedFiles']>>}
           */ (mrca._yieldChangedFiles).returns({
            changed: new Set(['foo.js', 'bar.js']),
            missing: new Set(),
          });
        });

        it('should re-hydrate the changed files', async function () {
          await mrca.findAffectedFilesForChangedFiles({
            knownChangedFiles: ['foo.js', 'bar.js'],
          });
          expect(
            mrca._hydrate,
            'to have a call satisfying',
            new Set(['foo.js', 'bar.js'])
          ).and('was called once');
        });

        it('should verify the changed/missing files are tracked', async function () {
          await mrca.findAffectedFilesForChangedFiles({
            knownChangedFiles: ['foo.js', 'bar.js'],
          });
          expect(
            mrca.moduleGraph.filterUntrackedFiles,
            'to have a call satisfying',
            [['foo.js', 'bar.js']]
          );
        });

        describe('when one or more "changed" or "missing" files are untracked', function () {
          it('should reload from disk');
        });

        describe('when all files are tracked', function () {
          it('should not reload from disk');
        });
      });
    });

    describe('_findAffectedFiles', function () {
      beforeEach(function () {
        mrca.moduleGraph.import({
          attributes: {},
          nodes: [
            {key: 'herp.js', attributes: {entryFile: true}},
            {key: 'quux.js', attributes: {entryFile: true}},
            {key: 'derp.js', attributes: {entryFile: true}},
            {key: 'foo.js'},
            {key: 'bar.js'},
            {key: 'baz.js'},
            {key: 'spam.js'},
          ],
          edges: [
            {source: 'foo.js', target: 'herp.js'},
            {source: 'bar.js', target: 'foo.js'},
            {source: 'baz.js', target: 'foo.js'},
            {source: 'baz.js', target: 'quux.js'},
            {source: 'spam.js', target: 'derp.js'},
          ],
          options: {type: 'directed', multi: false, allowSelfLoops: true},
        });
        mrca.entryFiles = new Set(['herp.js', 'quux.js', 'derp.js']);
      });

      describe('when not provided any parameters', function () {
        it('should throw', function () {
          expect(
            // @ts-ignore
            () => mrca._findAffectedFiles(),
            'to throw',
            expect.it('to be a', TypeError)
          );
        });
      });

      describe('when provided a list of filepaths', function () {
        it('should return an object containing filepaths within `allFiles` list', function () {
          expect(mrca._findAffectedFiles(['foo.js', 'bar.js']), 'to equal', {
            allFiles: new Set(['foo.js', 'bar.js']),
            entryFiles: new Set(),
          });
        });

        describe('when filepaths have entry file ancestors', function () {
          beforeEach(function () {
            mrca.moduleGraph.getAncestors.withArgs('foo.js').returns({
              entryFiles: new Set(['herp.js']),
              ancestors: new Set(['herp.js']),
            });
          });

          it('should return an object with lists containing the ancestor entry file(s)', function () {
            expect(mrca._findAffectedFiles(['foo.js']), 'to equal', {
              allFiles: new Set(['foo.js', 'herp.js']),
              entryFiles: new Set(['herp.js']),
            });
          });

          describe('when filepaths have non-entry-file parents', function () {
            beforeEach(function () {
              mrca.moduleGraph.getAncestors.withArgs('bar.js').returns({
                entryFiles: new Set(['herp.js']),
                ancestors: new Set(['foo.js', 'herp.js']),
              });
            });

            it('should return an object with a prop containing the affected parent(s)', function () {
              expect(mrca._findAffectedFiles(['bar.js']), 'to equal', {
                allFiles: new Set(['foo.js', 'bar.js', 'herp.js']),
                entryFiles: new Set(['herp.js']),
              });
            });
          });
        });
      });
    });

    describe('markFileChanged()', function () {
      it('should delegate to the file entry cache', function () {
        mrca.markFileChanged('foo.js');
        expect(
          mrca.fileEntryCache.markFileChanged,
          'to have a call satisfying',
          ['foo.js']
        ).and('was called once');
      });

      it('should return its context', function () {
        expect(mrca.markFileChanged('foo'), 'to be', mrca);
      });
    });

    describe('findAllDependencies()', function () {
      describe('when not provided any parameters', function () {
        it('should reject with a TypeError', async function () {
          return expect(
            // @ts-ignore
            mrca.findAllDependencies(),
            'to be rejected with',
            expect.it('to be a', TypeError)
          );
        });
      });

      describe('when provided a non-iterable parameter', function () {
        it('should reject with TypeError', async function () {
          return expect(
            // @ts-ignore
            mrca.findAllDependencies(42),
            'to be rejected with',
            expect.it('to be a', TypeError)
          );
        });
      });

      describe('when provided an empty iterable parameter', function () {
        it('should resolve with an empty Map', async function () {
          return expect(
            mrca.findAllDependencies([]),
            'to be fulfilled with',
            new Map()
          );
        });
      });

      describe('when provided a Set of filepaths', function () {
        it('should return a Map of each filepath to its set of dependencies', async function () {
          stubs.resolver.resolveDependencies
            .onFirstCall()
            .returns(new Set(['baz.js']));
          stubs.resolver.resolveDependencies
            .onSecondCall()
            .returns(new Set(['quux.js']));
          return expect(
            mrca.findAllDependencies(['foo.js', 'bar.js']),
            'to be fulfilled with',
            new Map([
              ['foo.js', new Set(['baz.js'])],
              ['bar.js', new Set(['quux.js'])],
            ])
          );
        });

        it('should call Resolver.resolveDependencies using absolute filepath for each filepath', async function () {
          const opts = {
            cwd: mrca.cwd,
            ignore: mrca.ignore,
            tsConfigPath: mrca.tsConfigPath,
            webpackConfigPath: mrca.webpackConfigPath,
          };
          await mrca.findAllDependencies(['foo.js', 'bar.js']);
          expect(
            stubs.resolver.resolveDependencies,
            'to have calls satisfying',
            [
              [path.resolve(mrca.cwd, 'foo.js'), opts],
              [path.resolve(mrca.cwd, 'bar.js'), opts],
            ]
          ).and('was called twice');
        });
      });
    });
  });

  describe('interesting computed properties', function () {
    /**
     * @type {MRCA}
     */
    let mrca;

    beforeEach(async function () {
      sinon.stub(MRCA.prototype, '_init').resolves();
      mrca = new MRCA();
      return mrca.ready;
    });

    describe('getters', function () {
      describe('directories', function () {
        beforeEach(function () {
          sinon
            .stub(mrca.moduleGraph, 'directories')
            .get(() => new Set(['.', '/some/other']));
        });

        it('should delegate to the ModuleGraph', function () {
          expect(mrca.directories, 'to equal', new Set(['.', '/some/other']));
        });
      });

      describe('filepaths', function () {
        beforeEach(function () {
          sinon
            .stub(mrca.moduleGraph, 'filepaths')
            .get(() => new Set(['a.js', 'b.js', 'c.js']));
        });

        it('should delegate to the ModuleGraph', function () {
          expect(mrca.filepaths, 'to equal', new Set(['a.js', 'b.js', 'c.js']));
        });
      });
    });
  });
});

/**
 * @template T,U
 * @typedef {import('sinon').SinonStub<T,U>} SinonStub<T,U>
 */

/**
 * @template T,U
 * @typedef {import('sinon').SinonSpy<T,U>} SinonSpy<T,U>
 */

/**
 * @typedef {import('../../src/mrca').MRCA} MRCA
 */

/**
 * @template T
 * @typedef {import('sinon').SinonStubbedInstance<T>} SinonStubbedInstance<T>
 */

/**
 * @typedef {import('../../src/file-entry-cache').FileEntryCache} FileEntryCache
 */

/**
 * @typedef {SinonSpy<any,SinonStubbedInstance<FileEntryCache>> & {create: SinonSpy<any,SinonStubbedInstance<FileEntryCache>>}} MockFileEntryCache
 */

/**
 * @typedef {import('../../src/module-graph').ModuleGraph} ModuleGraph
 */

/**
 * @typedef {SinonSpy<any,SinonStubbedInstance<ModuleGraph>> & {create: SinonSpy<any,SinonStubbedInstance<ModuleGraph>>}} MockModuleGraph
 */

/**
 * @typedef {import('../../src/file-entry-cache').FilesInfo} FilesInfo
 */
