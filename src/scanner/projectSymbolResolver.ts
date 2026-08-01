import * as ts from "typescript";
import { performance } from "node:perf_hooks";

import { buildSemanticIndex, type SemanticIndex } from "./semanticIndex.js";

export type TypeScriptSource = {
  file: string;
  source: string;
};

export type ScanPhase =
  | "compiler-context"
  | "event-identities"
  | "semantic-index"
  | "import-bindings"
  | "state-discovery"
  | "discovery-pass"
  | "relationship-external-detection"
  | "relationship-event-detection"
  | "relationship-listener-detection"
  | "relationship-state-detection"
  | "relationship-pass";

export type ScanPhaseMeasurement = {
  phase: ScanPhase;
  durationMs: number;
};

export type TypeScriptProject = {
  files: TypeScriptSource[];
  projectFiles?: TypeScriptSource[];
  onSemanticIndexBuilt?: (index: SemanticIndex) => void;
  onScanPhase?: (measurement: ScanPhaseMeasurement) => void;
  tsconfig?: {
    compilerOptions?: {
      baseUrl?: string;
      paths?: Record<string, string[]>;
    };
  };
};

const getProjectFiles = (project: TypeScriptProject): TypeScriptSource[] =>
  project.projectFiles ?? project.files;

const measurePhase = <T>(project: TypeScriptProject, phase: ScanPhase, operation: () => T): T => {
  const startedAt = performance.now();
  try {
    return operation();
  } finally {
    project.onScanPhase?.({ phase, durationMs: performance.now() - startedAt });
  }
};

export type SymbolBindings = ReadonlyMap<string, string>;
export type EventIds = ReadonlyMap<string, string>;

export type ProjectSymbolResolution = {
  eventIds: EventIds;
  bindingsByFile: ReadonlyMap<string, SymbolBindings>;
  sourceFiles: readonly ProjectSourceFile[];
  semanticIndex: SemanticIndex;
  program: ts.Program;
  checker: ts.TypeChecker;
};

export type ProjectSourceFile = {
  file: string;
  sourceFile: ts.SourceFile;
};

type VariableCall = {
  id: string;
  call: ts.CallExpression;
};

type CompilerContext = {
  program: ts.Program;
  checker: ts.TypeChecker;
  sourceFiles: readonly ProjectSourceFile[];
};

const getVariableCall = (node: ts.Node): VariableCall | undefined => {
  if (
    !ts.isVariableDeclaration(node) ||
    !ts.isIdentifier(node.name) ||
    !node.initializer ||
    !ts.isCallExpression(node.initializer)
  ) {
    return undefined;
  }

  return { id: node.name.text, call: node.initializer };
};

const normalizePath = (file: string): string => {
  const parts: string[] = [];

  for (const part of file.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      parts.pop();
      continue;
    }
    parts.push(part);
  }

  return parts.join("/");
};

const dirname = (file: string): string => {
  const separator = file.lastIndexOf("/");
  return separator === -1 ? "" : file.slice(0, separator);
};

const resolveFile = (candidate: string, files: ReadonlySet<string>): string | undefined => {
  const normalized = normalizePath(candidate);
  const candidates = [normalized, `${normalized}.ts`, `${normalized}/index.ts`];
  return candidates.find((file) => files.has(file));
};

type ImportFileResolver = (importer: string, moduleSpecifier: string) => string | undefined;

const createImportFileResolver = (project: TypeScriptProject): ImportFileResolver => {
  const files = new Set(getProjectFiles(project).map((file) => normalizePath(file.file)));
  const paths = project.tsconfig?.compilerOptions?.paths ?? {};
  const baseUrl = project.tsconfig?.compilerOptions?.baseUrl ?? ".";

  return (importer, moduleSpecifier) => {
    for (const [pattern, replacements] of Object.entries(paths)) {
      const wildcard = pattern.indexOf("*");
      const prefix = wildcard === -1 ? pattern : pattern.slice(0, wildcard);
      const replacement = replacements[0];
      if (!moduleSpecifier.startsWith(prefix) || !replacement) continue;

      const suffix = wildcard === -1 ? "" : moduleSpecifier.slice(wildcard);
      return resolveFile(`${baseUrl}/${replacement.replace("*", suffix)}`, files);
    }

    if (moduleSpecifier.startsWith(".")) {
      return resolveFile(`${dirname(importer)}/${moduleSpecifier}`, files);
    }

    return undefined;
  };
};

const createCompilerContext = (project: TypeScriptProject): CompilerContext => {
  const projectFiles = getProjectFiles(project);
  const sourcesByPath = new Map(
    projectFiles.map(({ file, source }) => [normalizePath(file), source]),
  );
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    ...(project.tsconfig?.compilerOptions?.baseUrl
      ? { baseUrl: project.tsconfig.compilerOptions.baseUrl }
      : {}),
    ...(project.tsconfig?.compilerOptions?.paths
      ? { paths: project.tsconfig.compilerOptions.paths }
      : {}),
  };
  const defaultHost = ts.createCompilerHost(options, true);
  const resolveSourcePath = (fileName: string): string | undefined => {
    const normalized = normalizePath(fileName);
    return sourcesByPath.has(normalized) ? normalized : undefined;
  };

  const host: ts.CompilerHost = {
    ...defaultHost,
    fileExists: (fileName) =>
      resolveSourcePath(fileName) !== undefined || defaultHost.fileExists(fileName),
    readFile: (fileName) => {
      const sourcePath = resolveSourcePath(fileName);
      return sourcePath ? sourcesByPath.get(sourcePath) : defaultHost.readFile(fileName);
    },
    getSourceFile: (fileName, languageVersion) => {
      const sourcePath = resolveSourcePath(fileName);
      const source = sourcePath ? sourcesByPath.get(sourcePath) : undefined;
      if (source !== undefined) {
        return ts.createSourceFile(fileName, source, languageVersion, true, ts.ScriptKind.TS);
      }
      return defaultHost.getSourceFile(fileName, languageVersion);
    },
    resolveModuleNames: (moduleNames, containingFile) =>
      moduleNames.map((moduleName) => {
        const result = ts.resolveModuleName(
          moduleName,
          containingFile,
          options,
          host,
        ).resolvedModule;
        return result;
      }),
  };
  const program = ts.createProgram({
    rootNames: projectFiles.map(({ file }) => file),
    options,
    host,
  });
  const sourceFiles = projectFiles
    .map(({ file }) => ({
      file,
      sourceFile: program.getSourceFile(file) ?? host.getSourceFile(file, ts.ScriptTarget.Latest),
    }))
    .filter((entry): entry is ProjectSourceFile => entry.sourceFile !== undefined);

  return { program, checker: program.getTypeChecker(), sourceFiles };
};

const getProjectEventIds = (files: readonly ProjectSourceFile[]): Map<string, string> => {
  const occurrences = new Map<string, number>();
  const declarations: Array<{ file: string; name: string }> = [];

  for (const { file, sourceFile } of files) {
    const visit = (node: ts.Node): void => {
      const variableCall = getVariableCall(node);
      if (
        variableCall &&
        ts.isIdentifier(variableCall.call.expression) &&
        variableCall.call.expression.text === "createAction"
      ) {
        declarations.push({ file: normalizePath(file), name: variableCall.id });
        occurrences.set(variableCall.id, (occurrences.get(variableCall.id) ?? 0) + 1);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  const eventIds = new Map<string, string>();
  for (const declaration of declarations) {
    const key = `${declaration.file}#${declaration.name}`;
    eventIds.set(key, occurrences.get(declaration.name) === 1 ? declaration.name : key);
  }
  return eventIds;
};

const getSymbolBindings = (
  file: TypeScriptSource,
  sourceFile: ts.SourceFile,
  resolveImportFile: ImportFileResolver,
  eventIds: EventIds,
  checker: ts.TypeChecker,
  sourceFilePaths: ReadonlyMap<ts.SourceFile, string>,
): Map<string, string> => {
  const bindings = new Map<string, string>();

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !statement.importClause ||
      !statement.importClause.namedBindings ||
      !ts.isNamedImports(statement.importClause.namedBindings) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      continue;
    }

    const importedFile = resolveImportFile(file.file, statement.moduleSpecifier.text);
    for (const element of statement.importClause.namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      const importedSymbol = checker.getSymbolAtLocation(element.name);
      const originalSymbol =
        importedSymbol && (importedSymbol.flags & ts.SymbolFlags.Alias) !== 0
          ? checker.getAliasedSymbol(importedSymbol)
          : importedSymbol;
      const declaration = originalSymbol?.declarations?.find(
        (candidate) =>
          ts.isVariableDeclaration(candidate) &&
          ts.isIdentifier(candidate.name) &&
          eventIds.has(
            `${normalizePath(sourceFilePaths.get(candidate.getSourceFile()) ?? candidate.getSourceFile().fileName)}#${candidate.name.text}`,
          ),
      );
      const checkerImportedId =
        declaration && ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name)
          ? eventIds.get(
              `${normalizePath(sourceFilePaths.get(declaration.getSourceFile()) ?? declaration.getSourceFile().fileName)}#${declaration.name.text}`,
            )
          : undefined;
      const importedId = importedFile
        ? eventIds.get(`${normalizePath(importedFile)}#${importedName}`)
        : undefined;
      bindings.set(element.name.text, checkerImportedId ?? importedId ?? importedName);
    }
  }

  return bindings;
};

export const resolveProjectSymbols = (project: TypeScriptProject): ProjectSymbolResolution => {
  const compilerContext = measurePhase(project, "compiler-context", () =>
    createCompilerContext(project),
  );
  const sourceFiles = compilerContext.sourceFiles;
  const eventIds = measurePhase(project, "event-identities", () => getProjectEventIds(sourceFiles));
  const semanticIndex = measurePhase(project, "semantic-index", () =>
    buildSemanticIndex(sourceFiles, compilerContext.checker),
  );
  project.onSemanticIndexBuilt?.(semanticIndex);
  const sourceFilesByPath = new Map(
    sourceFiles.map((source) => [normalizePath(source.file), source]),
  );
  const sourceFilePaths = new Map(
    sourceFiles.map((source) => [source.sourceFile, normalizePath(source.file)]),
  );
  const bindingsByFile = new Map<string, SymbolBindings>();
  const resolveImportFile = createImportFileResolver(project);

  measurePhase(project, "import-bindings", () => {
    for (const file of project.files) {
      const sourceFile = sourceFilesByPath.get(normalizePath(file.file))?.sourceFile;
      if (!sourceFile) continue;
      bindingsByFile.set(
        file.file,
        getSymbolBindings(
          file,
          sourceFile,
          resolveImportFile,
          eventIds,
          compilerContext.checker,
          sourceFilePaths,
        ),
      );
    }
  });

  return {
    eventIds,
    bindingsByFile,
    sourceFiles,
    semanticIndex,
    program: compilerContext.program,
    checker: compilerContext.checker,
  };
};
