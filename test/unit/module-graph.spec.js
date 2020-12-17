'use strict';

const {ModuleGraph} = require('../../src/module-graph');
const expect = require('../expect');

describe('ModuleGraph', function () {
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

      describe('when marked missing', function () {
        it('should reflect this in the attributes', function () {
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
  });
});
