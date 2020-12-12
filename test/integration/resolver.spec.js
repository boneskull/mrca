'use strict';

const sinon = require('sinon');
const rewiremock = require('rewiremock/node');
const path = require('path');
const expect = require('../expect');
const escapeStringRegexp = require('escape-string-regexp');

const resolveFixturePath = (filepath) =>
  path.join(__dirname, 'fixtures', filepath);

describe('dependency resolution', function () {
  /**
   * @type {import('../../src/resolver').resolveDependencies}
   */
  let resolveDependencies;
  /**
   * @type {{[key: string]: sinon.SinonStub}}
   */
  let stubs;

  /** @type {typeof import('../../src/resolver').Resolver.constants} */
  let constants;

  beforeEach(function () {
    stubs = {
      warn: sinon.stub(),
      existsSync: sinon.stub(),
    };

    // this is an integration test, but we don't need to spawn a mocha instance.
    // we do want to stub out some fs-touching methods to make the tests easier though
    /**
     * @type {typeof import('../../src/resolver')}
     */
    const resolver = rewiremock.proxy(
      () => require('../../src/resolver'),
      (r) => ({
        fs: r
          .with({
            // tests can modify this stub to change its behavior
            existsSync: stubs.existsSync,
          })
          .callThrough(),
      })
    );

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
      beforeEach(function () {
        stubs.existsSync.returns(true);
      });

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

      it('should not look for a default TS config file', function () {
        expect(stubs.existsSync, 'was not called');
      });
    });

    describe('when not provided a path to TS config file', function () {
      describe('when file contains a missing module', function () {
        let result;

        beforeEach(function () {
          result = resolveDependencies(
            resolveFixturePath('unknown-dep.fixture.ts')
          );
        });

        it('should return an empty set', function () {
          expect(result, 'to satisfy', {
            resolved: expect.it('to be empty'),
            missing: expect.it('to be empty'),
          });
        });
      });

      describe('when TS config file not in `cwd`', function () {
        beforeEach(function () {
          resolveDependencies(resolveFixturePath('index.fixture.ts'));
        });

        it('should look for a TS config file in cwd', function () {
          expect(stubs.existsSync, 'to have a call satisfying', [
            path.join(process.cwd(), constants.DEFAULT_TS_CONFIG_FILENAME),
          ]);
        });
      });

      describe('when TS config file is in `cwd`', function () {
        beforeEach(function () {
          stubs.existsSync.returns(true);
        });

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

      it('should return empty lists', function () {
        expect(result, 'to satisfy', {
          resolved: expect.it('to be empty'),
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

      it('should look for a Webpack config file in cwd', function () {
        expect(stubs.existsSync, 'to have a call satisfying', [
          new RegExp(
            escapeStringRegexp(constants.DEFAULT_WEBPACK_CONFIG_FILENAME)
          ),
        ]);
      });
    });

    describe('when provided a path to a Webpack config file', function () {
      let result;

      beforeEach(function () {
        stubs.existsSync.returns(true);
        const fixture = resolveFixturePath('webpack.fixture.js');
        result = resolveDependencies(fixture, {
          webpackConfigPath: resolveFixturePath('webpack.config.fixture.js'),
        });
      });

      it('should not look for a default Webpack config file', function () {
        expect(stubs.existsSync, 'not to have calls satisfying', [
          constants.DEFAULT_WEBPACK_CONFIG_FILENAME,
        ]);
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
      beforeEach(function () {
        stubs.existsSync.returns(true);
      });

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

    describe('when provided a string glob to ignore', function () {
      it('should not return files matching the glob', function () {
        expect(
          resolveDependencies(require.resolve('../..'), {
            ignore: '**/node_modules/**',
          }).resolved,
          'as array',
          'to have items satisfying',
          expect.it('not to match', /node_modules/)
        );
      });
    });
  });
});
