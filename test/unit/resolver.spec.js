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
        'dependency-tree': {
          toList: sinon.stub().returns([]),
        },
        multimatch: sinon.stub().returns([]),
        fs: {
          existsSync: sinon.stub(),
        },
        path: {
          extname: sinon.stub(),
          dirname: sinon.stub(),
          resolve: sinon.stub(),
        },
      };
      Resolver = rewiremock.proxy(
        () => require('../../src/resolver'),
        (r) => ({
          debug: r.with(stubs.debug).directChildOnly(),
          'dependency-tree': r.with(stubs['dependency-tree']).directChildOnly(),
          multimatch: r.with(stubs.multimatch).directChildOnly(),
          fs: r.with(stubs.fs).directChildOnly(),
          path: r.with(stubs.path).directChildOnly(),
        })
      ).Resolver;
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

      describe('resolveDependencies()', function () {
        describe('when called without a filepath parameter', function () {
          it('should throw');
        });

        describe('when called with a filepath parameter', function () {
          it('should get the partials from precinct');

          describe('when precinct throws', function () {
            it('should return an empty set');
          });

          describe('when a TS config has been found', function () {
            it('should not do naive resolution');

            it('should emit event EVENT_DEPENDENCY for the config file');

            it('should return a set containing the TS config path');
          });

          describe('when a webpack config has been found', function () {
            it('should not do naive resolution');

            it('should emit event EVENT_DEPENDENCY for the config file');

            it('should return a set containing the TS config path');
          });

          describe('when an unknown file extension is present', function () {
            it('should not do naive resolution');

            it('should ask `filing-cabinet` to resolve the file');
          });

          describe('when no webpack config nor TS config is found and the file is javascript', function () {
            it('should attempt naive resolution');

            it('should return a set containing the naively-resolved partials');

            describe('when naive resolution does not resolve all partials', function () {
              it(
                'should ask `filing-cabinet` to resolve the remaining partials'
              );

              it(
                'should return a set containing both naively-resolved partials and `filing-cabinet`-resolved partials'
              );
            });
          });

          it('should emit event EVENT_RESOLVE_DEPENDENCIES_COMPLETE once');
        });
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

            it('should return the path to the TS config filepath', function () {
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
    });

    describe('static method', function () {
      describe('create()', function () {
        it('should return a Resolver', function () {
          expect(Resolver.create(), 'to be a', Resolver);
        });
      });

      describe('resolveDependencies()', function () {
        describe('when provided a filepath', function () {
          beforeEach(function () {
            sinon
              .stub(Resolver.prototype, 'resolveDependencies')
              .returns(new Set(['/path/to/foo.js']));
          });
          it('should resolve the dependencies for the filepath', function () {
            expect(
              Resolver.resolveDependencies('foo.js'),
              'to equal',
              new Set(['/path/to/foo.js'])
            );
          });
        });

        describe('when not provided a filepath', function () {
          beforeEach(function () {
            sinon.stub(Resolver.prototype, 'resolveDependencies').throws();
          });

          it('should throw', function () {
            // @ts-ignore
            expect(() => Resolver.resolveDependencies(), 'to throw');
          });
        });
      });
    });
  });
});

/**
 * @typedef {import('sinon').SinonStub} SinonStub
 */
