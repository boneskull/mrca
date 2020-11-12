# mrca

> most recent common ancestor: find ancestors for changed files

- Builds & caches a dependency tree via static analysis
- Tracks file changes
- _Determines which ancestor files are affected by a change to a file in the dependency tree_

Used by [Mocha](https://mochajs.org) to determine which tests to rerun (in "watch" mode) given a file change.

## Install

```shell
$ npm install mrca
```

## Usage

> [API docs](https://github.com/boneskull/mrca/master/blob/API.md)

```js
// ModuleMap extends Map<string,ModuleMapNode>
const {ModuleMap} = require('mrca');

const moduleMap = ModuleMap.create({
  entryFiles: ['foo.js', 'bar.js'],
});

// keys of `moduleMap` are absolute filepaths, and the values are `ModuleMapNode` objects
// contain lists of `parents`, `children` and related `entryFiles`.
// a cache of the tree is maintained and updated as files change

// ..time passes, and stuff happens to a transitive dependency (quux.js) of foo.js..
// we probably want something like chokidar to tell us when a file we're watching has changed

// here, we ask the module map which of our entry files (foo.js, bar.js, above)
// were potentially affected.  passing an array of filepaths here is optional; in our case
// we _know_ that quux.js changed, so we're giving it a "hint"
const {allFiles, entryFiles} = moduleMap.findAffectedFiles(['quux.js']);

// in actuality, these paths are all absolute relative to a `cwd` option
// to the `ModuleMap` constructor, which defaults to `process.cwd()`
entryFiles.has('foo.js'); // true
// bar.js is not an ancestor of quux.js, so it's not here
entryFiles.has('bar.js'); // false

// entryFiles is a strict subset of allFiles
allFiles.has('foo.js'); // true
allFiles.has('quux.js'); // true
// foo.js depends on baz.js which depends on quux.js
allFiles.has('baz.js'); // true
```

## Notes

The Typescript declaration files published by this module will contain more complete API documentation.

## License

Copyright © 2020 Christopher Hiller. Licensed Apache-2.0
