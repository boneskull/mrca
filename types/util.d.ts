export function findCacheDir({ dir, cwd }?: FindCacheDirOptions): string;
export type FindCacheDirOptions = {
    /**
     * - Explicit dir; will be created if necessary
     */
    dir?: string;
    /**
     * - Current working directory
     */
    cwd?: string;
};
