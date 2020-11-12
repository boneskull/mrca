## Classes

<dl>
<dt><a href="#FileEntryCache">FileEntryCache</a></dt>
<dd><p>A wrapper around the <code>file-entry-cache</code> module.</p>
<p>You should not need to interface directly with this class.</p></dd>
<dt><a href="#ModuleMapCache">ModuleMapCache</a></dt>
<dd><p>A wrapper around a <code>flat-cache</code> object keyed on filepath and containing
[ModuleMapNode](#ModuleMapNode) values. Essentially an on-disk representation of
a [ModuleMap](#ModuleMap).</p>
<p>You should not need to interface with this class directly.</p></dd>
<dt><a href="#ModuleMapNode">ModuleMapNode</a></dt>
<dd><p>Class used internally by [ModuleMap](#ModuleMap) which tracks the relationship between parents and children.</p>
<p>All &quot;references&quot; are by filename (string); there are no references to other [ModuleMap](#ModuleMap)s.</p>
<p>You should not need to create one of these; [ModuleMap](#ModuleMap) will do it for you.</p></dd>
<dt><a href="#ModuleMap">ModuleMap</a> ⇐ <code>Map&lt;string,ModuleMapNode&gt;</code></dt>
<dd><p>A very fancy <code>Map</code> which provides high-level information about dependency trees and file changes therein.</p>
<p>This class is the main point of entry for this package; use [create](#ModuleMap.create) to get going.</p></dd>
</dl>

## Objects

<dl>
<dt><a href="#constants">constants</a> : <code>object</code></dt>
<dd><p>Contains constants used across this package.</p></dd>
</dl>

## Functions

<dl>
<dt><a href="#resolveDependencies">resolveDependencies(filepath, [opts])</a> ⇒ <code>Set.&lt;string&gt;</code></dt>
<dd><p>Given a path to a module, attempt to determine the paths to its dependencies.</p>
<ul>
<li>This function is used to determine which tests need re-running if a file changes</li>
<li>Does special handling of TypeScript sources and supports Webpack configurations</li>
</ul></dd>
</dl>

## Typedefs

<dl>
<dt><a href="#FileEntryCacheOptions">FileEntryCacheOptions</a> : <code>Object</code></dt>
<dd><p>Options for [FileEntryCache](#FileEntryCache) constructor.</p></dd>
<dt><a href="#ModuleMapCacheOptions">ModuleMapCacheOptions</a> : <code>Object</code></dt>
<dd><p>Options for [ModuleMapCache](#ModuleMapCache) constructor.</p></dd>
<dt><a href="#ModuleMapNodeOptions">ModuleMapNodeOptions</a> : <code>Object</code></dt>
<dd><p>Options for [ModuleMapNode](#ModuleMapNode) constructor.</p></dd>
<dt><a href="#ModuleMapNodeJSON">ModuleMapNodeJSON</a> : <code>Object</code></dt>
<dd><p>A representation of a [ModuleMapNode](#ModuleMapNode) suitable for JSON stringification.</p></dd>
<dt><a href="#ModuleMapOptions">ModuleMapOptions</a> : <code>Object</code></dt>
<dd><p>Options for [ModuleMap](#ModuleMap)</p></dd>
<dt><a href="#FindAffectedFilesOptions">FindAffectedFilesOptions</a> : <code>Object</code></dt>
<dd><p>Options for [findAffectedFiles](#ModuleMap+findAffectedFiles)</p></dd>
<dt><a href="#InitOptions">InitOptions</a> : <code>Object</code></dt>
<dd><p>Options for [ModuleMap#init](ModuleMap#init)</p></dd>
<dt><a href="#MergeFromCacheOptions">MergeFromCacheOptions</a> : <code>Object</code></dt>
<dd><p>Options for [ModuleMapNode#mergeFromCache](ModuleMapNode#mergeFromCache).</p></dd>
<dt><a href="#ResolveDependenciesOptions">ResolveDependenciesOptions</a> : <code>Object</code></dt>
<dd><p>Options for [resolveDependencies](#resolveDependencies)</p></dd>
</dl>

<a name="FileEntryCache"></a>

## FileEntryCache

<p>A wrapper around the <code>file-entry-cache</code> module.</p>
<p>You should not need to interface directly with this class.</p>

**Kind**: global class  
**See**: https://npm.im/file-entry-cache

- [FileEntryCache](#FileEntryCache)
  - [new FileEntryCache([opts])](#new_FileEntryCache_new)
  - _instance_
    - [.filepath](#FileEntryCache+filepath) : <code>string</code>
    - [.save(map)](#FileEntryCache+save) ⇒ [<code>FileEntryCache</code>](#FileEntryCache)
    - [.hasFileChanged(filepath)](#FileEntryCache+hasFileChanged) ⇒ <code>boolean</code>
    - [.markFileChanged(filepath)](#FileEntryCache+markFileChanged)
    - [.yieldChangedFiles(map)](#FileEntryCache+yieldChangedFiles) ⇒ <code>Set.&lt;string&gt;</code>
    - [.reset()](#FileEntryCache+reset) ⇒ [<code>FileEntryCache</code>](#FileEntryCache)
  - _static_
    - [.create([opts])](#FileEntryCache.create) ⇒ [<code>FileEntryCache</code>](#FileEntryCache)

<a name="new_FileEntryCache_new"></a>

### new FileEntryCache([opts])

<p>Finds an appropriate cache dir (if necessary) and creates the cache on-disk.</p>

| Param  | Type                                                         |
| ------ | ------------------------------------------------------------ |
| [opts] | [<code>FileEntryCacheOptions</code>](#FileEntryCacheOptions) |

<a name="FileEntryCache+filepath"></a>

### fileEntryCache.filepath : <code>string</code>

<p>Full filepath of the cache on disk</p>

**Kind**: instance property of [<code>FileEntryCache</code>](#FileEntryCache)  
<a name="FileEntryCache+save"></a>

### fileEntryCache.save(map) ⇒ [<code>FileEntryCache</code>](#FileEntryCache)

<p>Persists file entry cache to disk</p>

**Kind**: instance method of [<code>FileEntryCache</code>](#FileEntryCache)  
**Todo**

- [ ] Do we need to allow `noPrune` to be `false`?

| Param | Type                                 | Description |
| ----- | ------------------------------------ | ----------- |
| map   | <code>Map.&lt;string, any&gt;</code> | <p>Map</p>  |

<a name="FileEntryCache+hasFileChanged"></a>

### fileEntryCache.hasFileChanged(filepath) ⇒ <code>boolean</code>

<p>Returns <code>true</code> if a filepath has changed since we last called [save](#FileEntryCache+save).</p>

**Kind**: instance method of [<code>FileEntryCache</code>](#FileEntryCache)

| Param    | Type                | Description          |
| -------- | ------------------- | -------------------- |
| filepath | <code>string</code> | <p>Absolute path</p> |

<a name="FileEntryCache+markFileChanged"></a>

### fileEntryCache.markFileChanged(filepath)

<p>Marks a filepath as &quot;changed&quot; by removing it from the underlying cache.</p>

**Kind**: instance method of [<code>FileEntryCache</code>](#FileEntryCache)

| Param    | Type                | Description                                                      |
| -------- | ------------------- | ---------------------------------------------------------------- |
| filepath | <code>string</code> | <p>Absolute path of file to remove from the underlying cache</p> |

<a name="FileEntryCache+yieldChangedFiles"></a>

### fileEntryCache.yieldChangedFiles(map) ⇒ <code>Set.&lt;string&gt;</code>

<p>Returns a <code>Set</code> of changed files based on keys of the provided <code>Map</code>.
If no filepaths provided, returns list of all <em>known</em> changed files.
Resets the state of all files to &quot;not changed&quot; until this method is run again
by calling [save](#FileEntryCache+save).</p>

**Kind**: instance method of [<code>FileEntryCache</code>](#FileEntryCache)  
**Returns**: <code>Set.&lt;string&gt;</code> - <p>Changed filepaths</p>

| Param | Type                                 | Description                                           |
| ----- | ------------------------------------ | ----------------------------------------------------- |
| map   | <code>Map.&lt;string, any&gt;</code> | <p>Map containing keys corresponding to filepaths</p> |

<a name="FileEntryCache+reset"></a>

### fileEntryCache.reset() ⇒ [<code>FileEntryCache</code>](#FileEntryCache)

<p>Destroys the underlying cache.</p>

**Kind**: instance method of [<code>FileEntryCache</code>](#FileEntryCache)  
<a name="FileEntryCache.create"></a>

### FileEntryCache.create([opts]) ⇒ [<code>FileEntryCache</code>](#FileEntryCache)

<p>Creates a [FileEntryCache](#FileEntryCache).</p>

**Kind**: static method of [<code>FileEntryCache</code>](#FileEntryCache)

| Param  | Type                                                         |
| ------ | ------------------------------------------------------------ |
| [opts] | [<code>FileEntryCacheOptions</code>](#FileEntryCacheOptions) |

<a name="ModuleMapCache"></a>

## ModuleMapCache

<p>A wrapper around a <code>flat-cache</code> object keyed on filepath and containing
[ModuleMapNode](#ModuleMapNode) values. Essentially an on-disk representation of
a [ModuleMap](#ModuleMap).</p>
<p>You should not need to interface with this class directly.</p>

**Kind**: global class  
**See**: https://npm.im/flat-cache

- [ModuleMapCache](#ModuleMapCache)
  - [new ModuleMapCache([opts])](#new_ModuleMapCache_new)
  - _instance_
    - [.cwd](#ModuleMapCache+cwd) : <code>string</code>
    - [.cacheDir](#ModuleMapCache+cacheDir) : <code>string</code>
    - [.filename](#ModuleMapCache+filename) : <code>string</code>
    - [.filepath](#ModuleMapCache+filepath) : <code>string</code>
    - [.save(map)](#ModuleMapCache+save) ⇒ [<code>ModuleMapCache</code>](#ModuleMapCache)
    - [.values()](#ModuleMapCache+values) ⇒ <code>Set.&lt;any&gt;</code>
    - [.reset()](#ModuleMapCache+reset) ⇒ [<code>ModuleMapCache</code>](#ModuleMapCache)
  - _static_
    - [.create([opts])](#ModuleMapCache.create) ⇒ [<code>ModuleMapCache</code>](#ModuleMapCache)

<a name="new_ModuleMapCache_new"></a>

### new ModuleMapCache([opts])

<p>Finds an appropriate cache dir (if necessary) and creates the cache on-disk.</p>

| Param  | Type                                                         |
| ------ | ------------------------------------------------------------ |
| [opts] | [<code>ModuleMapCacheOptions</code>](#ModuleMapCacheOptions) |

<a name="ModuleMapCache+cwd"></a>

### moduleMapCache.cwd : <code>string</code>

<p>Current working directory</p>

**Kind**: instance property of [<code>ModuleMapCache</code>](#ModuleMapCache)  
<a name="ModuleMapCache+cacheDir"></a>

### moduleMapCache.cacheDir : <code>string</code>

**Kind**: instance property of [<code>ModuleMapCache</code>](#ModuleMapCache)  
<a name="ModuleMapCache+filename"></a>

### moduleMapCache.filename : <code>string</code>

<p>Filename of cache file</p>

**Kind**: instance property of [<code>ModuleMapCache</code>](#ModuleMapCache)  
<a name="ModuleMapCache+filepath"></a>

### moduleMapCache.filepath : <code>string</code>

<p>Full filepath of the cache on disk</p>

**Kind**: instance property of [<code>ModuleMapCache</code>](#ModuleMapCache)  
<a name="ModuleMapCache+save"></a>

### moduleMapCache.save(map) ⇒ [<code>ModuleMapCache</code>](#ModuleMapCache)

<p>Persists the contents of a string-keyed <code>Map</code> to disk in cache</p>

**Kind**: instance method of [<code>ModuleMapCache</code>](#ModuleMapCache)  
**Todo**

- [ ] Do we need to allow `noPrune` to be `false`?

| Param | Type                                 | Description |
| ----- | ------------------------------------ | ----------- |
| map   | <code>Map.&lt;string, any&gt;</code> | <p>Map</p>  |

<a name="ModuleMapCache+values"></a>

### moduleMapCache.values() ⇒ <code>Set.&lt;any&gt;</code>

<p>Return a <code>Set</code> of all <em>values</em> contained in the cache.</p>
<p>When consumed by [ModuleMap](#ModuleMap), this is a <code>Set</code> of [ModuleMapNode](#ModuleMapNode) objects.</p>

**Kind**: instance method of [<code>ModuleMapCache</code>](#ModuleMapCache)  
<a name="ModuleMapCache+reset"></a>

### moduleMapCache.reset() ⇒ [<code>ModuleMapCache</code>](#ModuleMapCache)

<p>Destroys the on-disk cache.</p>

**Kind**: instance method of [<code>ModuleMapCache</code>](#ModuleMapCache)  
<a name="ModuleMapCache.create"></a>

### ModuleMapCache.create([opts]) ⇒ [<code>ModuleMapCache</code>](#ModuleMapCache)

<p>Constructs a [ModuleMapCache](#ModuleMapCache).</p>

**Kind**: static method of [<code>ModuleMapCache</code>](#ModuleMapCache)

| Param  | Type                                                         |
| ------ | ------------------------------------------------------------ |
| [opts] | [<code>ModuleMapCacheOptions</code>](#ModuleMapCacheOptions) |

<a name="ModuleMapNode"></a>

## ModuleMapNode

<p>Class used internally by [ModuleMap](#ModuleMap) which tracks the relationship between parents and children.</p>
<p>All &quot;references&quot; are by filename (string); there are no references to other [ModuleMap](#ModuleMap)s.</p>
<p>You should not need to create one of these; [ModuleMap](#ModuleMap) will do it for you.</p>

**Kind**: global class

- [ModuleMapNode](#ModuleMapNode)
  - [new ModuleMapNode(filepath, opts)](#new_ModuleMapNode_new)
  - _instance_
    - [.toJSON()](#ModuleMapNode+toJSON) ⇒ [<code>ModuleMapNodeJSON</code>](#ModuleMapNodeJSON)
    - [.toString()](#ModuleMapNode+toString) ⇒ <code>string</code>
  - _static_
    - [.create(filepath, [opts])](#ModuleMapNode.create) ⇒ [<code>ModuleMapNode</code>](#ModuleMapNode)

<a name="new_ModuleMapNode_new"></a>

### new ModuleMapNode(filepath, opts)

<p>Just sets some properties, folks.</p>

| Param    | Type                                                       | Description                                                                                  |
| -------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| filepath | <code>string</code>                                        | <p>Absolute filepath. May not point to a &quot;module&quot; per se, but some other file.</p> |
| opts     | [<code>ModuleMapNodeOptions</code>](#ModuleMapNodeOptions) |                                                                                              |

<a name="ModuleMapNode+toJSON"></a>

### moduleMapNode.toJSON() ⇒ [<code>ModuleMapNodeJSON</code>](#ModuleMapNodeJSON)

<p>Returns an object suitable for JSON stringification</p>

**Kind**: instance method of [<code>ModuleMapNode</code>](#ModuleMapNode)  
<a name="ModuleMapNode+toString"></a>

### moduleMapNode.toString() ⇒ <code>string</code>

<p>Returns the JSON-stringified representation of this <code>ModuleMapNode</code>.</p>

**Kind**: instance method of [<code>ModuleMapNode</code>](#ModuleMapNode)  
<a name="ModuleMapNode.create"></a>

### ModuleMapNode.create(filepath, [opts]) ⇒ [<code>ModuleMapNode</code>](#ModuleMapNode)

<p>Creates a [ModuleMapNode](#ModuleMapNode), saving you from the horror of the <code>new</code> keyword.</p>

**Kind**: static method of [<code>ModuleMapNode</code>](#ModuleMapNode)

| Param    | Type                                                       |
| -------- | ---------------------------------------------------------- |
| filepath | <code>string</code>                                        |
| [opts]   | [<code>ModuleMapNodeOptions</code>](#ModuleMapNodeOptions) |

<a name="ModuleMap"></a>

## ModuleMap ⇐ <code>Map&lt;string,ModuleMapNode&gt;</code>

<p>A very fancy <code>Map</code> which provides high-level information about dependency trees and file changes therein.</p>
<p>This class is the main point of entry for this package; use [create](#ModuleMap.create) to get going.</p>

**Kind**: global class  
**Extends**: <code>Map&lt;string,ModuleMapNode&gt;</code>

- [ModuleMap](#ModuleMap) ⇐ <code>Map&lt;string,ModuleMapNode&gt;</code>
  - [new ModuleMap(opts)](#new_ModuleMap_new)
  - _instance_
    - [.cwd](#ModuleMap+cwd) : <code>string</code>
    - [.cacheDir](#ModuleMap+cacheDir) : <code>string</code>
    - [.moduleMapCache](#ModuleMap+moduleMapCache) : [<code>ModuleMapCache</code>](#ModuleMapCache)
    - [.fileEntryCache](#ModuleMap+fileEntryCache) : [<code>FileEntryCache</code>](#FileEntryCache)
    - [.entryFiles](#ModuleMap+entryFiles) : <code>Set.&lt;string&gt;</code>
    - [.ignore](#ModuleMap+ignore) : <code>Set.&lt;string&gt;</code>
    - [.tsConfigPath](#ModuleMap+tsConfigPath) : <code>string</code>
    - [.webpackConfigPath](#ModuleMap+webpackConfigPath) : <code>string</code>
    - [.files](#ModuleMap+files) : <code>Set.&lt;string&gt;</code>
    - [.directories](#ModuleMap+directories) : <code>Set.&lt;string&gt;</code>
    - [.entryDirectories](#ModuleMap+entryDirectories) : <code>Set.&lt;string&gt;</code>
    - [.save()](#ModuleMap+save) ⇒ [<code>ModuleMap</code>](#ModuleMap)
    - [.toString()](#ModuleMap+toString) ⇒ <code>string</code>
    - [.isEntryFile(filename)](#ModuleMap+isEntryFile) ⇒ <code>boolean</code>
    - [.getAll([filenames])](#ModuleMap+getAll) ⇒ [<code>Set.&lt;ModuleMapNode&gt;</code>](#ModuleMapNode)
    - [.addEntryFile(filepath)](#ModuleMap+addEntryFile) ⇒ [<code>ModuleMap</code>](#ModuleMap)
    - [.mergeFromCache([opts])](#ModuleMap+mergeFromCache) ⇒ [<code>ModuleMap</code>](#ModuleMap)
    - [.delete(filepath)](#ModuleMap+delete) ⇒ <code>boolean</code>
    - [.findDependencies(filepath)](#ModuleMap+findDependencies) ⇒ <code>Set.&lt;string&gt;</code>
    - [.markFileAsChanged(filepath)](#ModuleMap+markFileAsChanged) ⇒ [<code>ModuleMap</code>](#ModuleMap)
    - [.findAffectedFiles(nodes)](#ModuleMap+findAffectedFiles) ⇒ <code>Object</code>
    - [.findAffectedFilesForChangedFiles([opts])](#ModuleMap+findAffectedFilesForChangedFiles) ⇒ <code>Object</code>
    - [.toJSON()](#ModuleMap+toJSON) ⇒ <code>Object.&lt;string, ModuleMapNodeJSON&gt;</code>
  - _static_
    - [.create([opts])](#ModuleMap.create)

<a name="new_ModuleMap_new"></a>

### new ModuleMap(opts)

<p>Initializes cache, map, loads from disk, finds deps, etc.
Cannot be instantiated like a normal map.</p>

| Param | Type                                                               |
| ----- | ------------------------------------------------------------------ |
| opts  | [<code>Partial.&lt;ModuleMapOptions&gt;</code>](#ModuleMapOptions) |

<a name="ModuleMap+cwd"></a>

### moduleMap.cwd : <code>string</code>

<p>Current working directory</p>

**Kind**: instance property of [<code>ModuleMap</code>](#ModuleMap)  
<a name="ModuleMap+cacheDir"></a>

### moduleMap.cacheDir : <code>string</code>

<p>Directory containing cache files</p>

**Kind**: instance property of [<code>ModuleMap</code>](#ModuleMap)  
<a name="ModuleMap+moduleMapCache"></a>

### moduleMap.moduleMapCache : [<code>ModuleMapCache</code>](#ModuleMapCache)

<p>Cache of the module map (cache of dep tree)</p>

**Kind**: instance property of [<code>ModuleMap</code>](#ModuleMap)  
<a name="ModuleMap+fileEntryCache"></a>

### moduleMap.fileEntryCache : [<code>FileEntryCache</code>](#FileEntryCache)

<p>Cache of the file entry cache (tracks changes)</p>

**Kind**: instance property of [<code>ModuleMap</code>](#ModuleMap)  
<a name="ModuleMap+entryFiles"></a>

### moduleMap.entryFiles : <code>Set.&lt;string&gt;</code>

<p>List of entry files (top-level files)</p>

**Kind**: instance property of [<code>ModuleMap</code>](#ModuleMap)  
<a name="ModuleMap+ignore"></a>

### moduleMap.ignore : <code>Set.&lt;string&gt;</code>

<p>Globs to ignore</p>

**Kind**: instance property of [<code>ModuleMap</code>](#ModuleMap)  
<a name="ModuleMap+tsConfigPath"></a>

### moduleMap.tsConfigPath : <code>string</code>

<p>Path to TypeScript config file, if any</p>

**Kind**: instance property of [<code>ModuleMap</code>](#ModuleMap)  
<a name="ModuleMap+webpackConfigPath"></a>

### moduleMap.webpackConfigPath : <code>string</code>

<p>Path to Webpack config file, if any</p>

**Kind**: instance property of [<code>ModuleMap</code>](#ModuleMap)  
<a name="ModuleMap+files"></a>

### moduleMap.files : <code>Set.&lt;string&gt;</code>

<p>Like <code>Map#keys()</code> (for our purposes) but returns a <code>Set</code> instead.</p>

**Kind**: instance property of [<code>ModuleMap</code>](#ModuleMap)  
<a name="ModuleMap+directories"></a>

### moduleMap.directories : <code>Set.&lt;string&gt;</code>

<p>Returns a list of unique directories of all files</p>

**Kind**: instance property of [<code>ModuleMap</code>](#ModuleMap)  
<a name="ModuleMap+entryDirectories"></a>

### moduleMap.entryDirectories : <code>Set.&lt;string&gt;</code>

<p>Returns a list of unique directories of all entry files</p>

**Kind**: instance property of [<code>ModuleMap</code>](#ModuleMap)  
<a name="ModuleMap+save"></a>

### moduleMap.save() ⇒ [<code>ModuleMap</code>](#ModuleMap)

<p>Persists both the module map cache and file entry cache.</p>

**Kind**: instance method of [<code>ModuleMap</code>](#ModuleMap)  
<a name="ModuleMap+toString"></a>

### moduleMap.toString() ⇒ <code>string</code>

<p>Returns a JSON representation of the ModuleMap.</p>

**Kind**: instance method of [<code>ModuleMap</code>](#ModuleMap)  
<a name="ModuleMap+isEntryFile"></a>

### moduleMap.isEntryFile(filename) ⇒ <code>boolean</code>

<p>Returns <code>true</code> if <code>filename</code> is an entry file.
If a relative path is provided, it's resolved from <code>this.cwd</code>.</p>

**Kind**: instance method of [<code>ModuleMap</code>](#ModuleMap)

| Param    | Type                |
| -------- | ------------------- |
| filename | <code>string</code> |

<a name="ModuleMap+getAll"></a>

### moduleMap.getAll([filenames]) ⇒ [<code>Set.&lt;ModuleMapNode&gt;</code>](#ModuleMapNode)

<p>Return a <code>Set&lt;ModuleMapNode&gt;</code> for the list of filenames provided.
Filenames not appearing in this map will not be included--in other words,
the <code>size</code> of the returned value may be less than the <code>size</code>/<code>length</code> of the <code>filenames</code> parameter.</p>

**Kind**: instance method of [<code>ModuleMap</code>](#ModuleMap)

| Param       | Type                                                                 | Description              |
| ----------- | -------------------------------------------------------------------- | ------------------------ |
| [filenames] | <code>Array.&lt;string&gt;</code> \| <code>Set.&lt;string&gt;</code> | <p>List of filenames</p> |

<a name="ModuleMap+addEntryFile"></a>

### moduleMap.addEntryFile(filepath) ⇒ [<code>ModuleMap</code>](#ModuleMap)

<p>Adds an entry file to the map, and populates its dependences</p>

**Kind**: instance method of [<code>ModuleMap</code>](#ModuleMap)

| Param    | Type                |
| -------- | ------------------- |
| filepath | <code>string</code> |

<a name="ModuleMap+mergeFromCache"></a>

### moduleMap.mergeFromCache([opts]) ⇒ [<code>ModuleMap</code>](#ModuleMap)

<p>Syncs module map cache <em>from</em> disk</p>

**Kind**: instance method of [<code>ModuleMap</code>](#ModuleMap)

| Param  | Type                                                                         | Description    |
| ------ | ---------------------------------------------------------------------------- | -------------- |
| [opts] | [<code>Partial.&lt;MergeFromCacheOptions&gt;</code>](#MergeFromCacheOptions) | <p>Options</p> |

<a name="ModuleMap+delete"></a>

### moduleMap.delete(filepath) ⇒ <code>boolean</code>

<p>Removes a file from the map (and all references within the map's <code>ModuleMapNode</code> values)</p>

**Kind**: instance method of [<code>ModuleMap</code>](#ModuleMap)

| Param    | Type                |
| -------- | ------------------- |
| filepath | <code>string</code> |

<a name="ModuleMap+findDependencies"></a>

### moduleMap.findDependencies(filepath) ⇒ <code>Set.&lt;string&gt;</code>

<p>Find all dependencies for <code>filepath</code>.</p>
<p>You probably don't need to call this directly.</p>

**Kind**: instance method of [<code>ModuleMap</code>](#ModuleMap)

| Param    | Type                |
| -------- | ------------------- |
| filepath | <code>string</code> |

<a name="ModuleMap+markFileAsChanged"></a>

### moduleMap.markFileAsChanged(filepath) ⇒ [<code>ModuleMap</code>](#ModuleMap)

<p>Marks a file as changed in-memory</p>

**Kind**: instance method of [<code>ModuleMap</code>](#ModuleMap)

| Param    | Type                | Description                     |
| -------- | ------------------- | ------------------------------- |
| filepath | <code>string</code> | <p>Filepath to mark changed</p> |

<a name="ModuleMap+findAffectedFiles"></a>

### moduleMap.findAffectedFiles(nodes) ⇒ <code>Object</code>

<p>Find affected files given a set of nodes</p>

**Kind**: instance method of [<code>ModuleMap</code>](#ModuleMap)

| Param | Type                                                     |
| ----- | -------------------------------------------------------- |
| nodes | [<code>Set.&lt;ModuleMapNode&gt;</code>](#ModuleMapNode) |

<a name="ModuleMap+findAffectedFilesForChangedFiles"></a>

### moduleMap.findAffectedFilesForChangedFiles([opts]) ⇒ <code>Object</code>

<p>Given a list of filenames which potentially have changed recently, find all files which depend upon these files</p>

**Kind**: instance method of [<code>ModuleMap</code>](#ModuleMap)  
**Returns**: <code>Object</code> - <p>Zero or more files impacted by a given change</p>

| Param  | Type                                                               |
| ------ | ------------------------------------------------------------------ |
| [opts] | [<code>FindAffectedFilesOptions</code>](#FindAffectedFilesOptions) |

<a name="ModuleMap+toJSON"></a>

### moduleMap.toJSON() ⇒ <code>Object.&lt;string, ModuleMapNodeJSON&gt;</code>

<p>Returns a stable object representation of this ModuleMap.
Keys (filenames) will be sorted; values (<code>ModuleMapNode</code>
instances) will be the result of calling [ModuleMapNode#toJSON()](ModuleMapNode#toJSON()) on each</p>

**Kind**: instance method of [<code>ModuleMap</code>](#ModuleMap)  
<a name="ModuleMap.create"></a>

### ModuleMap.create([opts])

<p>Create a new <code>ModuleMap</code> instance</p>

**Kind**: static method of [<code>ModuleMap</code>](#ModuleMap)

| Param  | Type                                                               | Description    |
| ------ | ------------------------------------------------------------------ | -------------- |
| [opts] | [<code>Partial.&lt;ModuleMapOptions&gt;</code>](#ModuleMapOptions) | <p>Options</p> |

<a name="constants"></a>

## constants : <code>object</code>

<p>Contains constants used across this package.</p>

**Kind**: global namespace

- [constants](#constants) : <code>object</code>
  - [.exports.DEFAULT_FILE_ENTRY_CACHE_FILENAME](#constants.exports.DEFAULT_FILE_ENTRY_CACHE_FILENAME)
  - [.exports.DEFAULT_MODULE_MAP_CACHE_FILENAME](#constants.exports.DEFAULT_MODULE_MAP_CACHE_FILENAME)

<a name="constants.exports.DEFAULT_FILE_ENTRY_CACHE_FILENAME"></a>

### constants.exports.DEFAULT_FILE_ENTRY_CACHE_FILENAME

<p>The default filename for the file entry cache.</p>

**Kind**: static property of [<code>constants</code>](#constants)  
<a name="constants.exports.DEFAULT_MODULE_MAP_CACHE_FILENAME"></a>

### constants.exports.DEFAULT_MODULE_MAP_CACHE_FILENAME

<p>The default filename for the module map cache.</p>

**Kind**: static property of [<code>constants</code>](#constants)  
<a name="resolveDependencies"></a>

## resolveDependencies(filepath, [opts]) ⇒ <code>Set.&lt;string&gt;</code>

<p>Given a path to a module, attempt to determine the paths to its dependencies.</p>
<ul>
<li>This function is used to determine which tests need re-running if a file changes</li>
<li>Does special handling of TypeScript sources and supports Webpack configurations</li>
</ul>

**Kind**: global function  
**Returns**: <code>Set.&lt;string&gt;</code> - <p>Dependency paths</p>  
**Access**: public

| Param    | Type                                                                                   | Description            |
| -------- | -------------------------------------------------------------------------------------- | ---------------------- |
| filepath | <code>string</code>                                                                    | <p>Module filepath</p> |
| [opts]   | [<code>Partial.&lt;ResolveDependenciesOptions&gt;</code>](#ResolveDependenciesOptions) | <p>Options</p>         |

<a name="FileEntryCacheOptions"></a>

## FileEntryCacheOptions : <code>Object</code>

<p>Options for [FileEntryCache](#FileEntryCache) constructor.</p>

**Kind**: global typedef  
**Properties**

| Name       | Type                | Description                                                                     |
| ---------- | ------------------- | ------------------------------------------------------------------------------- |
| [cacheDir] | <code>string</code> | <p>Explicit cache directory</p>                                                 |
| [filename] | <code>string</code> | <p>Filename for cache</p>                                                       |
| [cwd]      | <code>string</code> | <p>Current working directory; affects location of cache dir if not provided</p> |

<a name="ModuleMapCacheOptions"></a>

## ModuleMapCacheOptions : <code>Object</code>

<p>Options for [ModuleMapCache](#ModuleMapCache) constructor.</p>

**Kind**: global typedef  
**Properties**

| Name       | Type                | Description                                                                     |
| ---------- | ------------------- | ------------------------------------------------------------------------------- |
| [cacheDir] | <code>string</code> | <p>Explicit cache directory</p>                                                 |
| [filename] | <code>string</code> | <p>Filename for cache</p>                                                       |
| [cwd]      | <code>string</code> | <p>Current working directory; affects location of cache dir if not provided</p> |

<a name="ModuleMapNodeOptions"></a>

## ModuleMapNodeOptions : <code>Object</code>

<p>Options for [ModuleMapNode](#ModuleMapNode) constructor.</p>

**Kind**: global typedef  
**Properties**

| Name         | Type                            | Description                                    |
| ------------ | ------------------------------- | ---------------------------------------------- |
| [parents]    | <code>Set.&lt;string&gt;</code> | <p>List of parents (dependants), if any</p>    |
| [children]   | <code>Set.&lt;string&gt;</code> | <p>List of children (dependencies), if any</p> |
| [entryFiles] | <code>Set.&lt;string&gt;</code> | <p>List of associated test files</p>           |

<a name="ModuleMapNodeJSON"></a>

## ModuleMapNodeJSON : <code>Object</code>

<p>A representation of a [ModuleMapNode](#ModuleMapNode) suitable for JSON stringification.</p>

**Kind**: global typedef  
**Properties**

| Name       | Type                              | Description        |
| ---------- | --------------------------------- | ------------------ |
| filename   | <code>string</code>               | <p>Filename</p>    |
| entryFiles | <code>Array.&lt;string&gt;</code> | <p>Entry files</p> |
| children   | <code>Array.&lt;string&gt;</code> | <p>Children</p>    |
| parents    | <code>Array.&lt;string&gt;</code> | <p>Parents</p>     |

<a name="ModuleMapOptions"></a>

## ModuleMapOptions : <code>Object</code>

<p>Options for [ModuleMap](#ModuleMap)</p>

**Kind**: global typedef  
**Properties**

| Name                   | Type                                                                 | Description                                         |
| ---------------------- | -------------------------------------------------------------------- | --------------------------------------------------- |
| moduleMapCacheFilename | <code>string</code>                                                  | <p>Filename of on-disk module map cache</p>         |
| fileEntryCacheFilename | <code>string</code>                                                  | <p>Filename of on-disk file entry cache</p>         |
| cacheDir               | <code>string</code>                                                  | <p>Path to Mocha-specific cache directory</p>       |
| reset                  | <code>boolean</code>                                                 | <p>If <code>true</code>, will obliterate caches</p> |
| entryFiles             | <code>Array.&lt;string&gt;</code> \| <code>Set.&lt;string&gt;</code> | <p>List of test files</p>                           |
| ignore                 | <code>Array.&lt;string&gt;</code> \| <code>Set.&lt;string&gt;</code> | <p>List of ignored globs</p>                        |
| cwd                    | <code>string</code>                                                  | <p>Current working directory</p>                    |
| tsConfigPath           | <code>string</code>                                                  | <p>Path to TypeScript config file</p>               |
| webpackConfigPath      | <code>string</code>                                                  | <p>Path to Webpack config file</p>                  |

<a name="FindAffectedFilesOptions"></a>

## FindAffectedFilesOptions : <code>Object</code>

<p>Options for [findAffectedFiles](#ModuleMap+findAffectedFiles)</p>

**Kind**: global typedef  
**Properties**

| Name                | Type                                                                 | Description                                                       |
| ------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [knownChangedFiles] | <code>Set.&lt;string&gt;</code> \| <code>Array.&lt;string&gt;</code> | <p>A list of files to explicitly consider changed (as a hint)</p> |

<a name="InitOptions"></a>

## InitOptions : <code>Object</code>

<p>Options for [ModuleMap#init](ModuleMap#init)</p>

**Kind**: global typedef  
**Properties**

| Name    | Type                 | Description                                                                     |
| ------- | -------------------- | ------------------------------------------------------------------------------- |
| [reset] | <code>boolean</code> | <p>If <code>true</code> will obliterate caches</p>                              |
| [force] | <code>boolean</code> | <p>If <code>true</code>, force re-init. Normally should only be called once</p> |

<a name="MergeFromCacheOptions"></a>

## MergeFromCacheOptions : <code>Object</code>

<p>Options for [ModuleMapNode#mergeFromCache](ModuleMapNode#mergeFromCache).</p>

**Kind**: global typedef  
**Properties**

| Name        | Type                 | Description                                 |
| ----------- | -------------------- | ------------------------------------------- |
| destructive | <code>boolean</code> | <p>If true, destroy the in-memory cache</p> |

<a name="ResolveDependenciesOptions"></a>

## ResolveDependenciesOptions : <code>Object</code>

<p>Options for [resolveDependencies](#resolveDependencies)</p>

**Kind**: global typedef  
**Properties**

| Name              | Type                                                                                        | Description                                   |
| ----------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------- |
| cwd               | <code>string</code>                                                                         | <p>Current working directory</p>              |
| tsConfigPath      | <code>string</code>                                                                         | <p>Path to <code>tsconfig.json</code></p>     |
| webpackConfigPath | <code>string</code>                                                                         | <p>Path to <code>webpack.config.js</code></p> |
| ignore            | <code>Set.&lt;string&gt;</code> \| <code>Array.&lt;string&gt;</code> \| <code>string</code> | <p>Paths/globs to ignore</p>                  |
