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
export class FileEntryCache {
    /**
     *
     * @param {FileEntryCacheOptions} [opts]
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
     *
     * @param {string} filepath - Filename
     * @returns {boolean}
     */
    hasFileChanged(filepath: string): boolean;
    markFileChanged(filepath: any): FileEntryCache;
    /**
     * Returns a `Set` of changed files out of those provided.
     * If no filepaths provided, returns list of all _known_ changed files.
     * Resets the state of all files to "not changed" until this method is run again.
     * @param {Map<string,any>} map - Map containing keys corresponding to filepaths
     * @returns {Set<string>} Changed filepaths
     */
    yieldChangedFiles(map: Map<string, any>): Set<string>;
    reset(): FileEntryCache;
}
import fileEntryCache = require("file-entry-cache");
