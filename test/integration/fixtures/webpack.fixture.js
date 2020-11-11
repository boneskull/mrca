const debug = require('debug');
const dep = require('./webpack-dep.fixture');

module.exports = function (foo) {
  return dep(debug(foo));
};
