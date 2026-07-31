import ts from "typescript";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";

const projectRoot = resolve(globalThis.process.argv[2] ?? ".");
const configPath = resolve(projectRoot, "tsconfig.json");

const timings = {};
const measure = (name, operation) => {
  const startedAt = performance.now();
  const result = operation();
  timings[name] = Number((performance.now() - startedAt).toFixed(2));
  return result;
};

const config = measure("readAndParseTsConfigMs", () => {
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, "\n"));
  return ts.parseJsonConfigFileContent(read.config, ts.sys, projectRoot);
});

const program = measure("createProgramMs", () =>
  ts.createProgram({ rootNames: config.fileNames, options: config.options }),
);
const checker = measure("getTypeCheckerMs", () => program.getTypeChecker());
const sourceFiles = measure("enumerateProgramSourceFilesMs", () =>
  program
    .getSourceFiles()
    .filter(
      (sourceFile) => !sourceFile.isDeclarationFile && sourceFile.fileName.startsWith(projectRoot),
    ),
);

const findDescendant = (node, predicate) => {
  let result;
  const visit = (current) => {
    if (result) return;
    if (predicate(current)) {
      result = current;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return result;
};

const declarationSummary = (declaration) => ({
  kind: declaration ? ts.SyntaxKind[declaration.kind] : undefined,
  name: declaration?.name?.getText(),
  file: declaration?.getSourceFile().fileName.replace(`${projectRoot}/`, ""),
  line: declaration
    ? declaration.getSourceFile().getLineAndCharacterOfPosition(declaration.getStart()).line + 1
    : undefined,
});

const symbolSummary = (identifier) => {
  const localSymbol = checker.getSymbolAtLocation(identifier);
  const originalSymbol =
    localSymbol && localSymbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(localSymbol)
      : localSymbol;
  return {
    identifier: identifier.getText(),
    localFlags: localSymbol?.flags,
    localDeclarations: localSymbol?.declarations?.map(declarationSummary) ?? [],
    originalDeclarations: originalSymbol?.declarations?.map(declarationSummary) ?? [],
  };
};

const renamedImport = measure("findRenamedImportMs", () => {
  for (const sourceFile of sourceFiles) {
    let match;
    const visit = (node) => {
      if (match) return;
      if (ts.isImportSpecifier(node) && node.propertyName) match = node;
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (match) {
      return {
        file: sourceFile.fileName.replace(`${projectRoot}/`, ""),
        imported: match.propertyName.getText(),
        local: match.name.getText(),
        resolution: symbolSummary(match.name),
      };
    }
  }
  return { found: false };
});

const homonymousFunctions = measure("findHomonymousFunctionsMs", () => {
  const functionsByName = new Map();
  for (const sourceFile of sourceFiles) {
    const visit = (node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const declarations = functionsByName.get(node.name.text) ?? [];
        declarations.push(node);
        functionsByName.set(node.name.text, declarations);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  const duplicate = [...functionsByName.entries()].find(
    ([, declarations]) => declarations.length > 1,
  );
  if (!duplicate) {
    const files = new Map([
      ["/virtual/social/send.ts", "export function send() { return 'social'; }"],
      ["/virtual/tickets/send.ts", "export function send() { return 'ticket'; }"],
      [
        "/virtual/listener.ts",
        "import { send } from './social/send'; export const selected = send;",
      ],
    ]);
    const virtualOptions = {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
    };
    const virtualHost = ts.createCompilerHost(virtualOptions);
    virtualHost.fileExists = (fileName) => files.has(fileName);
    virtualHost.readFile = (fileName) => files.get(fileName);
    virtualHost.getSourceFile = (fileName, languageVersion) => {
      const text = files.get(fileName);
      return text === undefined
        ? undefined
        : ts.createSourceFile(fileName, text, languageVersion, true);
    };
    virtualHost.resolveModuleNames = (moduleNames, containingFile) =>
      moduleNames.map((moduleName) => {
        if (containingFile === "/virtual/listener.ts" && moduleName === "./social/send") {
          return { resolvedFileName: "/virtual/social/send.ts", extension: ts.Extension.Ts };
        }
        return undefined;
      });
    const virtualProgram = ts.createProgram({
      rootNames: [...files.keys()],
      options: virtualOptions,
      host: virtualHost,
    });
    const virtualChecker = virtualProgram.getTypeChecker();
    const listenerFile = virtualProgram.getSourceFile("/virtual/listener.ts");
    const importedIdentifier =
      listenerFile &&
      findDescendant(
        listenerFile,
        (node) =>
          ts.isIdentifier(node) &&
          node.text === "send" &&
          ts.isVariableDeclaration(node.parent) &&
          node.parent.initializer === node,
      );
    const importedSymbol =
      importedIdentifier && virtualChecker.getSymbolAtLocation(importedIdentifier);
    const originalSymbol = importedSymbol && virtualChecker.getAliasedSymbol(importedSymbol);
    return {
      found: false,
      realProject: false,
      controlledFixture: {
        importedSymbol: originalSymbol?.name,
        declaration: originalSymbol?.declarations?.map((declaration) => ({
          name: declaration.name?.getText(),
          file: declaration.getSourceFile().fileName,
        })),
        note: "The real project had no duplicate function declarations; the controlled fixture verifies module identity disambiguation.",
      },
    };
  }
  const [name, declarations] = duplicate;
  return {
    name,
    declarations: declarations.map(declarationSummary),
    symbolDeclarations: declarations.map(
      (declaration) => symbolSummary(declaration.name).originalDeclarations,
    ),
  };
});

const externalResolution = measure("resolveLikeGatewayTypeMs", () => {
  const interfaceDeclaration = sourceFiles.flatMap((sourceFile) => {
    const matches = [];
    const visit = (node) => {
      if (ts.isInterfaceDeclaration(node) && node.name.text === "LikeWlGateway") matches.push(node);
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return matches;
  })[0];

  const retrievalFile = sourceFiles.find((sourceFile) =>
    sourceFile.fileName.endsWith("likeRetrieval.ts"),
  );
  const gatewayAccess =
    retrievalFile &&
    findDescendant(
      retrievalFile,
      (node) =>
        ts.isPropertyAccessExpression(node) &&
        node.name.text === "get" &&
        node.expression.getText() === "likeGateway",
    );
  if (!interfaceDeclaration || !gatewayAccess) return { found: false };

  const gatewayIdentifier = gatewayAccess.expression;
  const gatewayType = checker.getTypeAtLocation(gatewayIdentifier);
  const gatewaySymbol = gatewayType.getSymbol();
  const method = gatewayType.getProperty("get");
  return {
    sourceFile: retrievalFile.fileName.replace(`${projectRoot}/`, ""),
    expression: gatewayIdentifier.getText(),
    type: checker.typeToString(gatewayType),
    typeSymbol: gatewaySymbol?.name,
    typeDeclarations: gatewaySymbol?.declarations?.map(declarationSummary) ?? [],
    methodDeclarations: method?.declarations?.map(declarationSummary) ?? [],
    interfaceDeclaration: declarationSummary(interfaceDeclaration),
  };
});

const checkerQueries = measure("repeatSemanticQueriesMs", () => {
  let count = 0;
  for (const sourceFile of sourceFiles) {
    const visit = (node) => {
      if (ts.isIdentifier(node)) {
        checker.getSymbolAtLocation(node);
        count += 1;
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return count;
});

globalThis.console.log(
  JSON.stringify(
    {
      projectRoot,
      configFileCount: config.fileNames.length,
      sourceFileCount: sourceFiles.length,
      timings,
      renamedImport,
      homonymousFunctions,
      externalResolution,
      checkerQueries,
    },
    null,
    2,
  ),
);
