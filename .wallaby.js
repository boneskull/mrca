'use strict';

module.exports = () => ({
  files: [
    'src/**/*.js',
    'package.json',
    'test/expect.js',
    {pattern: 'test/integration/fixtures/**/*', instrument: false},
    // these are required for `dependency-tree` to find stuff properly in integration tests
    {pattern: 'node_modules/debug/**/*', instrument: false},
    {pattern: 'node_modules/@types/debug/**/*', instrument: false}
  ],
  filesWithNoCoverageCalculated: ['test/expect.js'],
  tests: ['test/**/*.spec.js'],
  compilers: {
    // do not auto-compile typescript
    '**/*.ts': (v) => v,
  },
  env: {
    type: 'node',
    runner: 'node',
    params: {
      env: `DEBUG=mrca*,tree,cabinet;NODE_PATH=${__dirname};UNEXPECTED_DEPTH=10`,
    },
  },
  debug: true,
  preservePaths: true,
  runMode: 'onsave',
  setup(wallaby) {
    process.env.MRCA_PROJECT_ROOT_DIR = wallaby.localProjectDir;
  },
});
