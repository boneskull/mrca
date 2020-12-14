'use strict';

const sinon = require('sinon');
// const rewiremock = require('rewiremock/node');
const path = require('path');
const expect = require('../expect');
const escapeStringRegexp = require('escape-string-regexp');
const resolver = require('../../src/resolver');

const resolveFixturePath = (filepath) =>
  path.join(__dirname, 'fixtures', filepath);

describe('dependency resolution', function () {
  /**
   * @type {import('../../src/resolver').resolveDependencies}
   */
  let resolveDependencies;

  /** @type {typeof import('../../src/resolver').Resolver.constants} */
  let constants;

  beforeEach(function () {
    resolveDependencies = resolver.resolveDependencies;
    resolver.Resolver.constants.DEFAULT_TS_CONFIG_FILENAME =
      'tsconfig.fixture.json';
    resolver.Resolver.constants.DEFAULT_WEBPACK_CONFIG_FILENAME =
      'webpack.config.fixture.js';
    constants = resolver.Resolver.constants;
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('when provided a `.json` file', function () {
    it('should return empty lists', function () {
      expect(
        resolveDependencies(require.resolve('../../package.json')),
        'to satisfy',
        {
          resolved: expect.it('to be empty'),
          missing: expect.it('to be empty'),
        }
      );
    });
  });

  describe('when provided a TypeScript file', function () {
    describe('when provided a path to a TS config file', function () {
      it('should find dependencies', function () {
        // this should _actually work_; no magic stubs here
        expect(
          resolveDependencies(resolveFixturePath('index.fixture.ts'), {
            tsConfigPath: resolveFixturePath('tsconfig.fixture.json'),
            cwd: path.join(__dirname, '..', '..'),
          }).resolved,
          'as array',
          'to have an item satisfying',
          /debug/
        ).and(
          'as array',
          'to have an item satisfying',
          /tsconfig\.fixture\.json/
        );
      });
    });

    describe('when not provided a path to TS config file', function () {
      describe('when file contains a missing module', function () {
        let result;

        beforeEach(function () {
          // this is necessary because otherwise cabinet will find `tsconfig.fixture.json`
          // and it will befoul the assertion
          constants.DEFAULT_TS_CONFIG_FILENAME = 'whatever-dunno.json';

          result = resolveDependencies(
            resolveFixturePath('unknown-dep.fixture.ts')
          );
        });

        it('should return an empty set', function () {
          expect(result, 'to equal', {
            resolved: new Set(),
            missing: new Set(['bar']),
          });
        });
      });

      describe('when TS config file not in `cwd`', function () {
        let result;

        beforeEach(function () {
          constants.DEFAULT_TS_CONFIG_FILENAME = 'whatever-dunno.json';

          result = resolveDependencies(resolveFixturePath('index.fixture.ts'));
        });

        it('should resolve dependencies via its defaults', function () {
          expect(result, 'to satisfy', {
            resolved: expect.it('not to be empty'),
            missing: expect.it('to be empty'),
          });
        });
      });

      describe('when TS config file is in `cwd`', function () {
        it('should use the found TS config file', function () {
          const fixture = resolveFixturePath('index.fixture.ts');
          expect(
            resolveDependencies(fixture, {
              cwd: path.dirname(fixture), // cwd is needed to find default config file
            }).resolved,
            'as array',
            'to have an item satisfying',
            /node_modules\/debug/
          ).and(
            'as array',
            'to have an item satisfying',
            new RegExp(escapeStringRegexp(constants.DEFAULT_TS_CONFIG_FILENAME))
          );
        });
      });
    });
  });

  describe('when provided a JavaScript file', function () {
    describe('when file contains a syntax error', function () {
      let result;

      beforeEach(function () {
        result = resolveDependencies(resolveFixturePath('syntax.fixture.js'));
      });

      it('should find the dependencies anyway', function () {
        expect(result, 'to satisfy', {
          resolved: expect.it('not to be empty'),
          missing: expect.it('to be empty'),
        });
      });
    });

    describe('when not provided a path to a Webpack config file', function () {
      /**
       * @type {import('../../src/resolver').ResolvedDependencies}
       */
      let result;
      let fixture;

      beforeEach(function () {
        constants.DEFAULT_WEBPACK_CONFIG_FILENAME = 'fred-flintstone.json';
        fixture = resolveFixturePath('webpack.fixture.js');
        console.log(`FIXTURE: ${fixture}`);
        result = resolveDependencies(fixture, {
          cwd: path.dirname(fixture), // cwd is needed to find the default config file
        });
      });

      it('should resolve non-relative modules from nearest module directory', function () {
        // this differs from the test using webpack.config.fixture.js, which points
        // to a specific module directory in the fixture dir (`mode_nodules`) and has
        // a different `debug`
        expect(result, 'to satisfy', {
          resolved: expect
            .it(
              'as array',
              'to have an item satisfying',
              new RegExp(escapeStringRegexp(`node_modules${path.sep}debug`))
            )
            .and(
              'as array',
              'to have an item satisfying',
              /webpack-dep\.fixture\.js/
            ),
          missing: expect.it('to be empty'),
        });
      });
    });

    describe('when provided a path to a Webpack config file', function () {
      let result;

      beforeEach(function () {
        const fixture = resolveFixturePath('webpack.fixture.js');
        result = resolveDependencies(fixture, {
          webpackConfigPath: resolveFixturePath('webpack.config.fixture.js'),
        });
      });

      it('should find dependencies as declared by webpack config', function () {
        expect(
          result,
          'to satisfy',
          new Set([
            new RegExp(
              escapeStringRegexp(constants.DEFAULT_WEBPACK_CONFIG_FILENAME)
            ),
            /mode_nodules\/debug/,
            /webpack-dep\.fixture\.js/,
          ])
        );
      });
    });

    describe('when a default Webpack config file is in `cwd`', function () {
      it('should use the found Webpack config file', function () {
        expect(
          resolveDependencies(
            resolveFixturePath('webpack.fixture.js'),
            // change cwd to the directory of the fixture webpack config file
            {cwd: path.join(__dirname, 'fixtures')}
          ),
          'to satisfy',
          new Set([
            /webpack-dep\.fixture\.js/,
            /debug/,
            new RegExp(
              escapeStringRegexp(constants.DEFAULT_WEBPACK_CONFIG_FILENAME)
            ),
          ])
        );
      });
    });
  });

  describe('ignored dependencies', function () {
    describe('when provided a set of globs to ignore', function () {
      it('should not return files matching the globs', function () {
        expect(
          resolveDependencies(require.resolve('../..'), {
            ignore: new Set(['**/node_modules/**']),
          }).resolved,
          'as array',
          'to have items satisfying',
          expect.it('not to match', /node_modules/)
        );
      });
    });

    describe('when provided an array of globs to ignore', function () {
      it('should not return files matching the globs', function () {
        expect(
          resolveDependencies(require.resolve('../..'), {
            ignore: ['**/node_modules/**'],
          }).resolved,
          'as array',
          'to have items satisfying',
          expect.it('not to match', /node_modules/)
        );
      });
    });
  });
});
