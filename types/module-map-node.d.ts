/**
 * Options for {@link ModuleMapNode} constructor.
 */
export type ModuleMapNodeOptions = {
    /**
     * - List of parents (dependants), if any
     */
    parents?: Set<string>;
    /**
     * - List of children (dependencies), if any
     */
    children?: Set<string>;
    /**
     * - List of associated test files
     */
    entryFiles?: Set<string>;
};
/**
 * A representation of a {@link ModuleMapNode} suitable for JSON stringification.
 */
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
 * Class used internally by {@link ModuleMap} which tracks the relationship between parents and children.
 *
 * All "references" are by filename (string); there are no references to other {@link ModuleMap}s.
 *
 * You should not need to create one of these; {@link ModuleMap} will do it for you.
 */
export class ModuleMapNode {
    /**
     * Creates a {@link ModuleMapNode}, saving you from the horror of the `new` keyword.
     * @param {string} filepath
     * @param {ModuleMapNodeOptions} [opts]
     * @returns {ModuleMapNode}
     */
    static create(filepath: string, opts?: ModuleMapNodeOptions): ModuleMapNode;
    /**
     * Just sets some properties, folks.
     * @param {string} filepath - Absolute filepath. May not point to a "module" per se, but some other file.
     * @param {ModuleMapNodeOptions} opts
     */
    constructor(filepath: string, { entryFiles, children, parents }?: ModuleMapNodeOptions);
    filename: string;
    entryFiles: Set<string>;
    parents: Set<string>;
    children: Set<string>;
    /**
     * Returns an object suitable for JSON stringification
     * @returns {ModuleMapNodeJSON}
     */
    toJSON(): ModuleMapNodeJSON;
    /**
     * Returns the JSON-stringified representation of this `ModuleMapNode`.
     * @returns {string}
     */
    toString(): string;
}
