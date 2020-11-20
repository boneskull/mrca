'use strict';

module.exports = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'))
  .use(require('unexpected-map'))
  .use(require('unexpected-set'))
  .use(require('unexpected-snapshot'))
  .use(require('unexpected-eventemitter'))
  .addAssertion('<Map> as JSON <assertion>', (expect, subject) => {
    expect.errorMode = 'nested';
    expect.shift(subject.toJSON());
  })
  .addAssertion('<Set> as array <assertion>', (expect, subject) => {
    expect.errorMode = 'nested';
    expect.shift([...subject]);
  });
