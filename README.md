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

> [API docs](https://github.com/boneskull/mrca/blob/master/API.md)

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

## How Does It Work

Given a list of filepaths to begin with ("entry" files), `mrca` will:

1. Statically analyze each using [`precinct`](https://npm.im/precinct) to get a list of dependency names ("partials")
1. Hand the result to [`filing-cabinet`](https://npm.im/filing-cabinet) for module resolution
1. Using the resolved paths, create a two-way mapping of each filepath to its dependencies, its dependents, _and_ the original "entry" file(s)
1. Since this can potentially be _slow_, cache the resulting mapping
1. Using _all_ the filepaths in the mapping, create a second cache to track file changes

When a file changes, we can then ask `mrca`, "which entry files were affected?"

Practically, if we have `butts.spec.js` which runs tests against `butts.js`, and we made a change to `butts.js`, we can use `mrca` to determine that we need to re-run all the tests in `test/butts.spec.js`.

## Why This

Other similar solutions to the "which tests should I run" problem do _not_ use static analysis (since it can be imperfect--we're going for "good enough" here), and instead require instrumentation to determine which-files-did-what. The results with this strategy are more accurate--but prevents the system from understanding anything except JavaScript-running-in-a-VM. `mrca` is able to understand if you are using Webpack loaders with things like stylesheets, a change to the stylesheet has implications for its dependants. When coupled with something like `ts-node`, `mrca` also understands the relationship between TypeScript sources.

While instrumentation-based solutions make sense for many scenarios, `mrca` was created out of a different set of constraints. In particular, Mocha uses a _pool_ of worker processes to run test files in parallel. Any worker can run one or more test files, in any order, which can provide a performance improvement over one-test-file-per-process. Further, tests written for Mocha _cannot run without `mocha`_, and thusly Mocha's own sources, since they share the same process. This means that an instrumentation-based solution--which gets its information from the files run in a _single_ process--would both result in a murky relationship between the files any given worker process runs, _and_ would be polluted with Mocha's own internals. Given the set of tools available in the ecosystem, anything but static analysis did not seem feasible.

There _will_ be situations where static analysis fails--think dynamic `require`s--but I plan on providing workarounds (of the "bring-your-own mapping" variety) in future development.

## Disclaimer

Mocha doesn't actually use `mrca`--yet. WIP!

## License

Copyright © 2020 Christopher Hiller. Licensed Apache-2.0
