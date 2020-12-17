'use strict';

const {ModuleGraph} = require('../../src/module-graph');
const expect = require('../expect');
const sinon = require('sinon');

describe('ModuleGraph', function () {
  afterEach(function () {
    sinon.restore();
  });

  describe('instance method', function () {
    /**
     * @type {ModuleGraph}
     */
    let mg;

    beforeEach(function () {
      mg = new ModuleGraph();
    });

    describe('set()', function () {
      describe('when provided no optional metadata', function () {
        it('should return the node name (filename)', function () {
          expect(mg.set('foo.js'), 'to equal', 'foo.js');
        });

        it('should create a graph with a single node and no edges', function () {
          mg.set('foo.js');
          expect(
            mg.graph,
            'when serialized',
            'to satisfy',
            expect
              .it('to contain node', 'foo.js')
              .and('to have node count', 1)
              .and('to have no edges')
          );
        });
      });

      describe('when provided a list of parents', function () {
        it('should create a graph containing all nodes and edges for parents', function () {
          mg.set('foo.js', {parents: new Set(['bar.js', 'baz.js'])});
          expect(
            mg.graph,
            'when serialized',
            'to satisfy',
            expect
              .it('to contain nodes', 'foo.js', 'bar.js', 'baz.js')
              .and('to have node count', 3)
              .and(
                'to contain edges',
                ['foo.js', 'bar.js'],
                ['foo.js', 'baz.js']
              )
              .and('to have edge count', 2)
          );
        });
      });

      describe('when `missing` property is true"', function () {
        it('should mark the node as having a `missing` attribute', function () {
          mg.set('foo.js', {
            parents: new Set(['quux.js']),
            missing: true,
          });
          expect(
            mg.graph,
            'when serialized',
            'to satisfy',
            expect
              .it('to contain nodes', ['foo.js', {missing: true}], 'quux.js')
              .and('to have node count', 2)
              .and('to contain edges', ['foo.js', 'quux.js'])
              .and('to have edge count', 1)
          );
        });
      });

      describe('when `entryFile` property is true', function () {
        it('should mark the node as having an `entryFile` attribute', function () {
          mg.set('foo.js', {
            entryFile: true,
          });
          expect(
            mg.graph,
            'when serialized',
            'to satisfy',
            expect
              .it('to contain nodes', ['foo.js', {entryFile: true}])
              .and('to have node count', 1)
              .and('to have edge count', 0)
          );
        });
      });
    });

    describe('remove()', function () {});

    describe('getEntryFiles()', function () {
      beforeEach(function () {
        mg.import({
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
      });

      it('should return a Set of the entry files', function () {
        expect(
          mg.getEntryFiles('baz.js'),
          'to equal',
          new Set(['herp.js', 'quux.js'])
        );
      });
    });

    describe('import()', function () {
      it('should import the serialized graph, merging with the existing graph', function () {
        mg.set('foo.js');
        mg.import({
          nodes: [
            {key: 'bar.js'},
            {key: 'foo.js', attributes: {missing: true}},
          ],
          edges: [],
        });
        expect(
          mg.graph,
          'when serialized',
          'to satisfy',
          expect
            .it('to contain node', 'bar.js')
            .and('to contain node', ['foo.js', {missing: true}])
        );
      });

      it('should not remove nodes', function () {
        mg.set('foo.js');
        mg.import({
          attributes: {},
          nodes: [{key: 'bar.js'}],
          edges: [],
          options: {type: 'directed', multi: false, allowSelfLoops: true},
        });
        expect(
          mg.graph,
          'when serialized',
          'to satisfy',
          expect
            .it('to contain node', 'bar.js')
            .and('to contain node', 'foo.js')
        );
      });
    });

    describe('compact()', function () {
      beforeEach(function () {
        mg.import({
          attributes: {},
          nodes: [
            {key: 'herp.js', attributes: {entryFile: true}},
            {key: 'quux.js', attributes: {entryFile: true}},
            {key: 'derp.js', attributes: {missing: true}},
            {key: 'foo.js'},
            {key: 'bar.js'},
            {key: 'baz.js'},
            {key: 'spam.js'},
            {key: 'slime.js'},
          ],
          edges: [
            {source: 'foo.js', target: 'herp.js'},
            {source: 'bar.js', target: 'foo.js'},
            {source: 'baz.js', target: 'foo.js'},
            {source: 'baz.js', target: 'quux.js'},
            {source: 'derp.js', target: 'bar.js'},
            {source: 'spam.js', target: 'derp.js'},
          ],
          options: {type: 'directed', multi: false, allowSelfLoops: true},
        });
      });

      it('should return a list of removed nodes and mourning parents', function () {
        expect(mg.graph.hasNode('derp.js'), 'to be true');
        expect(mg.compact(), 'to equal', {
          removed: new Set(['derp.js']),
          affected: new Set(['bar.js']),
        });
      });
    });

    describe('isMissing()', function () {
      beforeEach(function () {
        mg.set('foo.js');
        mg.set('bar.js', {missing: true});
      });

      describe('when the node is marked as missing', function () {
        it('should return `true`', function () {
          expect(mg.isMissing('bar.js'), 'to be true');
        });
      });

      describe('when the node is not marked as missing', function () {
        it('should return `false`', function () {
          expect(mg.isMissing('foo.js'), 'to be false');
        });
      });

      describe('when the node does not exist', function () {
        it('should return `false`', function () {
          expect(mg.isMissing('baz.js'), 'to be false');
        });
      });
    });

    describe('markMissing()', function () {
      beforeEach(function () {
        mg.set('foo.js');
      });

      describe('when the node exists', function () {
        let result;

        beforeEach(function () {
          result = mg.markMissing('foo.js');
        });

        it('should mark the node as missing', function () {
          expect(mg.graph, 'when serialized', 'to contain node', [
            'foo.js',
            {missing: true},
          ]);
        });

        it('should return its context', function () {
          expect(result, 'to be', mg);
        });

        describe('when the node is already missing', function () {
          it('should still mark the node as missing', function () {
            mg.markMissing('foo.js');
            expect(mg.graph, 'when serialized', 'to contain node', [
              'foo.js',
              {missing: true},
            ]);
          });
        });
      });

      describe('when the node does not exist', function () {
        it('should throw', function () {
          expect(
            () => mg.markMissing('bar.js'),
            'to throw',
            'attempted to mark filepath bar.js as missing, but it does not exist'
          );
        });
      });
    });

    describe('markFound()', function () {
      beforeEach(function () {
        mg.set('foo.js', {missing: true});
      });

      describe('when the node exists', function () {
        let result;

        beforeEach(function () {
          result = mg.markFound('foo.js');
        });

        it('should remove the "missing" mark', function () {
          expect(mg.graph, 'when serialized', 'to contain node', ['foo.js']);
        });

        it('should return its context', function () {
          expect(result, 'to be', mg);
        });
      });

      describe('when the node does not exist', function () {
        it('should throw', function () {
          expect(
            () => mg.markFound('bar.js'),
            'to throw',
            'attempted to mark filepath bar.js as found, but it does not exist'
          );
        });
      });
    });

    describe('isEntryFile()', function () {
      beforeEach(function () {
        mg.set('foo.js');
        mg.set('bar.js', {entryFile: true});
      });

      describe('when the node is marked as an entry file', function () {
        it('should return `true`', function () {
          expect(mg.isEntryFile('bar.js'), 'to be true');
        });
      });

      describe('when the node is not marked as an entry file', function () {
        it('should return `false`', function () {
          expect(mg.isEntryFile('foo.js'), 'to be false');
        });
      });

      describe('when the node does not exist', function () {
        it('should return `false`', function () {
          expect(mg.isEntryFile('baz.js'), 'to be false');
        });
      });
    });

    describe('has()', function () {
      describe('when the graph contains a node with the provided filepath', function () {
        beforeEach(function () {
          mg.set('foo.js');
        });
        it('should return `true`', function () {
          expect(mg.has('foo.js'), 'to be true');
        });
      });

      describe('when the graph does not contain a node with the provided filepath', function () {
        it('should return false', function () {
          expect(mg.has('bar.js'), 'to be false');
        });
      });
    });

    describe('reset()', function () {
      beforeEach(function () {
        sinon.stub(mg.graph, 'clear');
      });

      it('should delegate to the underlying graph', function () {
        mg.reset();
        expect(mg.graph.clear, 'was called once');
      });

      it('should return its context', function () {
        expect(mg.reset(), 'to be', mg);
      });
    });

    describe('filterUntrackedFiles()', function () {
      describe('when provided a nonempty list of filepaths', function () {
        beforeEach(function () {
          mg.set('foo.js');
          mg.set('bar.js');
        });

        it('should return a Set of those that do not exist in the graph', function () {
          expect(
            mg.filterUntrackedFiles(['foo.js', 'bar.js', 'baz.js']),
            'to equal',
            new Set(['baz.js'])
          );
        });
      });
    });
  });

  describe('static method', function () {
    describe('create()', function () {
      it('should instantiate a ModuleGraph', function () {
        expect(ModuleGraph.create(), 'to be a', ModuleGraph);
      });
    });
  });

  describe('interesting property', function () {
    /**
     * @type {ModuleGraph}
     */
    let mg;

    beforeEach(function () {
      mg = new ModuleGraph();
    });

    describe('filepaths', function () {
      it('should be a Set of all filepaths (node keys) in the graph', function () {
        mg.set('/path/to/foo.js');
        mg.set('/path/to/bar.js');
        expect(
          mg.filepaths,
          'to equal',
          new Set(['/path/to/foo.js', '/path/to/bar.js'])
        );
      });
    });

    describe('directories', function () {
      it('should be a Set of all (unique) directories of the filepaths (node keys) in the graph', function () {
        mg.set('/path/to/foo.js');
        mg.set('/path/to/bar.js');
        mg.set('/some/other/path/baz.js');
        expect(
          mg.directories,
          'to equal',
          new Set(['/path/to', '/some/other/path'])
        );
      });
    });
  });
});
