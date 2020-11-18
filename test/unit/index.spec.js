'use strict';

const expect = require('../expect');
const rewiremock = require('rewiremock/node');
const sinon = require('sinon');

describe('mrca', function () {
  /**
   * @type {typeof import('../..')}
   */
  let mrca;

  afterEach(function () {
    sinon.restore();
  });

  describe('createModuleMap()', function () {
    class ThreadedModuleMap {}
    class ModuleMap {}

    beforeEach(function () {
      mrca = rewiremock.proxy(() => require('../..'), {
        [require.resolve('../../src/threaded-module-map')]: {
          ThreadedModuleMap: {
            create: sinon.stub().callsFake(() => new ThreadedModuleMap()),
          },
        },
        [require.resolve('../../src/module-map')]: {
          ModuleMap: {
            create: sinon.stub().callsFake(() => new ModuleMap()),
          },
        },
      });
    });

    describe('when `threaded` option is truthy', function () {
      it('should return a ThreadedModuleMap', function () {
        expect(
          mrca.createModuleMap({threaded: true}),
          'to be a',
          ThreadedModuleMap
        );
      });
    });

    describe('when `threaded` option is falsy', function () {
      it('should return a ModuleMap', function () {
        expect(mrca.createModuleMap({threaded: false}), 'to be a', ModuleMap);
      });
    });
  });
});
