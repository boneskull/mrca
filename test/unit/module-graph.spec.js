'use strict';

const {ModuleGraph} = require('../../src/module-graph');
const expect = require('../expect');

describe('ModuleGraph', function () {
  describe('instance method', function () {
    let mg;

    beforeEach(function () {
      mg = new ModuleGraph();
    });

    describe('set()', function () {
      describe('when provided no optional metadata', function () {
        it('should create a graph with a single node and no edges', function () {
          expect(
            mg.set('foo.js').graph,
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
          expect(
            mg.set('foo.js', {parents: ['bar.js', 'baz.js']}).graph,
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
          expect(
            mg.set('foo.js', {
              parents: ['quux.js'],
              missing: true,
            }).graph,
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
      describe('foo', function () {
        it('blah', function () {
          expect(mg.graph.nodes(), 'to equal', 3);
        });
      });
    });
  });
});
