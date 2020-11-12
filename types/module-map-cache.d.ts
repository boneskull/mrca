export type ModuleMapCacheOptions = {
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
export class ModuleMapCache {
    /**
     *
     * @param {ModuleMapCacheOptions} [opts]
     */
    static create(opts?: ModuleMapCacheOptions): ModuleMapCache;
    /**
     * Finds an appropriate cache dir (if necessary) and creates the cache on-disk.
     * @param {ModuleMapCacheOptions} [opts]
     */
    constructor({ cacheDir, filename, cwd, }?: ModuleMapCacheOptions);
    cwd: string;
    cacheDir: string;
    filename: string;
    cache: flatCache.Cache;
    /**
     * Full filepath of the cache on disk
     * @type {string}
     */
    get filepath(): string;
    /**
     * Persists the contents of a string-keyed `Map` to disk in cache
     * @todo Do we need to allow `noPrune` to be `false`?
     * @param {Map<string,any>} map - Map
     * @returns {ModuleMapCache}
     */
    save(map: Map<string, any>): ModuleMapCache;
    /**
     * Return a `Set` of all values contained in the cache.
     * @returns {Set<any>}
     */
    values(): Set<any>;
    reset(): ModuleMapCache;
}
import flatCache = require("flat-cache");
