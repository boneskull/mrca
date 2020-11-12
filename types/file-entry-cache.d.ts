/**
 * Options for {@link FileEntryCache} constructor.
 */
export type FileEntryCacheOptions = {
    /**
     * - Explicit cache directory
     */
    cacheDir?: string;
    /**
     * - Filename for cache
     */
    filename?: string;
    /**
     * - Current working directory; affects location of cache dir if not provided
     */
    cwd?: string;
};
/**
 * A wrapper around the `file-entry-cache` module.
 *
 * You should not need to interface directly with this class.
 *
 * @see https://npm.im/file-entry-cache
 */
export class FileEntryCache {
    /**
     * Creates a {@link FileEntryCache}.
     * @param {FileEntryCacheOptions} [opts]
     * @returns {FileEntryCache}
     */
    static create(opts?: FileEntryCacheOptions): FileEntryCache;
    /**
     * Finds an appropriate cache dir (if necessary) and creates the cache on-disk.
     * @param {FileEntryCacheOptions} [opts]
     */
    constructor({ cacheDir, filename, cwd, }?: FileEntryCacheOptions);
    cwd: string;
    cacheDir: string;
    filename: string;
    cache: fileEntryCache.FileEntryCache;
    /**
     * Full filepath of the cache on disk
     * @type {string}
     */
    get filepath(): string;
    /**
     * Persists file entry cache to disk
     * @todo Do we need to allow `noPrune` to be `false`?
     * @param {Map<string,any>} map - Map
     * @returns {FileEntryCache}
     */
    save(map: Map<string, any>): FileEntryCache;
    /**
     * Returns `true` if a filepath has changed since we last called {@link FileEntryCache#save}.
     * @param {string} filepath - Absolute path
     * @returns {boolean}
     */
    hasFileChanged(filepath: string): boolean;
    /**
     * Marks a filepath as "changed" by removing it from the underlying cache.
     * @param {string} filepath - Absolute path of file to remove from the underlying cache
     */
    markFileChanged(filepath: string): FileEntryCache;
    /**
     * Returns a `Set` of changed files based on keys of the provided `Map`.
     * If no filepaths provided, returns list of all _known_ changed files.
     * Resets the state of all files to "not changed" until this method is run again
     * by calling {@link FileEntryCache#save}.
     * @param {Map<string,any>} map - Map containing keys corresponding to filepaths
     * @returns {Set<string>} Changed filepaths
     */
    yieldChangedFiles(map: Map<string, any>): Set<string>;
    /**
     * Destroys the underlying cache.
     * @returns {FileEntryCache}
     */
    reset(): FileEntryCache;
}
import fileEntryCache = require("file-entry-cache");
