#### Get Started

Get the plugin working and your TS to JS converted as you save:

```sh
git clone https://github.com/xixixao/convex-typescript-plugin
cd convex-typescript-plugin

# Install deps and run TypeScript
npm i
npx tsc --watch
```

Next, get the example project up and running, it will load your TSServer Plugin
from the emitted JavaScript.

```sh
# Set up the host app to work in
cd example
npm i
cd ..

# Open one VS Code window to work on your plugin
code .

# Then run another VS Code window to work on the example:
TSS_DEBUG=9559 code example

# or use this to hook wait for the debugger to attach:
TSS_DEBUG_BRK=9559 code example
```

In the second VS Code window, you need to open a TypeScript file, and you need
to select the local version of TypeScript (click on the `{}` button in the
button bar, then `Select Version`).

Now the plugin should be loaded already.

You can then use the launch options in this root project to connect your
debugger to the running TSServer in the other window. To see changes, run the
command palette "TypeScript: Reload Project" to restart the TSServer for the
project.

You can see the logs via the vscode command 'TypeScript: Open TS Server Logs." (
search for 'Loading tsserver-plugin' to see whether it loaded correctly. )

### What Now?

You can place `debugger` statements inside the implementation which will trigger
when you use the features in VS Code.

You can read up the docs on
[Language Service Plugins in the TypeScript repo wiki](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin#overview-writing-a-simple-plugin).
