/**
 * Options for {@link ModuleMap}
 */
export type ModuleMapOptions = {
    /**
     * - Filename of on-disk module map cache
     */
    moduleMapCacheFilename: string;
    /**
     * - Filename of on-disk file entry cache
     */
    fileEntryCacheFilename: string;
    /**
     * - Path to Mocha-specific cache directory
     */
    cacheDir: string;
    /**
     * - If `true`, will obliterate caches
     */
    reset: boolean;
    /**
     * - List of test files
     */
    entryFiles: string[] | Set<string>;
    /**
     * - List of ignored globs
     */
    ignore: string[] | Set<string>;
    /**
     * - Current working directory
     */
    cwd: string;
    /**
     * - Path to TypeScript config file
     */
    tsConfigPath: string;
    /**
     * - Path to Webpack config file
     */
    webpackConfigPath: string;
};
/**
 * Options for {@link ModuleMap#findAffectedFiles}
 */
export type FindAffectedFilesOptions = {
    /**
     * - A list of files to explicitly consider changed (as a hint)
     */
    knownChangedFiles?: Set<string> | Array<string>;
};
/**
 * Options for {@link ModuleMap#init}
 */
export type InitOptions = {
    /**
     * - If `true` will obliterate caches
     */
    reset?: boolean;
    /**
     * - If `true`, force re-init. Normally should only be called once
     */
    force?: boolean;
};
export type ModuleMapNodeJSON = {
    /**
     * - Filename
     */
    filename: string;
    /**
     * - Entry files
     */
    entryFiles: string[];
    /**
     * - Children
     */
    children: string[];
    /**
     * - Parents
     */
    parents: string[];
};
/**
 * A map to track files and their dependencies
 * @type {Map<string,ModuleMapNode>}
 * @public
 */
export class ModuleMap extends Map<any, any> {
    /**
     * Create a new `ModuleMap` instance
     * @param {Partial<ModuleMapOptions>} [opts] - Options
     */
    static create(opts?: Partial<ModuleMapOptions>): ModuleMap;
    /**
     * Initializes cache, map, loads from disk, finds deps, etc.
     * Cannot be instantiated like a normal map.
     * @param {Partial<ModuleMapOptions>} opts
     */
    constructor({ moduleMapCacheFilename, fileEntryCacheFilename, cacheDir, reset, entryFiles, ignore, cwd, tsConfigPath, webpackConfigPath, }?: Partial<ModuleMapOptions>);
    set cwd(arg: string);
    /**
     * @type {string}
     */
    get cwd(): string;
    cacheDir: string;
    moduleMapCache: ModuleMapCache;
    fileEntryCache: FileEntryCache;
    entryFiles: Set<string>;
    ignore: Set<string>;
    tsConfigPath: string;
    webpackConfigPath: string;
    _initialized: boolean;
    _cwd: string;
    /**
     * Like `Map#keys()` (for our purposes) but returns a `Set` instead.
     * @type {Set<string>}
     */
    get files(): Set<string>;
    /**
     * Returns a `Set` of directories of files
     * @type {Set<string>}
     */
    get directories(): Set<string>;
    get entryDirectories(): Set<any>;
    _yieldChangedFiles(): Set<string>;
    /**
     * Initializes map from cache on disk.  Should only be called once, by constructor.
     * Re-populates map from entry files
     * Persists caches
     * @param {InitOptions} [opts] - Init options
     */
    init({ reset, force }?: InitOptions): ModuleMap;
    /**
     * Persists both the module map cache and file entry cache.
     * @returns {ModuleMap}
     */
    save(): ModuleMap;
    /**
     * Returns `true` if `filename` is an entry file.
     * If a relative path is provided, it's resolved from `this.cwd`.
     * @param {string} filename
     * @returns {boolean}
     */
    isEntryFile(filename: string): boolean;
    /**
     * Return a `Set<ModuleMapNode>` for the list of filenames provided.
     * Filenames not appearing in this map will not be included--in other words,
     * the `size` of the returned value may be less than the `size`/`length` of the `filenames` parameter.
     * @param {string[]|Set<string>} [filenames] - List of filenames
     * @returns {Set<ModuleMapNode>}
     */
    getAll(filenames?: string[] | Set<string>): Set<ModuleMapNode>;
    /**
     * Adds an entry file to the map, and populates its dependences
     * @param {string} filepath
     */
    addEntryFile(filepath: string): void;
    /**
     * Syncs module map cache _from_ disk
     * @param {{destructive?: boolean}} param0
     */
    mergeFromCache({ destructive }?: {
        destructive?: boolean;
    }): ModuleMap;
    /**
     * Given one or more `ModuleMapNode`s, find dependencies and add them to the map.
     * @param {Set<ModuleMapNode>} nodes - One or more module nodes to find dependencies for
     */
    _populate(nodes: Set<ModuleMapNode>, { force }?: {
        force?: boolean;
    }): void;
    /**
     * Find all dependencies for `filepath`
     * @param {string} filepath
     */
    findDependencies(filepath: string): Set<string>;
    /**
     * Marks a file as changed in-memory
     * @param {string} filepath - Filepath to mark changed
     * @returns {ModuleMap}
     */
    markFileAsChanged(filepath: string): ModuleMap;
    /**
     * Find affected files given a set of nodes
     * @param {Set<ModuleMapNode>} nodes
     * @returns {{allFiles: Set<string>, entryFiles: Set<string>}}
     */
    findAffectedFiles(nodes: Set<ModuleMapNode>): {
        allFiles: Set<string>;
        entryFiles: Set<string>;
    };
    /**
     * Given a list of filenames which potentially have changed recently, find all files which depend upon these files
     * @param {FindAffectedFilesOptions} [opts]
     * @returns {{entryFiles: Set<string>, allFiles: Set<string>}} Zero or more files impacted by a given change
     */
    findAffectedFilesForChangedFiles({ knownChangedFiles }?: FindAffectedFilesOptions): {
        entryFiles: Set<string>;
        allFiles: Set<string>;
    };
    /**
     * Returns a stable object representation of this ModuleMap.
     * Keys (filenames) will be sorted; values (`ModuleMapNode`
     * instances) will be the result of calling {@link ModuleMapNode#toJSON()} on each
     * @returns {{[key: string]: ModuleMapNodeJSON}}
     */
    toJSON(): {
        [key: string]: import("./module-map-node").ModuleMapNodeJSON;
    };
}
import { ModuleMapCache } from "./module-map-cache";
import { FileEntryCache } from "./file-entry-cache";
import { ModuleMapNode } from "./module-map-node";
