# Convex TypeScript Plugin

A [TypeScript](https://www.typescriptlang.org/) plugin for working with
[Convex](https://docs.convex.dev/), enabling extra features in IDEs like
[VS Code](https://code.visualstudio.com/) and [Cursor](https://www.cursor.com/).

## Features

### Go to definition

Click on a table name to jump to its definition in your Convex schema:

```ts
export const listTasks = query({
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    // cmd+click or ctrl+click here     ^     to go the schema
  },
});
```

### Hover

Hover over a table name to see the table's definition.

### Find all references

Click on the table name in your schema definition to see all places it is used
(its references).

```ts
export default defineSchema({
  messages: defineTable({
    body: v.string(),
    // ^ here cmd+click or ctrl+click to see all references
  }),
});
```

## Install

```sh
npm install @xixixao/convex-typescript-plugin
```

Add this configuration to your `tsconfig.json`'s `compilerOptions`:

```json
{
  "compilerOptions": {
    // ...
    "plugins": [{ "name": "@xixixao/convex-typescript-plugin" }]
    //...
  }
}
```

The `tsconfig.json` can be inside the `convex` folder or above it.

## Limitations

### Table names use-sites

Since table names are just strings, and can be passed around, the plugin is
optimistic: If you click on a string and it matches the name of one of your
tables, it will be assumed to be a table name, even if it's just a coincidence.

This is also true for finding the references, so this can show places where
you're not using the string as a name of a table.

### Ways of defining the schema

All typical ways of defining the schema are supported. As long as TypeScript can
infer the table names, you're good.

[Ents](https://github.com/get-convex/convex-ents) schemas are also supported.

## Troubleshooting

Remember that all intellisense features work off of unsaved file state, while
your running Convex backend will use the deployed (previously saved) schema.

## Details

Ideally we wouldn't need this plugin. The functionality could be supported
directly, and better, by the TypeScript language server itself. But this is
unlikely to happen any time soon, see:
https://github.com/microsoft/TypeScript/issues/49033.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
