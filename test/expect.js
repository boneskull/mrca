'use strict';

module.exports = require('unexpected')
  .clone()
  .use(require('unexpected-sinon'))
  .use(require('unexpected-map'))
  .use(require('unexpected-set'))
  .addAssertion('<Map> as JSON <assertion>', (expect, subject) => {
    expect.errorMode = 'nested';
    expect.shift(subject.toJSON());
  })
  .addAssertion('<Set> as array <assertion>', (expect, subject) => {
    expect.errorMode = 'nested';
    expect.shift([...subject]);
  });
