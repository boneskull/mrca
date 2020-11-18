'use strict';

const {parentPort, workerData} = require('worker_threads');
const {Resolver} = require('./resolver');

const resolver = new Resolver((workerData || {}).opts);

const listener = ({command, payload}) => {
  switch (command) {
    case 'find-dependencies': {
      resolver.resolveDependencies(payload.filepath);
      break;
    }
    default:
      parentPort.removeListener('message', listener);
      break;
  }
};

resolver
  .on(
    Resolver.constants.EVENT_DEPENDENCY,
    /** @param {import('./resolver').DependencyData} data */ (data) => {
      parentPort.postMessage({
        event: Resolver.constants.EVENT_DEPENDENCY,
        data,
      });
    }
  )
  .on(
    Resolver.constants.EVENT_RESOLVE_DEPENDENCIES_COMPLETE,
    /** @param {import('./resolver').ResolveCompleteData} data */ (data) => {
      parentPort.postMessage({
        event: Resolver.constants.EVENT_RESOLVE_DEPENDENCIES_COMPLETE,
        data,
      });
    }
  );
parentPort.on('message', listener);

/**
 * @typedef {Object} ResolverWorkerMessage
 * @property {string} event - Event name
 * @property {any} data - Message data
 */
