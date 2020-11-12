/**
 * Options for {@link ModuleMapCache} constructor.
 */
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
/**
 * A wrapper around a `flat-cache` object keyed on filepath and containing
 * {@link ModuleMapNode} values. Essentially an on-disk representation of
 * a {@link ModuleMap}.
 *
 * You should not need to interface with this class directly.
 *
 * @see https://npm.im/flat-cache
 */
export class ModuleMapCache {
    /**
     * Constructs a {@link ModuleMapCache}.
     * @param {ModuleMapCacheOptions} [opts]
     * @returns {ModuleMapCache}
     */
    static create(opts?: ModuleMapCacheOptions): ModuleMapCache;
    /**
     * Finds an appropriate cache dir (if necessary) and creates the cache on-disk.
     * @param {ModuleMapCacheOptions} [opts]
     */
    constructor({ cacheDir, filename, cwd, }?: ModuleMapCacheOptions);
    /**
     * Current working directory
     * @type {string}
     */
    cwd: string;
    /**
     * @type {string}
     */
    cacheDir: string;
    /**
     * Filename of cache file
     * @type {string}
     */
    filename: string;
    /**
     * Underlying cache object
     * @type {import('flat-cache').Cache}
     */
    cache: import('flat-cache').Cache;
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
     * Return a `Set` of all _values_ contained in the cache.
     *
     * When consumed by {@link ModuleMap}, this is a `Set` of {@link ModuleMapNode} objects.
     * @returns {Set<any>}
     */
    values(): Set<any>;
    /**
     * Destroys the on-disk cache.
     * @returns {ModuleMapCache}
     */
    reset(): ModuleMapCache;
}
