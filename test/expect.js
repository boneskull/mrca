'use strict';

const GRAPH_TYPES = new Set(['mixed', 'directed', 'undirected']);

module.exports = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'))
  .use(require('unexpected-map'))
  .use(require('unexpected-set'))
  .use(require('unexpected-snapshot'))
  .use(require('unexpected-eventemitter'))
  .addType({
    name: 'Serializable',
    base: 'object',
    identify(v) {
      return this.baseType.identify(v) && typeof v.toJSON === 'function';
    },
  })
  .addAssertion('<Serializable> as JSON <assertion>', (expect, subject) => {
    expect.errorMode = 'nested';
    expect.shift(subject.toJSON());
  })
  .addAssertion('<Set> as array <assertion>', (expect, subject) => {
    expect.errorMode = 'nested';
    expect.shift([...subject]);
  })
  .addType({
    name: 'Graph',
    base: 'object',
    identify(v) {
      return (
        this.baseType.identify(v) &&
        GRAPH_TYPES.has(v.type) &&
        typeof v.export === 'function'
      );
    },
  })
  .addType({
    name: 'SerializedGraph',
    base: 'object',
    identify(v) {
      return (
        this.baseType.identify(v) &&
        typeof v.options === 'object' &&
        typeof v.attributes === 'object' &&
        Array.isArray(v.nodes) &&
        Array.isArray(v.edges)
      );
    },
  })
  .addAssertion('<Graph> when serialized <assertion>', (expect, subject) => {
    expect.errorMode = 'nested';
    expect.shift(subject.export());
  })
  .addAssertion(
    '<SerializedGraph> [not] to contain (node|nodes) <any+>',
    (expect, subject, ...values) => {
      expect(
        subject.nodes,
        '[not] to contain',
        ...values.map((value) => {
          if (Array.isArray(value)) {
            return {key: value[0], attributes: value[1]};
          }
          if (typeof value === 'string') {
            return {key: value};
          }
          return value;
        })
      );
    }
  )
  .addAssertion(
    '<SerializedGraph> to have node count <number>',
    (expect, subject, value) => {
      expect(subject.nodes, 'to have length', value);
    }
  )
  .addAssertion(
    '<SerializedGraph> to have edge count <number>',
    (expect, subject, value) => {
      expect(subject.edges, 'to have length', value);
    }
  )
  .addAssertion('<SerializedGraph> to have no edges', (expect, subject) => {
    expect(subject.edges, 'to be empty');
  })
  .addAssertion(
    '<SerializedGraph> to contain (edge|edges) <array+>',
    (expect, subject, ...tuples) => {
      expect(
        subject.edges,
        'to contain',
        ...tuples.map(([source, target]) => ({source, target}))
      );
    }
  )
  // this one is here because 'to be fulfilled with' uses 'to satisfy'
  // semantics, which is undesirable unless you really want it.
  .addAssertion(
    '<Promise> to be fulfilled with value equal to <any>',
    (expect, subject, value) => {
      return expect(subject, 'when fulfilled', 'to equal', value);
    }
  );
