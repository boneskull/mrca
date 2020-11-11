'use strict';

const path = require('path');

module.exports = {
  entry: './webpack.fixture.js',
  mode: 'development',
  resolve: {modules: [path.join(__dirname, 'mode_nodules')]},
};
