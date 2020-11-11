'use strict';

module.exports = () => ({
  files: [
    'src/**/*.js',
    'package.json',
     'test/expect.js',
    {pattern: 'test/integration/fixtures/**/*', instrument: false},
    {pattern:'node_modules/debug/**/*', instrument: false}
  ],
  filesWithNoCoverageCalculated: [
    'test/expect.js'
  ],
  tests: ['test/**/*.spec.js'],
  compilers: {
    // do not auto-compile typescript
    '**/*.ts': v => v
  },
  env: {
    type: 'node',
    runner: 'node',
    params: {
      // runner: `-r ${require.resolve('esm')}`,
      env: `DEBUG=mrca*,cabinet*;NODE_PATH=${__dirname}`
    }
  },
  debug: true,
  preservePaths: true,
  runMode: 'onsave'
});
