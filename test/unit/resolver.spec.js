'use strict';

const sinon = require('sinon');
const rewiremock = require('rewiremock/node');
const expect = require('../expect');

describe('resolver', function () {
  /**
   * @type {typeof import('../../src/resolver').Resolver}
   */
  let Resolver;

  let stubs;

  afterEach(function () {
    sinon.restore();
  });

  describe('class Resolver', function () {
    beforeEach(function () {
      stubs = {
        debug: Object.assign(sinon.stub().returns(sinon.stub()), {
          enabled: sinon.stub().returns(false),
        }),
        precinct: {paperwork: sinon.stub()},
        'filing-cabinet': sinon.stub(),
        multimatch: sinon.stub().returns([]),
        fs: {
          existsSync: sinon.stub(),
        },
        'resolve-from': sinon.stub(),
        path: {
          extname: sinon.stub(),
          dirname: sinon.stub(),
          resolve: sinon.stub(),
        },
      };
      Resolver = rewiremock.proxy(() => require('../../src/resolver'), stubs)
        .Resolver;
    });

    describe('constructor', function () {
      it('should make any ignore globs unique', function () {
        expect(new Resolver({ignore: ['foo.js', 'foo.js']}), 'to satisfy', {
          ignore: expect.it('to equal', new Set(['foo.js'])),
        });
      });
    });

    describe('instance method', function () {
      /**
       * @type {import('../../src/resolver').Resolver}
       */
      let resolver;

      beforeEach(function () {
        resolver = new Resolver();
      });

      describe('_tryFindWebpackConfigPath()', function () {
        describe('when the Resolver has no explicit webpack config filepath', function () {
          beforeEach(function () {
            stubs.path.resolve.returns('/path/to/webpack.config.js');
          });

          it('should look for the default webpack config in the cwd', function () {
            resolver._tryFindWebpackConfigPath();
            expect(stubs.fs.existsSync, 'to have a call satisfying', [
              '/path/to/webpack.config.js',
            ]);
          });

          describe('when the default webpack config is not found in the cwd', function () {
            beforeEach(function () {
              stubs.fs.existsSync.returns(false);
            });

            it('should return void', function () {
              expect(resolver._tryFindWebpackConfigPath(), 'to be undefined');
            });
          });

          describe('when the default webpack config is found in the cwd', function () {
            beforeEach(function () {
              stubs.fs.existsSync.returns(true);
            });

            it('should return the full path to the default webpack config', function () {
              expect(
                resolver._tryFindWebpackConfigPath(),
                'to equal',
                '/path/to/webpack.config.js'
              );
            });
          });

          it('should attempt to find the default webpack config in the cwd', function () {
            resolver._tryFindWebpackConfigPath();
            expect(stubs.path.resolve, 'to have a call satisfying', [
              resolver.cwd,
              Resolver.constants.DEFAULT_WEBPACK_CONFIG_FILENAME,
            ]);
          });
        });

        describe('when the Resolver has an explicit webpack config filepath', function () {
          beforeEach(function () {
            resolver.webpackConfigPath = '/path/to/webpack.config.js';
          });

          describe('when the provided webpack config filepath is found', function () {
            beforeEach(function () {
              stubs.fs.existsSync.returns(true);
            });

            it('should return the path to the webpack config filepath', function () {
              expect(
                resolver._tryFindWebpackConfigPath(),
                'to equal',
                '/path/to/webpack.config.js'
              );
            });
          });

          describe('when the provided webpack config filepath is not found', function () {
            beforeEach(function () {
              stubs.fs.existsSync.returns(false);
            });

            it('should throw', function () {
              expect(() => resolver._tryFindWebpackConfigPath(), 'to throw');
            });
          });
        });
      });

      describe('_tryFindTSConfigPath()', function () {
        describe('when the Resolver has no explicit TS config filepath', function () {
          beforeEach(function () {
            stubs.path.resolve.returns('/path/to/ts.config.js');
          });

          it('should look for the default TS config in the cwd', function () {
            resolver._tryFindTSConfigPath();
            expect(stubs.fs.existsSync, 'to have a call satisfying', [
              '/path/to/ts.config.js',
            ]);
          });

          describe('when the default TS config is not found in the cwd', function () {
            beforeEach(function () {
              stubs.fs.existsSync.returns(false);
            });

            it('should return void', function () {
              expect(resolver._tryFindTSConfigPath(), 'to be undefined');
            });
          });

          describe('when the default TS config is found in the cwd', function () {
            beforeEach(function () {
              stubs.fs.existsSync.returns(true);
            });

            it('should return the full path to the TS webpack config', function () {
              expect(
                resolver._tryFindTSConfigPath(),
                'to equal',
                '/path/to/ts.config.js'
              );
            });
          });

          it('should attempt to find the default TS config in the cwd', function () {
            resolver._tryFindTSConfigPath();
            expect(stubs.path.resolve, 'to have a call satisfying', [
              resolver.cwd,
              Resolver.constants.DEFAULT_TS_CONFIG_FILENAME,
            ]);
          });
        });

        describe('when the Resolver has an explicit TS config filepath', function () {
          beforeEach(function () {
            resolver.tsConfigPath = '/path/to/ts.config.js';
          });

          describe('when the provided TS config filepath is found', function () {
            beforeEach(function () {
              stubs.fs.existsSync.returns(true);
            });

            it('should return the path to the webpaTSck config filepath', function () {
              expect(
                resolver._tryFindTSConfigPath(),
                'to equal',
                '/path/to/ts.config.js'
              );
            });
          });

          describe('when the provided TS config filepath is not found', function () {
            beforeEach(function () {
              stubs.fs.existsSync.returns(false);
            });

            it('should throw', function () {
              expect(() => resolver._tryFindTSConfigPath(), 'to throw');
            });
          });
        });
      });

      describe('_tryNaivelyResolvePartials', function () {
        beforeEach(function () {
          stubs.path.dirname.returns('/some/path');
        });

        describe('when no parameters provided', function () {
          it('should throw', function () {
            expect(
              // @ts-ignore
              () => resolver._tryNaivelyResolvePartials(),
              'to throw',
              expect.it('to be a', TypeError)
            );
          });
        });

        describe('when no `unfilteredPartials` parameter provided', function () {
          it('should return empty lists', function () {
            expect(resolver._tryNaivelyResolvePartials('foo.js'), 'to equal', {
              naivelyResolvedPartials: new Set(),
              unresolvedPartials: new Set(),
            });
          });
        });

        describe('when `unfilteredPartials` parameter provided', function () {
          beforeEach(function () {
            stubs.path.resolve.returns('/some/path/foo.js');
            stubs['resolve-from'].returns('/some/path/bar.js');
          });

          it('should attempt to resolve the partial from the dir of the filepath', function () {
            resolver._tryNaivelyResolvePartials('foo.js', new Set(['bar']));
            expect(stubs['resolve-from'], 'to have a call satisfying', [
              '/some/path',
              'bar',
            ]);
          });

          it('should emit EVENT_DEPENDENCY', function () {
            expect(
              () =>
                resolver._tryNaivelyResolvePartials(
                  'foo.js',
                  new Set(['bar.js'])
                ),
              'to emit from',
              resolver,
              Resolver.constants.EVENT_DEPENDENCY,
              {filepath: '/some/path/foo.js', resolved: '/some/path/bar.js'}
            );
          });

          it('should return the resolved partial in the list of naively resolved partials', function () {
            expect(
              resolver._tryNaivelyResolvePartials(
                'foo.js',
                new Set(['bar.js'])
              ),
              'to equal',
              {
                naivelyResolvedPartials: new Set(['/some/path/bar.js']),
                unresolvedPartials: new Set(),
              }
            );
          });

          describe('when the filepath is ignored', function () {
            beforeEach(function () {
              stubs.multimatch.returns({length: 1});
            });

            it('should not emit EVENT_DEPENDENCY', function () {
              expect(
                () =>
                  resolver._tryNaivelyResolvePartials(
                    'foo.js',
                    new Set(['bar.js'])
                  ),
                'not to emit from',
                resolver,
                Resolver.constants.EVENT_DEPENDENCY
              );
            });

            it('should not be added to the return value', function () {
              expect(
                resolver._tryNaivelyResolvePartials(
                  'foo.js',
                  new Set(['bar.js'])
                ),
                'to equal',
                {
                  naivelyResolvedPartials: new Set(),
                  unresolvedPartials: new Set(),
                }
              );
            });
          });

          describe('if resolution fails', function () {
            beforeEach(function () {
              stubs['resolve-from'].throws();
            });

            it('the partial should be added to the list of unresolved partials', function () {
              expect(
                resolver._tryNaivelyResolvePartials('foo.js', new Set(['bar'])),
                'to equal',
                {
                  naivelyResolvedPartials: new Set(),
                  unresolvedPartials: new Set(['bar']),
                }
              );
            });
          });

          describe('if the ignore check fails', function () {
            beforeEach(function () {
              stubs.multimatch.throws();
            });

            it('the partial should be added to the list of unresolved partials', function () {
              expect(
                resolver._tryNaivelyResolvePartials('foo.js', new Set(['bar'])),
                'to equal',
                {
                  naivelyResolvedPartials: new Set(),
                  unresolvedPartials: new Set(['bar']),
                }
              );
            });
          });
        });
      });

      describe('_resolvePartials', function () {
        describe('when called without parameters', function () {
          it('should throw', function () {
            expect(
              // @ts-ignore
              () => resolver._resolvePartials(),
              'to throw',
              expect.it('to be a', TypeError)
            );
          });
        });

        describe('when called without a filepath', function () {
          it('should throw', function () {
            expect(
              // @ts-ignore
              () => resolver._resolvePartials(new Set()),
              'to throw',
              expect.it('to be a', TypeError)
            );
          });
        });

        describe('when provided an empty set of unresolved partials', function () {
          it('should return an empty set', function () {
            expect(
              resolver._resolvePartials(new Set(), 'foo.js'),
              'to equal',
              new Set()
            );
          });
        });

        describe('when all partials cannot be resolved', function () {
          beforeEach(function () {
            stubs['filing-cabinet'].returns('');
          });

          it('should return an empty set', function () {
            expect(
              resolver._resolvePartials(new Set(['derp']), 'foo.js'),
              'to equal',
              new Set()
            );
          });
        });

        describe('when resolution fails', function () {
          beforeEach(function () {
            stubs['filing-cabinet'].throws();
          });

          it('should throw', function () {
            expect(
              () =>
                resolver._resolvePartials(new Set(['derp', 'herp']), 'foo.js'),
              'to throw'
            );
          });
        });

        describe('when matching against the ignore list fails', function () {
          beforeEach(function () {
            stubs['filing-cabinet'].returns('/path/to/herp.js');
            stubs.multimatch.throws();
          });

          it('should throw', function () {
            expect(
              () =>
                resolver._resolvePartials(new Set(['derp', 'herp']), 'foo.js'),
              'to throw'
            );
          });
        });

        describe('when some partials can be resolved', function () {
          beforeEach(function () {
            stubs['filing-cabinet'].onFirstCall().returns('');
            stubs['filing-cabinet'].onSecondCall().returns('/path/to/herp.js');
            stubs.path.resolve.returns('/path/to/foo.js');
          });

          it('should return a set containing the resolved partials', function () {
            expect(
              resolver._resolvePartials(new Set(['derp', 'herp']), 'foo.js'),
              'to equal',
              new Set(['/path/to/herp.js'])
            );
          });

          it('should emit event EVENT_DEPENDENCY', function () {
            expect(
              () =>
                resolver._resolvePartials(new Set(['derp', 'herp']), 'foo.js'),
              'to emit from',
              resolver,
              Resolver.constants.EVENT_DEPENDENCY,
              {filepath: '/path/to/foo.js', resolved: '/path/to/herp.js'}
            );
          });

          describe('when the resolved partial is ignored', function () {
            beforeEach(function () {
              stubs.multimatch.returns({length: 1});
            });

            it('should return a set not containing the ignored resolved partial', function () {
              expect(
                resolver._resolvePartials(new Set(['derp', 'herp']), 'foo.js'),
                'to equal',
                new Set()
              );
            });
          });
        });
      });
    });
  });
});

/**
 * @typedef {import('sinon').SinonStub} SinonStub
 */
