import * as ts from "typescript";

export type TypeScriptSource = {
  file: string;
  source: string;
};

export type TypeScriptProject = {
  files: TypeScriptSource[];
  tsconfig?: {
    compilerOptions?: {
      baseUrl?: string;
      paths?: Record<string, string[]>;
    };
  };
};

export type SymbolBindings = ReadonlyMap<string, string>;
export type EventIds = ReadonlyMap<string, string>;

export type ProjectSymbolResolution = {
  eventIds: EventIds;
  bindingsByFile: ReadonlyMap<string, SymbolBindings>;
};

type VariableCall = {
  id: string;
  call: ts.CallExpression;
};

const createSourceFile = (fileName: string, source: string): ts.SourceFile =>
  ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

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

const resolveImportFile = (
  importer: string,
  moduleSpecifier: string,
  project: TypeScriptProject,
): string | undefined => {
  const files = new Set(project.files.map((file) => normalizePath(file.file)));
  const paths = project.tsconfig?.compilerOptions?.paths ?? {};
  const baseUrl = project.tsconfig?.compilerOptions?.baseUrl ?? ".";

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

const getProjectEventIds = (files: TypeScriptSource[]): Map<string, string> => {
  const occurrences = new Map<string, number>();
  const declarations: Array<{ file: string; name: string }> = [];

  for (const file of files) {
    const sourceFile = createSourceFile(file.file, file.source);
    const visit = (node: ts.Node): void => {
      const variableCall = getVariableCall(node);
      if (
        variableCall &&
        ts.isIdentifier(variableCall.call.expression) &&
        variableCall.call.expression.text === "createAction"
      ) {
        declarations.push({ file: normalizePath(file.file), name: variableCall.id });
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
  project: TypeScriptProject,
  eventIds: EventIds,
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

    const importedFile = resolveImportFile(file.file, statement.moduleSpecifier.text, project);
    for (const element of statement.importClause.namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      const importedId = importedFile
        ? eventIds.get(`${normalizePath(importedFile)}#${importedName}`)
        : undefined;
      bindings.set(element.name.text, importedId ?? importedName);
    }
  }

  return bindings;
};

export const resolveProjectSymbols = (project: TypeScriptProject): ProjectSymbolResolution => {
  const eventIds = getProjectEventIds(project.files);
  const bindingsByFile = new Map<string, SymbolBindings>();

  for (const file of project.files) {
    const sourceFile = createSourceFile(file.file, file.source);
    bindingsByFile.set(file.file, getSymbolBindings(file, sourceFile, project, eventIds));
  }

  return { eventIds, bindingsByFile };
};
