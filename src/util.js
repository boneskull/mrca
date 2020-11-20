'use strict';

const slug = require('slug');
const {mkdirSync} = require('fs');
const os = require('os');
const path = require('path');

const platform = os.platform();

/**
 * This terrible function gives us some place to put our cache files.
 *
 * Ideally, this is determined by the `find-cache-dir` module, which will be `node_modules/.cache/mocha`, relative
 * to the closest `package.json`.
 * Otherwise--and we're _not_ on Windows--try `<XDG cache dir>/mocha`
 * Otherwise, try a temp directory, `<temp-dir>/<username>/mocha`
 * Otherwise, use `.cache/mocha` from `cwd`.
 * Directories will be created recursively.
 * @param {FindCacheDirOptions} [opts] - Optional options
 * @ignore
 * @returns {string} Path to a cache dir
 */
exports.findCacheDir = ({dir, cwd = process.cwd()} = {}) => {
  if (!dir) {
    dir = require('find-cache-dir')({name: 'mocha', create: true, cwd});
    if (!dir) {
      if (platform !== 'win32') {
        dir = require('xdg-basedir').cache;
        if (dir) {
          dir = path.resolve(dir, 'mocha');
        }
      }
      if (!dir) {
        dir = path.resolve(
          require('temp-dir'),
          require('username').sync(),
          'mocha'
        );
      }
    }
  }
  try {
    mkdirSync(dir, {recursive: true});
  } catch {
    dir = path.resolve(cwd, '.cache', 'mocha');
    mkdirSync(dir, {recursive: true});
  }
  return dir;
};

exports.createCacheFilename = (base, cwd, ext) =>
  `${base}_${slug(cwd, {replacement: '-'})}.${ext}`;

/**
 * Options for {@link findCacheDir}.
 * @ignore
 * @typedef {Object} FindCacheDirOptions
 * @property {string} [dir] - Explicit dir; will be created if necessary
 * @property {string} [cwd] - Current working directory
 */
