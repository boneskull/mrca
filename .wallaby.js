'use strict';

module.exports = () => ({
  files: [
    'src/**/*.js',
    'package.json',
    'test/expect.js',
    {pattern: 'test/integration/fixtures/**/*', instrument: false},
    {pattern: 'node_modules/debug/**/*', instrument: false},
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
      // runner: `-r ${require.resolve('esm')}`,
      env: `DEBUG=mrca*,cabinet;NODE_PATH=${__dirname};UNEXPECTED_DEPTH=10`,
    },
  },
  debug: true,
  preservePaths: true,
  runMode: 'onsave',
  setup(wallaby) {
    process.env.MRCA_PROJECT_ROOT_DIR = wallaby.localProjectDir;
  },
});
