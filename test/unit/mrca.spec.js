'use strict';

const path = require('path');
const rewiremock = require('rewiremock/node');
const sinon = require('sinon');
const expect = require('../expect');
const sortKeys = require('sort-keys');

describe('class MRCA', function() {
  let stubs;
  let mocks;

  let MRCA;

  afterEach(function() {
    sinon.restore();
  });

  beforeEach(function() {
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
            .returns({changed: new Set(), notFound: new Set()}),
          save: sinon.stub().returnsThis(),
          markFileChanged: sinon.stub().returnsThis(),
          reset: sinon.stub().returnsThis()
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
          save: sinon.stub().returnsThis(),
          reset: sinon.stub().returnsThis(),
          toJSON: sinon.stub().returns({
            graph: {
              nodes: [],
              edges: [],
              attributes: [],
              options: []
            }
          })
        })
      ),
      {
        create: sinon.spy((...args) => ModuleGraph(...args))
      }
    );

    mocks = {
      FileEntryCache,
      ModuleGraph
    };

    stubs = {
      'file-entry-cache': {
        FileEntryCache: mocks.FileEntryCache
      },
      'module-graph': {
        ModuleGraph: mocks.ModuleGraph
      },
      resolver: {
        resolveDependencies: sinon.stub().returns(new Set())
      },
      util: {
        findCacheDir: sinon.stub().returns('/some/cache/dir')
      }
    };
    const mrcaModule = rewiremock.proxy(
      () => require('../../src/mrca'),
      r => ({
        [require.resolve('../../src/file-entry-cache')]: r.with(
          stubs['file-entry-cache']
        ),
        [require.resolve('../../src/util')]: r.with(stubs.util),
        [require.resolve('../../src/resolver')]: r.with(stubs.resolver),
        [require.resolve('../../src/module-graph')]: r.with(
          stubs['module-graph']
        )
      })
    );
    MRCA = mrcaModule.MRCA;
  });

  describe('constructor', function() {
    let mrca;

    beforeEach(function() {
      sinon.stub(MRCA.prototype, '_init').resolves();

      mrca = new MRCA({
        entryFiles: ['foo.js', 'bar.js', 'baz.js']
      });

      sinon.stub(mrca, 'cwd').get(() => '/pwd/');
    });

    it('should initialize', function() {
      expect(mrca._init, 'was called once');
    });

    it('should create/load a module graph', function() {
      expect(mocks.ModuleGraph.create, 'was called once');
    });

    it('should create/load a file entry cache', function() {
      expect(mocks.FileEntryCache.create, 'was called once');
    });

    it('should always add `cacheDir` to the `ignore` list', function() {
      expect(mrca.ignore, 'to contain', '/some/cache/dir');
    });
  });

  describe('instance method', function() {
    let mrca;

    beforeEach(async function() {
      const initStub = sinon.stub(MRCA.prototype, '_init').resolves();

      mrca = MRCA.create({
        entryFiles: ['foo.js', 'bar.js', 'baz.js'],
        reset: true
      });
      sinon.stub(mrca, 'cwd').get(() => '/pwd/');

      await mrca.ready;
      initStub.restore();
    });

    describe('_init()', function() {
      beforeEach(function() {
        sinon.stub(mrca, '_hydrate').resolves();
        sinon.stub(mrca, 'save').returnsThis();
        sinon
          .stub(mrca, '_yieldChangedFiles')
          .returns({changed: new Set(), notFound: new Set()});
        mrca.initialized = false;
        mrca.moduleGraph.has.returns(true);
      });

      describe('when already initialized', function() {
        beforeEach(function() {
          mrca.initialized = true;
        });

        describe('when option `force` is falsy', function() {
          it('should reject', async function() {
            return expect(() => mrca._init(), 'to be rejected');
          });
        });

        describe('when option `force` is truthy', function() {
          it('should reinit', function() {
            expect(() => mrca._init({force: true}), 'not to throw');
          });
        });
      });

      describe('when node already found for entry file', function() {
        beforeEach(async function() {
          mrca.moduleGraph.isEntryFile.withArgs('foo.js').returns(true);

          mrca.moduleGraph.set.resetHistory();
          return mrca._init();
        });

        it('should not create another node', function() {
          expect(mrca.moduleGraph.set, 'not to have calls satisfying', [
            'foo.js'
          ]).and('was called twice'); // for bar and baz
        });
      });

      describe('when entry files have changed', function() {
        beforeEach(async function() {
          mrca._yieldChangedFiles.returns({
            changed: new Set(['foo.js']),
            notFound: new Set()
          });
          mrca.moduleGraph.isEntryFile.returns(true);
          return mrca._init();
        });

        it('should yield changed files (which will persist the file entry cache)', function() {
          expect(mrca._yieldChangedFiles, 'was called once');
        });

        it('should populate starting from entry files', function() {
          expect(mrca._hydrate, 'to have a call satisfying', [
            new Set(['foo.js'])
          ]);
        });

        it('should persist the module graph', function() {
          expect(mrca.save, 'was called once');
        });
      });

      describe('when no files have changed', function() {
        beforeEach(async function() {
          mrca.moduleGraph.isEntryFile.returns(true);
          return mrca._init();
        });

        it('should not populate anything', function() {
          expect(mrca._hydrate, 'was not called');
        });
      });

      describe('when provided no options', function() {
        beforeEach(function() {
          mrca._init();
        });

        it('should not reset the module graph', function() {
          expect(mrca.moduleGraph.reset, 'was not called');
        });

        it('should not reset the file entry cache', function() {
          expect(mrca.fileEntryCache.reset, 'was not called');
        });
      });

      describe('when option `reset` is truthy', function() {
        beforeEach(function() {
          mrca._init({reset: true});
        });
        it('should reset the module graph', function() {
          expect(mrca.moduleGraph.reset, 'was called once');
        });

        it('should reset the file entry cache', function() {
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

    describe('save()', function() {
      describe('when `persistFileEntryCache` option is falsy', function() {
        beforeEach(function() {
          mrca.save();
        });

        it('should persist the module graph', function() {
          expect(mrca.moduleGraph.save, 'was called once');
        });

        it('should not persist the file entry cache', function() {
          expect(mrca.fileEntryCache.save, 'was not called');
        });
      });

      describe('when `persistFileEntryCache` option is truthy', function() {
        beforeEach(function() {
          mrca.save({persistFileEntryCache: true});
        });

        it('should persist the module graph', function() {
          expect(mrca.moduleGraph.save, 'was called once');
        });

        it('should persist the file entry cache', function() {
          expect(mrca.fileEntryCache.save, 'was called once');
        });
      });

      it('should return its context', function() {
        expect(mrca.save(), 'to be', mrca);
      });
    });

    describe('toJSON()', function() {
      beforeEach(function() {
        mrca.moduleGraph.toJSON.returns(
          sortKeys(
            {
              attributes: {},
              nodes: [
                {key: 'herp.js', attributes: {entryFile: true}},
                {key: 'quux.js', attributes: {entryFile: true}},
                {key: 'derp.js', attributes: {entryFile: true}},
                {key: 'foo.js'},
                {key: 'bar.js'},
                {key: 'baz.js'},
                {key: 'spam.js'}
              ],
              edges: [
                {source: 'foo.js', target: 'herp.js'},
                {source: 'bar.js', target: 'foo.js'},
                {source: 'baz.js', target: 'foo.js'},
                {source: 'baz.js', target: 'quux.js'},
                {source: 'spam.js', target: 'derp.js'}
              ],
              options: {type: 'directed', multi: false, allowSelfLoops: true}
            },
            {deep: true}
          )
        );
      });

      it('should return a stable representation of the instance', function() {
        expect(mrca.toJSON(), 'to equal snapshot', {
          cacheDir: '/some/cache/dir',
          cwd: '/pwd/',
          entryFiles: ['foo.js', 'bar.js', 'baz.js'],
          ignore: ['/some/cache/dir'],
          moduleGraph: {
            attributes: {},
            edges: [
              {source: 'foo.js', target: 'herp.js'},
              {source: 'bar.js', target: 'foo.js'},
              {source: 'baz.js', target: 'foo.js'},
              {source: 'baz.js', target: 'quux.js'},
              {source: 'spam.js', target: 'derp.js'}
            ],
            nodes: [
              {attributes: {entryFile: true}, key: 'herp.js'},
              {attributes: {entryFile: true}, key: 'quux.js'},
              {attributes: {entryFile: true}, key: 'derp.js'},
              {key: 'foo.js'},
              {key: 'bar.js'},
              {key: 'baz.js'},
              {key: 'spam.js'}
            ],
            options: {allowSelfLoops: true, multi: false, type: 'directed'}
          },
          tsConfigPath: undefined,
          webpackConfigPath: undefined
        });
      });
    });

    describe.skip('mergeFromCache()', function() {
      beforeEach(function() {
        sinon.spy(mrca, 'clear');
      });

      describe('when provided option destructive = true', function() {
        it('should clear the module map', function() {
          mrca.mergeFromCache({destructive: true});
          expect(mrca.clear, 'was called once');
        });
      });

      describe('when not provided option destructive = true', function() {
        it('should not clear the module map', function() {
          mrca.mergeFromCache();
          expect(mrca.clear, 'was not called');
        });
      });

      it('should overwrite existing values with the contents of the cache', function() {
        mrca.set(
          'foo.js',
          ModuleMapNode.create('foo.js', {
            children: [],
            parents: [],
            entryFiles: []
          })
        );
        mrca.set('bar.js', ModuleMapNode.create('bar.js'));
        // should use new value for `children` and leave `bar.js` untouched
        /** @type {SinonStub} */ (mrca.moduleGraph.values).returns(
          new Set([
            {
              filename: 'foo.js',
              children: ['bar.js'],
              entryFiles: [],
              parents: []
            }
          ])
        );

        mrca.mergeFromCache();
        expect(mrca, 'as JSON', 'to satisfy', {
          'foo.js': {filename: 'foo.js', children: ['bar.js']},
          'bar.js': {filename: 'bar.js'}
        });
      });

      describe('when the on-disk module map has been corrupted', function() {
        beforeEach(function() {
          /** @type {SinonStub} */ (mrca.moduleGraph.values).returns({
            z: 'foo'
          });
        });

        it('should throw', function() {
          expect(() => mrca.mergeFromCache(), 'to throw');
        });
      });
    });

    describe('addEntryFile()', function() {
      beforeEach(function() {
        sinon.stub(mrca, 'cwd').get(() => '/some/farm/animals');
        sinon.stub(mrca, '_hydrate').returnsThis();
        sinon.spy(mrca, 'set');
        sinon.spy(mrca.entryFiles, 'add');
      });

      describe('when provided a relative filepath', function() {
        it('should resolve the filepath relative to the `cwd` prop', function() {
          mrca.addEntryFile('foo.js');
          expect(mrca.entryFiles.add, 'to have a call satisfying', [
            '/some/farm/animals/foo.js'
          ]);
        });
      });

      describe('when provided a file which is already known but not an entry file', function() {
        beforeEach(function() {
          sinon
            .stub(mrca, 'has')
            .withArgs('/some/farm/animals/foo.js')
            .returns(true);
          mrca.addEntryFile('/some/farm/animals/foo.js');
        });

        it('should add the entry file', function() {
          expect(mrca.entryFiles.add, 'was called once');
        });

        it('should not attempt to re-populate from an already known file', function() {
          mrca.addEntryFile('/some/farm/animals/foo.js');
          expect(mrca._hydrate, 'was not called');
        });
      });

      describe('when provided a file which is already an entry file', function() {
        beforeEach(function() {
          mrca.entryFiles.add('/some/farm/animals/foo.js');
          sinon
            .stub(mrca, 'has')
            .withArgs('/some/farm/animals/foo.js')
            .returns(true);
        });

        it('should not attempt to add the entry file', function() {
          mrca.addEntryFile('/some/farm/animals/foo.js');
          expect(mrca.entryFiles.add, 'was called once');
        });

        it('should not attempt to re-populate from an already known file', function() {
          mrca.addEntryFile('/some/farm/animals/foo.js');
          expect(mrca._hydrate, 'was not called');
        });
      });
    });

    describe('_hydrate()', function() {
      let nodes;

      beforeEach(function() {
        nodes = new Map([
          ['foo.js', ModuleMapNode.create('foo.js')],
          ['bar.js', ModuleMapNode.create('bar.js')],
          ['baz.js', ModuleMapNode.create('baz.js')]
        ]);
      });

      describe('when no dependencies for the nodes are found', function() {
        beforeEach(function() {
          sinon.stub(mrca, 'findAllDependencies').resolves(new Map());
        });

        it('should only attempt to find dependencies for provided ModuleMapNodes', async function() {
          await mrca._hydrate([...nodes.values()]);
          expect(mrca.findAllDependencies, 'to have a call satisfying', [
            ['foo.js', 'bar.js', 'baz.js']
          ]).and('was called once');
        });
      });

      describe('when dependencies are found', function() {
        beforeEach(async function() {
          sinon
            .stub(mrca, 'findAllDependencies')
            .resolves(new Map([['foo.js', new Set(['quux.js'])]]));
          return mrca._hydrate([...nodes.values()]);
        });

        it('should attempt to find dependencies for found dependencies', function() {
          expect(mrca.findAllDependencies, 'to have calls satisfying', [
            [['foo.js', 'bar.js', 'baz.js']],
            [['quux.js']]
          ]).and('was called twice');
        });

        it('should assign `children` property to provided nodes', function() {
          expect(
            nodes.get('foo.js'),
            'to have property',
            'children',
            new Set(['quux.js'])
          );
        });

        it('should assign `entryFiles` property to found dependency nodes', function() {
          expect(
            mrca.get('quux.js'),
            'to have property',
            'entryFiles',
            new Set(['foo.js'])
          );
        });

        it('should assign `parents` property to found dependency nodes', function() {
          expect(
            mrca.get('quux.js'),
            'to have property',
            'parents',
            new Set(['foo.js'])
          );
        });

        it('should create nodes for the dependencies if they do not exist', function() {
          expect(ModuleMapNode.create, 'to have a call satisfying', [
            'quux.js'
          ]);
        });
      });

      describe('when the same deps are found multiple times', function() {
        /** @type {SinonStub} */
        let findAllDependencies;
        beforeEach(async function() {
          findAllDependencies = sinon.stub(mrca, 'findAllDependencies');
          // foo.js depends on quux.js
          findAllDependencies
            .onFirstCall()
            .resolves(new Map([['foo.js', new Set(['quux.js'])]]));
          // quux.js depends on bar.js, but we've already processed bar.js in the first call.
          findAllDependencies
            .onSecondCall()
            .resolves(new Map([['quux.js', new Set(['bar.js'])]]));
          return mrca._hydrate([...nodes.values()]);
        });

        it('should not re-process the same deps', function() {
          expect(findAllDependencies, 'was called twice');
        });
      });
    });

    describe('toString()', function() {
      beforeEach(function() {
        mrca.set(
          'foo.js',
          ModuleMapNode.create('foo.js', {
            children: ['/some/child.js', '/some/other/child.js']
          })
        );
        mrca.set('bar.js', ModuleMapNode.create('bar.js'));
        mrca.set(
          '/some/child.js',
          ModuleMapNode.create('/some/child.js', {
            parents: ['foo.js']
          })
        );
        mrca.set(
          '/some/other/child.js',
          ModuleMapNode.create('/some/other/child.js', {
            parents: ['foo.js']
          })
        );
      });

      it('should return a JSON representation of the ModuleMap', function() {
        expect(
          mrca.toString(),
          'to equal snapshot',
          '{"/some/child.js":{"filename":"/some/child.js","children":[],"parents":["foo.js"],"entryFiles":[]},"/some/other/child.js":{"filename":"/some/other/child.js","children":[],"parents":["foo.js"],"entryFiles":[]},"bar.js":{"filename":"bar.js","children":[],"parents":[],"entryFiles":[]},"foo.js":{"filename":"foo.js","children":["/some/child.js","/some/other/child.js"],"parents":[],"entryFiles":[]}}'
        );
      });
    });

    describe('_yieldChangedFiles()', function() {
      beforeEach(function() {
        sinon.stub(mrca, 'delete');
        sinon.stub(mrca, 'save');
      });

      it('should delegate to the file entry cache', function() {
        mrca._yieldChangedFiles();
        expect(
          mrca.fileEntryCache.yieldChangedFiles,
          'to have a call satisfying',
          [mrca.files]
        ).and('was called once');
      });

      describe('when the file entry cache returns a nonempty list of missing ("not found") files', function() {
        beforeEach(function() {
          /** @type {SinonStub} */ (mrca.fileEntryCache.yieldChangedFiles).returns(
            {
              changed: new Set(['baz.js']),
              notFound: new Set(['foo.js', 'bar.js'])
            }
          );
        });

        it('should delete each from the module map', function() {
          mrca._yieldChangedFiles();
          expect(mrca.delete, 'to have calls satisfying', [
            ['foo.js'],
            ['bar.js']
          ]).and('was called twice');
        });

        it('should persist the module map', function() {
          mrca._yieldChangedFiles();
          expect(mrca.save, 'was called once');
        });

        it('should return the list of changed files', function() {
          expect(mrca._yieldChangedFiles(), 'to equal', new Set(['baz.js']));
        });
      });

      describe('when the file entry cache return an empty list of missing ("not found") files', function() {
        beforeEach(function() {
          /** @type {SinonStub} */ (mrca.fileEntryCache.yieldChangedFiles).returns(
            {
              changed: new Set(['baz.js']),
              notFound: new Set()
            }
          );
        });

        it('should not persist the module map', function() {
          mrca._yieldChangedFiles();
          expect(mrca.save, 'was not called');
        });

        it('should return the list of changed files', function() {
          expect(mrca._yieldChangedFiles(), 'to equal', new Set(['baz.js']));
        });
      });

      describe('when provided an explicit list of files', function() {
        describe('when a filepath provided is unknown to the module map', function() {
          it('should throw', function() {
            expect(
              () => mrca._yieldChangedFiles(new Set(['quux.js'])),
              'to throw',
              expect.it('to be a', ReferenceError)
            );
          });
        });

        describe('when all filepaths are known to the module map', function() {
          it('should provide the list to the file entry cache', function() {
            mrca.set('quux.js', ModuleMapNode.create('quux.js'));
            mrca.set('baz.js', ModuleMapNode.create('baz.js'));
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

    describe('findAffectedFilesForChangedFiles()', function() {
      beforeEach(function() {
        sinon.stub(mrca, 'markFileChanged');
        sinon.stub(mrca, '_yieldChangedFiles').returns(new Set());
        sinon.stub(mrca, '_hydrate').resolves();
        sinon.stub(mrca, '_findAffectedFiles').callsFake(value =>
          new Set(value).size
            ? {
                entryFiles: new Set(['foo.js']),
                allFiles: new Set(['foo.js', 'bar.js'])
              }
            : {entryFiles: new Set(), allFiles: new Set()}
        );
        sinon.stub(mrca, 'mergeFromCache').returnsThis();
        sinon.stub(mrca, '_init').resolves();
      });

      it('should return the result of `_findAffectedFiles`', async function() {
        // this doesn't feel right, but a better assertion eludes me atm
        return expect(
          mrca.findAffectedFilesForChangedFiles({
            knownChangedFiles: ['foo.js', 'bar.js']
          }),
          'when fulfilled',
          'to be',
          /** @type {SinonStub} */ (mrca._findAffectedFiles).returnValues[0]
        );
      });

      describe('when provided known changed files', function() {
        it('should explicitly mark each file given as "changed"', async function() {
          await mrca.findAffectedFilesForChangedFiles({
            knownChangedFiles: ['foo.js', 'bar.js']
          });
          expect(mrca.markFileChanged, 'to have calls satisfying', [
            [path.join(mrca.cwd, 'foo.js')],
            [path.join(mrca.cwd, 'bar.js')]
          ]).and('was called twice');
        });
      });

      describe('when not provided known changed files', function() {
        it('should not mark any file as explicitly changed', async function() {
          await mrca.findAffectedFilesForChangedFiles();
          expect(mrca.markFileChanged, 'was not called');
        });
      });

      it('should query for a list of changed files', async function() {
        await mrca.findAffectedFilesForChangedFiles();
        expect(mrca._yieldChangedFiles, 'was called once');
      });

      describe('when no files have changed', function() {
        it('should return a vast emptiness', async function() {
          return expect(
            mrca.findAffectedFilesForChangedFiles(),
            'to be fulfilled with',
            {entryFiles: new Set(), allFiles: new Set()}
          );
        });
      });

      describe('when files have changed', function() {
        beforeEach(function() {
          /** @type {SinonStub } */ (mrca._yieldChangedFiles).returns(
            new Set(['foo.js', 'bar.js'])
          );
        });

        it('should re-hydrate the changed files', async function() {
          sinon
            .stub(mrca, 'getAll')
            .returns(
              new Set([
                ModuleMapNode.create('foo.js'),
                ModuleMapNode.create('bar.js')
              ])
            );
          await mrca.findAffectedFilesForChangedFiles({
            knownChangedFiles: ['foo.js', 'bar.js']
          });
          expect(
            mrca._hydrate,
            'to have a call satisfying',
            new Set([
              ModuleMapNode.create('foo.js'),
              ModuleMapNode.create('bar.js')
            ])
          ).and('was called once');
        });

        describe('when changed files are unknown', function() {
          it('should attempt to synchronize the cache from disk', async function() {
            await mrca.findAffectedFilesForChangedFiles({
              knownChangedFiles: ['foo.js', 'bar.js', 'baz.js']
            });
            expect(mrca.mergeFromCache, 'to have a call satisfying', [
              {destructive: true}
            ]).and('was called once');
          });

          describe('when file entry cache is mismatched with module map', function() {
            it('should re-initialize the module map', async function() {
              await mrca.findAffectedFilesForChangedFiles({
                knownChangedFiles: ['foo.js', 'bar.js', 'baz.js']
              });
              expect(mrca._init, 'to have a call satisfying', [
                {reset: true, force: true}
              ]).and('was called once');
            });
          });

          describe('when synchronization fixes the issue', function() {
            beforeEach(function() {
              sinon
                .stub(mrca, 'getAll')
                .returns(new Set())
                .onSecondCall()
                .returns(
                  new Set([
                    ModuleMapNode.create('foo.js'),
                    ModuleMapNode.create('bar.js')
                  ])
                );
            });

            it('should not re-initialize the module map', async function() {
              await mrca.findAffectedFilesForChangedFiles({
                knownChangedFiles: ['foo.js', 'bar.js', 'baz.js']
              });

              expect(mrca._init, 'was not called');
            });
          });
        });

        describe('when changed files are known', function() {
          beforeEach(function() {
            sinon
              .stub(mrca, 'getAll')
              .returns(
                new Set([
                  ModuleMapNode.create('foo.js'),
                  ModuleMapNode.create('bar.js')
                ])
              );
          });

          it('should not attempt to merge from disk', async function() {
            await mrca.findAffectedFilesForChangedFiles({
              knownChangedFiles: ['foo.js', 'bar.js', 'baz.js']
            });
            expect(mrca.mergeFromCache, 'was not called');
          });
        });
      });
    });

    describe('_findAffectedFiles', function() {
      beforeEach(function() {
        mrca.entryFiles = new Set(['foo.js', 'bar.js']);
        mrca.set('foo.js', ModuleMapNode.create('foo.js'));
        mrca.set('bar.js', ModuleMapNode.create('bar.js'));
      });

      describe('when not provided any parameters', function() {
        it('should throw', function() {
          expect(
            // @ts-ignore
            () => mrca._findAffectedFiles(),
            'to throw',
            expect.it('to be a', TypeError)
          );
        });
      });

      describe('when provided a list of ModuleMapNode objects', function() {
        it('should return an object containing list of entry files & all affected files', function() {
          expect(
            mrca._findAffectedFiles([mrca.get('foo.js'), mrca.get('bar.js')]),
            'to equal',
            {
              allFiles: new Set(['foo.js', 'bar.js']),
              entryFiles: new Set(['foo.js', 'bar.js'])
            }
          );
        });

        describe('when ModuleMapNode objects reference entry files', function() {
          beforeEach(function() {
            mrca.set(
              'baz.js',
              ModuleMapNode.create('baz.js', {entryFiles: new Set(['foo.js'])})
            );
          });

          it('should return an object with a prop containing the reference entry file(s)', function() {
            expect(
              mrca._findAffectedFiles([
                mrca.get('foo.js'),
                mrca.get('bar.js'),
                mrca.get('baz.js')
              ]),
              'to equal',
              {
                allFiles: new Set(['foo.js', 'bar.js', 'baz.js']),
                entryFiles: new Set(['foo.js', 'bar.js'])
              }
            );
          });

          describe('when ModuleMapNode objects reference parent files', function() {
            beforeEach(function() {
              mrca.set(
                'quux.js',
                ModuleMapNode.create('quux.js', {parents: new Set(['baz.js'])})
              );
            });

            it('should return an object with a prop containing the affected parent(s)', function() {
              expect(
                mrca._findAffectedFiles([
                  mrca.get('foo.js'),
                  mrca.get('bar.js'),
                  mrca.get('quux.js')
                ]),
                'to equal',
                {
                  allFiles: new Set(['foo.js', 'bar.js', 'baz.js', 'quux.js']),
                  entryFiles: new Set(['foo.js', 'bar.js'])
                }
              );
            });
          });
        });
      });
    });

    describe('markFileChanged()', function() {
      it('should delegate to the file entry cache', function() {
        mrca.markFileAsChanged('foo.js');
        expect(
          mrca.fileEntryCache.markFileChanged,
          'to have a call satisfying',
          ['foo.js']
        ).and('was called once');
      });

      it('should return its context', function() {
        expect(mrca.markFileAsChanged('foo'), 'to be', mrca);
      });

      describe('when not provided a filepath parameter', function() {
        it('should throw', function() {
          expect(
            // @ts-ignore
            () => mrca.markFileAsChanged(),
            'to throw',
            expect.it('to be a', TypeError)
          );
        });
      });
    });

    describe('findAllDependencies()', function() {
      describe('when not provided any parameters', function() {
        it('should reject with a TypeError', async function() {
          return expect(
            // @ts-ignore
            mrca.findAllDependencies(),
            'to be rejected with',
            expect.it('to be a', TypeError)
          );
        });
      });

      describe('when provided a non-iterable parameter', function() {
        it('should reject with TypeError', async function() {
          return expect(
            // @ts-ignore
            mrca.findAllDependencies(42),
            'to be rejected with',
            expect.it('to be a', TypeError)
          );
        });
      });

      describe('when provided an empty iterable parameter', function() {
        it('should resolve with an empty Map', async function() {
          return expect(
            mrca.findAllDependencies([]),
            'to be fulfilled with',
            new Map()
          );
        });
      });

      describe('when provided a Set of filepaths', function() {
        it('should return a Map of each filepath to its set of dependencies', async function() {
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
              ['bar.js', new Set(['quux.js'])]
            ])
          );
        });

        it('should call Resolver.resolveDependencies using absolute filepath for each filepath', async function() {
          const opts = {
            cwd: mrca.cwd,
            ignore: mrca.ignore,
            tsConfigPath: mrca.tsConfigPath,
            webpackConfigPath: mrca.webpackConfigPath
          };
          await mrca.findAllDependencies(['foo.js', 'bar.js']);
          expect(
            stubs.resolver.resolveDependencies,
            'to have calls satisfying',
            [
              [path.resolve(mrca.cwd, 'foo.js'), opts],
              [path.resolve(mrca.cwd, 'bar.js'), opts]
            ]
          ).and('was called twice');
        });
      });
    });
  });

  describe('interesting computed properties', function() {
    beforeEach(async function() {
      sinon.stub(MRCA.prototype, '_init').resolves();
      mrca = new MRCA();
      return mrca.ready;
    });

    describe('getters', function() {
      describe('entryDirectories', function() {
        beforeEach(function() {
          sinon
            .stub(mrca, 'entryFiles')
            .get(() => new Set(['foo.js', '/some/other/path.js']));
        });

        it('should return a set of all parent directories of entry files', function() {
          expect(
            mrca.entryDirectories,
            'to equal',
            new Set(['.', '/some/other'])
          );
        });
      });

      describe('directories', function() {
        beforeEach(function() {
          sinon
            .stub(mrca, 'files')
            .get(() => new Set(['foo.js', '/some/other/path.js']));
        });

        it('should return a set of all parent directories of all files', function() {
          expect(mrca.directories, 'to equal', new Set(['.', '/some/other']));
        });
      });

      describe('files', function() {
        beforeEach(function() {
          sinon.stub(mrca, 'keys').returns(new Set(['a', 'b', 'c']).values());
        });

        it('should return a Set of all keys', function() {
          expect(mrca.files, 'to equal', new Set(['a', 'b', 'c']));
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
 * @typedef {import('../../src/mrca').MRCA} MRCA
 */

/**
 * @template T
 * @typedef {import('sinon').SinonStubbedInstance<T>} SinonStubbedInstance<T>
 */

/**
 * @typedef {import('sinon').SinonSpy<any,SinonStubbedInstance<import('../../src/file-entry-cache').FileEntryCache>> & {create: import('sinon').SinonSpy<any,SinonStubbedInstance<import('../../src/file-entry-cache').FileEntryCache>>}} MockFileEntryCache
 */
/**
 * @typedef {import('sinon').SinonSpy<any,SinonStubbedInstance<import('../../src/module-graph').ModuleGraph>> & {create: import('sinon').SinonSpy<any,SinonStubbedInstance<import('../../src/module-graph').ModuleGraph>>}} MockModuleGraph
 */
