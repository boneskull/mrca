declare module "unexpected" {

  namespace unexpected {
    interface Expect {
      <A extends Array<unknown> = []>(
        subject: unknown,
        assertionName: string,
        ...args: A
      ): Expect & Promise<void>;

      clone(): this;

      addAssertion<T, A extends Array<unknown> = []>(
        pattern: string,
        handler: (expect: Expect, subject: T, ...args: A) => void
      ): this;

      addType<T>(typeDefinition: unexpected.TypeDefinition<T>): this;

      fail<A extends Array<unknown> = []>(format: string, ...args: A): void;
      fail<E extends Error>(error: E): void;

      freeze(): this;

      use(plugin: unexpected.PluginDefinition): this;

      it<A extends Array<unknown> = []>(assertionName: string, ...args: A): Expect & Promise<void>;

      and<A extends Array<unknown> = []>(assertionName: string, ...args: A): Expect & Promise<void>;

      errorMode: string;

      shift(subject: any): void;
    }

    interface PluginDefinition {
      name?: string;
      version?: string;
      dependencies?: Array<string>;
      installInto(expect: Expect): void;
    }

    interface TypeDefinition<T> {
      name: string;
      identify(value: unknown): value is T;
      base?: string;
      equal?(a: T, b: T, equal: (a: unknown, b: unknown) => boolean): boolean;
      inspect?(
        value: T,
        depth: number,
      ): void;
    }
  }

  const unexpected: unexpected.Expect;

  export = unexpected;
}
