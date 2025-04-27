import { ScriptElementKind, SymbolDisplayPartKind } from "typescript";

const TABLE_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

function init(modules: {
  typescript: typeof import("typescript/lib/tsserverlibrary");
}) {
  const ts = modules.typescript;

  function create(info: ts.server.PluginCreateInfo) {
    // Set up language service proxy
    const proxy: ts.LanguageService = Object.create(null);
    for (let k of Object.keys(info.languageService) as Array<
      keyof ts.LanguageService
    >) {
      const x = info.languageService[k]!;
      // @ts-expect-error - JS runtime trickery which is tricky to type tersely
      proxy[k] = (...args: Array<{}>) => {
        //// For debugging:
        // info.project.projectService.logger.info(
        //   "CALLED:" + k + " ARGS " + JSON.stringify(args, null, 2),
        // );
        // @ts-expect-error - JS runtime trickery which is tricky to type tersely
        return x.apply(info.languageService, args);
      };
    }

    proxy.findReferences = (fileName, position) => {
      const builtin = info.languageService.findReferences(fileName, position);

      info.project.projectService.logger.info(JSON.stringify(builtin, null, 2));

      // This is not an identifier/field/etc.
      if (!builtin) return;

      const definitionAndReferences = builtin[0];
      const definition = definitionAndReferences.definition;

      const program = info.languageService.getProgram();
      if (!program) return;

      const convexMatch = getConvexTableDefinitionForIdentifier(
        program,
        definition.fileName,
        definition.textSpan.start,
        definition.textSpan.length,
      );

      if (!convexMatch) return builtin;

      const { tableName, tableDeclaration } = convexMatch;

      const matchingDefinition = builtin.find(
        ({ definition }) =>
          definition.fileName === tableDeclaration.getSourceFile().fileName &&
          definition.textSpan.start === tableDeclaration.getStart(),
      );

      if (!matchingDefinition) return builtin;

      // Now we need to go through all files in the project,
      // and find all the string literals that match the table name.
      // We'll then return the references for those.

      const files = program
        .getSourceFiles()
        .filter((file) => !file.isDeclarationFile);

      const additionalReferences: ts.ReferenceEntry[] = [];

      for (const file of files) {
        const fileReferences = findAllTableReferencesInFile(file, tableName);
        additionalReferences.push(
          ...fileReferences.map((node) => ({
            fileName: file.fileName,
            textSpan: {
              start: node.getStart() + 1,
              length: node.getWidth() - 2,
            },
            isWriteAccess: false,
            isDefinition: false,
            isInString: true as const,
          })),
        );
      }
      const references = definitionAndReferences.references;
      return [
        {
          definition,
          references: [...references, ...additionalReferences],
        },
        ...builtin.slice(1),
      ];
    };

    proxy.getDefinitionAndBoundSpan = (fileName, position) => {
      // Since we want to go to defintion for strings that match Convex table names,
      // and TS doesn't have any go to definition for string literals, we can bail
      // quickly without incurring perf hit for positions that do have a definition.
      const builtin = info.languageService.getDefinitionAndBoundSpan(
        fileName,
        position,
      );

      if (builtin) return builtin;

      const convexMatch = getConvexTableDefinitionForStringLiteral(
        fileName,
        position,
      );
      if (!convexMatch) return;

      const { textSpan, tableName, tableDeclaration } = convexMatch;

      return {
        textSpan,
        definitions: [
          {
            textSpan: {
              start: tableDeclaration.getStart(),
              length: tableDeclaration.getWidth(),
            },
            // No idea what this does
            contextSpan: {
              start: tableDeclaration.getStart(),
              length: tableDeclaration.getFullWidth(),
            },
            // No idea what this does
            containerKind: ScriptElementKind.primitiveType,
            // No idea what this does
            containerName: "__object",
            // No idea what this does
            name: tableName,
            // No idea what this does
            kind: ScriptElementKind.memberVariableElement,
            fileName: tableDeclaration.getSourceFile().fileName,
          },
        ],
      };
    };

    // Provides hover details in LSP.
    proxy.getQuickInfoAtPosition = (fileName, position) => {
      // Since we want to show hover for strings that match Convex table names,
      // and TS doesn't show anything for string literals, we can bail
      // quickly without incurring perf hit for positions that do have hover.
      const builtin = info.languageService.getQuickInfoAtPosition(
        fileName,
        position,
      );

      if (builtin) return builtin;

      const convexMatch = getConvexTableDefinitionForStringLiteral(
        fileName,
        position,
      );
      if (!convexMatch) return;

      const { textSpan, tableDeclaration } = convexMatch;

      return {
        kind: ScriptElementKind.string,
        kindModifiers: "",
        textSpan,
        displayParts: [
          //// Uncomment these to print the type instead of the declaration
          // ...(ts as any).typeToDisplayParts(
          //   typeChecker,
          //   tableType,
          //   (ts as any).getContainerNode(schemaDeclaration),
          // ),
          // {
          //   kind: SymbolDisplayPartKind.text.toString(),
          //   text: "\n",
          // },
          {
            kind: SymbolDisplayPartKind.text.toString(),
            text: trimIndent(tableDeclaration.getFullText() ?? ""),
          },
        ],
        // documentation: [
        //   {
        //     kind: SymbolDisplayPartKind.text.toString(),
        //     text: "",
        //   },
        // ],
      };
    };

    return proxy;

    function getConvexTableDefinitionForIdentifier(
      program: ts.Program,
      fileName: string,
      start: number,
      length: number,
    ) {
      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) return;

      const text = sourceFile.text;
      const identifier = text.slice(start, start + length);

      return getConvexTableDefinitionForName(program, identifier, start);
    }

    function getConvexTableDefinitionForStringLiteral(
      fileName: string,
      position: number,
    ) {
      const program = info.languageService.getProgram();
      if (!program) return;

      const sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) return;

      const node = findTokenAtPosition(sourceFile, position);
      if (!node) return;

      const isString =
        node.kind === ts.SyntaxKind.StringLiteral ||
        node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral;
      if (!isString) return;

      const stringNode = node;

      const stringContent = node.getText().slice(1, -1);

      return getConvexTableDefinitionForName(
        program,
        stringContent,
        stringNode.getStart() + 1,
      );
    }

    function getConvexTableDefinitionForName(
      program: ts.Program,
      tableName: string,
      start: number,
    ) {
      if (!TABLE_NAME_REGEX.test(tableName)) return;

      // TODO: We need to figure out where the schema is, and cache it
      const schemaFile = program.getSourceFile("schema.ts");
      if (!schemaFile) return;

      const schemaDeclaration = findDefaultExport(schemaFile);
      if (!schemaDeclaration) return;

      // `export default foo` => foo is at index 2
      const schema = schemaDeclaration.getChildAt(2);

      const typeChecker = program.getTypeChecker();

      const schemaType = typeChecker.getTypeAtLocation(schema);

      // (ts as any).getObjectFlags(schemaType) & ts.TypeReference
      const schemaObjectType = typeChecker.getTypeArguments(
        schemaType as ts.TypeReference,
      )[0];

      if (!schemaObjectType) return;

      const tableSymbol = typeChecker.getPropertyOfType(
        schemaObjectType,
        tableName,
      );

      if (!tableSymbol) return;

      //// Uncomment these to print the type instead of the declaration
      // const tableType = typeChecker.getTypeOfSymbolAtLocation(
      //   tableSymbol,
      //   schema,
      // );

      const tableDeclaration = tableSymbol?.valueDeclaration;
      if (!tableDeclaration) return;

      return {
        tableName,
        tableDeclaration,
        textSpan: { start, length: tableName.length },
        // tableType
      };
    }
  }

  return { create };

  function trimIndent(code: string) {
    const lines = code.split("\n");
    const startLineIndex = Math.max(
      lines.findIndex((line) => /[^\s]/.test(line)),
      0,
    );
    const indent = lines[startLineIndex].match(/^\s+/)?.[0] ?? "";
    const resultLines = lines
      .slice(startLineIndex)
      .map((line) =>
        line.startsWith(indent) ? line.slice(indent.length) : line,
      );
    return resultLines.join("\n");
  }

  function findDefaultExport(sourceFile: ts.SourceFile): ts.Node | undefined {
    return ts.forEachChild(sourceFile, (node) => {
      if (node.kind === ts.SyntaxKind.ExportAssignment) {
        return node;
      }
      return undefined;
    });
  }

  // Yep, TS really doesn't export anything like this.
  function findTokenAtPosition(
    sourceFile: ts.SourceFile,
    pos: number,
  ): ts.Node | undefined {
    let found: ts.Node | undefined;

    function visit(node: ts.Node) {
      if (pos >= node.getStart() && pos < node.getEnd()) {
        found = node;
        ts.forEachChild(node, visit);
      }
    }

    visit(sourceFile);
    return found;
  }

  function findAllTableReferencesInFile(
    sourceFile: ts.SourceFile,
    tableName: string,
  ): ts.Node[] {
    const found: ts.Node[] = [];

    function visit(node: ts.Node) {
      if (
        node.kind === ts.SyntaxKind.StringLiteral ||
        node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral
      ) {
        const content = node.getText().slice(1, -1);
        if (content === tableName) {
          found.push(node);
        }
      } else {
        ts.forEachChild(node, visit);
      }
    }

    visit(sourceFile);
    return found;
  }
}

// For some reason this syntax must be used!
export = init;
