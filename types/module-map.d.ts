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
 * Options for {@link ModuleMapNode#mergeFromCache}.
 */
export type MergeFromCacheOptions = {
    /**
     * - If true, destroy the in-memory cache
     */
    destructive: boolean;
};
/**
 * A very fancy `Map` which provides high-level information about dependency trees and file changes therein.
 *
 * This class is the main point of entry for this package; use {@link ModuleMap.create} to get going.
 * @extends {Map<string,ModuleMapNode>}
 */
export class ModuleMap extends Map<string, ModuleMapNode> {
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
    /**
     * Current working directory
     * @type {string}
     */
    cwd: string;
    /**
     * Directory containing cache files
     * @type {string}
     */
    cacheDir: string;
    /**
     * Cache of the module map (cache of dep tree)
     * @type {ModuleMapCache}
     */
    moduleMapCache: ModuleMapCache;
    /**
     * Cache of the file entry cache (tracks changes)
     * @type {FileEntryCache}
     */
    fileEntryCache: FileEntryCache;
    /**
     * List of entry files (top-level files)
     * @type {Set<string>}
     */
    entryFiles: Set<string>;
    /**
     * Globs to ignore
     * @type {Set<string>}
     */
    ignore: Set<string>;
    /**
     * Path to TypeScript config file, if any
     * @type {string?}
     */
    tsConfigPath: string | null;
    /**
     * Path to Webpack config file, if any
     * @type {string?}
     */
    webpackConfigPath: string | null;
    /**
     * Set to `true` after {@link ModuleMap#_init} has been called successfully.
     * @ignore
     */
    _initialized: boolean;
    /**
     * Like `Map#keys()` (for our purposes) but returns a `Set` instead.
     * @type {Set<string>}
     */
    get files(): Set<string>;
    /**
     * Returns a list of unique directories of all files
     * @type {Set<string>}
     */
    get directories(): Set<string>;
    /**
     * Returns a list of unique directories of all entry files
     * @type {Set<string>}
     */
    get entryDirectories(): Set<string>;
    /**
     * Returns a set of changed files
     * @ignore
     * @returns {Set<string>}
     */
    _yieldChangedFiles(): Set<string>;
    /**
     * Initializes map from cache on disk.  Should only be called once, by constructor.
     * Re-populates map from entry files
     * Persists caches
     * @param {InitOptions} [opts] - Init options
     * @ignore
     * @returns {ModuleMap}
     */
    _init({ reset, force }?: InitOptions): ModuleMap;
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
     * @returns {ModuleMap}
     */
    addEntryFile(filepath: string): ModuleMap;
    /**
     * Syncs module map cache _from_ disk
     * @param {Partial<MergeFromCacheOptions>} [opts] - Options
     * @returns {ModuleMap}
     */
    mergeFromCache({ destructive }?: Partial<MergeFromCacheOptions>): ModuleMap;
    /**
     * Given one or more `ModuleMapNode`s, find dependencies and add them to the map.
     * @ignore
     * @param {Set<ModuleMapNode>|ModuleMapNode[]} nodes - One or more module nodes to find dependencies for
     */
    _populate(nodes: Set<ModuleMapNode> | ModuleMapNode[], { force }?: {
        force?: boolean;
    }): void;
    /**
     * Find all dependencies for `filepath`.
     *
     * You probably don't need to call this directly.
     * @param {string} filepath
     * @returns {Set<string>}
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
     * @returns {Object<string,ModuleMapNodeJSON>}
     */
    toJSON(): {
        [x: string]: ModuleMapNodeJSON;
    };
}
import { ModuleMapNode } from "./module-map-node";
import { ModuleMapCache } from "./module-map-cache";
import { FileEntryCache } from "./file-entry-cache";
