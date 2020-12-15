/**
 * Comm between {@link Resolver} and {@link ThreadedMRCA}.
 *
 * `workerData` should be {@link ResolverOptions}
 * Intended to be launched as a worker thread
 */

'use strict';

const {parentPort, workerData} = require('worker_threads');
const {Resolver} = require('./resolver');
const {EVENT_RESOLVED_DEPENDENCIES} = Resolver.constants;

const resolver = Resolver.create(workerData || {});

/**
 * Commands
 */
const commands = {
  FIND_DEPENDENCIES: 'find-dependencies',
  DISCONNECT: 'disconnect',
};

/**
 * @param {CommandEventData<FindDependenciesCommandPayload>} data
 */
const listener = (data) => {
  switch (data.command) {
    case commands.FIND_DEPENDENCIES: {
      const {payload} = data;
      resolver.resolveDependencies(payload.filepath);
      break;
    }
    case commands.DISCONNECT: {
      parentPort.removeListener('message', listener);
      break;
    }
    default:
      console.warn(`received unknown command; event data: %o`, data);
      break;
  }
};

resolver.on(
  EVENT_RESOLVED_DEPENDENCIES,
  /** @param {import('./resolver').ResolvedDependenciesEventData} data */ (
    data
  ) => {
    parentPort.postMessage({
      event: EVENT_RESOLVED_DEPENDENCIES,
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

/**
 * @template T
 * @typedef {Object} CommandEventData
 * @property {keyof commands} command - Name of command
 * @property {T} [payload] - Payload, if any
 */

/**
 * @typedef {Object} FindDependenciesCommandPayload
 * @property {string} filepath
 */
