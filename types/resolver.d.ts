export namespace constants {
    const DEFAULT_WEBPACK_CONFIG_FILENAME: string;
    const DEFAULT_TS_CONFIG_FILENAME: string;
}
export function resolveDependencies(filepath: string, { cwd, tsConfigPath, webpackConfigPath, ignore }?: Partial<ResolveDependenciesOptions>): Set<string>;
/**
 * Options for {@link resolveDependencies}
 */
export type ResolveDependenciesOptions = {
    /**
     * - Current working directory
     */
    cwd: string;
    /**
     * - Path to `tsconfig.json`
     */
    tsConfigPath: string;
    /**
     * - Path to `webpack.config.js`
     */
    webpackConfigPath: string;
    /**
     * - Paths/globs to ignore
     */
    ignore: Set<string> | string[] | string;
};
/**
 * Options for `tryFindWebpackConfigPath`
 */
export type ConfigureFilingCabinetForJSOptions = {
    /**
     * - Current working directory
     */
    cwd: string;
    /**
     * - Path to webpack config
     */
    webpackConfigPath: string;
};
/**
 * Options for {@link configureFilingCabinetForTS}
 */
export type ConfigureFilingCabinetForTSOptions = {
    /**
     * - Current working directory
     */
    cwd: string;
    /**
     * - Path to TS config
     */
    tsConfigPath: string;
};
