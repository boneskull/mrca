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
export class ModuleMapNode {
    /**
     * @param {string} filename
     * @param {ModuleMapNodeOptions} [opts]
     */
    static create(filename: string, opts?: ModuleMapNodeOptions): ModuleMapNode;
    /**
     * Sets properties
     * @param {string} filename
     * @param {ModuleMapNodeOptions} opts
     */
    constructor(filename: string, { entryFiles, children, parents }?: ModuleMapNodeOptions);
    filename: string;
    entryFiles: Set<string>;
    parents: Set<string>;
    children: Set<string>;
    /**
     * @returns {ModuleMapNodeJSON}
     */
    toJSON(): ModuleMapNodeJSON;
    toString(): string;
}
