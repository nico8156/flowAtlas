import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");

const fail = (message) => {
  throw new Error(`Java Maven semantic context: ${message}`);
};

const requireString = (object, property) => {
  const value = object[property];
  if (typeof value !== "string" || value.length === 0) {
    fail(`request property ${property} must be a non-empty string`);
  }
  return value;
};

const requireStringArray = (object, property) => {
  const value = object[property];
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string")
  ) {
    fail(`request property ${property} must be a non-empty string array`);
  }
  return value;
};

const optionalStringArray = (object, property) => {
  const value = object[property] ?? [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    fail(`request property ${property} must be a string array when present`);
  }
  return value;
};

const assertInside = (root, candidate, label) => {
  const relativePath = relative(root, candidate);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    fail(`${label} must stay inside ${root}`);
  }
};

const readJavaRelease = (pom) => {
  const properties = new Map();
  const propertiesMatch = pom.match(/<properties>([\s\S]*?)<\/properties>/u);
  if (propertiesMatch) {
    for (const match of propertiesMatch[1].matchAll(/<([\w.-]+)>\s*([^<]+?)\s*<\/\1>/gu)) {
      properties.set(match[1], match[2]);
    }
  }

  const resolveProperty = (value, visited = new Set()) => {
    const reference = value?.match(/^\$\{([^}]+)\}$/u)?.[1];
    if (!reference) return value;
    if (visited.has(reference)) fail(`cyclic Maven property ${reference}`);
    visited.add(reference);
    return resolveProperty(properties.get(reference), visited);
  };

  for (const property of ["maven.compiler.release", "java.version", "maven.compiler.source"]) {
    const value = resolveProperty(properties.get(property));
    if (value) return value;
  }
  fail("pom.xml must declare maven.compiler.release, java.version, or maven.compiler.source");
};

const buildMavenClasspath = async (projectRoot, temporaryDirectory) => {
  const classpathFile = resolve(temporaryDirectory, "classpath.txt");
  const wrapper = resolve(projectRoot, "mvnw");
  const executable = existsSync(wrapper) ? wrapper : "mvn";

  await execFileAsync(
    executable,
    [
      "-q",
      "dependency:build-classpath",
      `-Dmdep.outputFile=${classpathFile}`,
      `-Dmdep.pathSeparator=${delimiter}`,
    ],
    { cwd: projectRoot, maxBuffer: 1024 * 1024 },
  );

  const dependencyClasspath = existsSync(classpathFile)
    ? (await readFile(classpathFile, "utf8")).trim()
    : "";
  return [dependencyClasspath, resolve(projectRoot, "target/classes")]
    .filter(Boolean)
    .flatMap((entry) => entry.split(delimiter))
    .filter(Boolean);
};

const loadRequest = async (projectRoot, requestPath) => {
  const request = JSON.parse(await readFile(requestPath, "utf8"));
  const sourceRootName = requireString(request, "sourceRoot");
  const sourceRoot = resolve(projectRoot, sourceRootName);
  assertInside(projectRoot, sourceRoot, "sourceRoot");

  const scanSources = requireStringArray(request, "scanSources")
    .map((source) => resolve(sourceRoot, source))
    .sort();
  for (const source of scanSources) assertInside(sourceRoot, source, "scan source");
  const resolutionSources = optionalStringArray(request, "resolutionSources")
    .map((source) => resolve(sourceRoot, source))
    .sort();
  for (const source of resolutionSources) {
    assertInside(sourceRoot, source, "resolution source");
  }
  for (const source of [...scanSources, ...resolutionSources]) {
    if (!existsSync(source)) fail(`missing source ${source}`);
  }

  return {
    sourceRootName,
    sourceRoot,
    scanSources,
    resolutionSources,
    domainEvent: requireString(request, "domainEvent"),
    eventHandler: requireString(request, "eventHandler"),
    handler: requireString(request, "handler"),
    provider: requireString(request, "provider"),
    providerMethod: requireString(request, "providerMethod"),
    events: requireStringArray(request, "events"),
  };
};

const run = async () => {
  const [projectArgument, requestArgument] = globalThis.process.argv.slice(2);
  if (!projectArgument || !requestArgument) {
    fail("usage: node scripts/javaMavenSemanticContext.mjs <maven-project> <request.json>");
  }

  const projectRoot = await realpath(resolve(projectArgument));
  const requestPath = await realpath(resolve(requestArgument));
  const pomPath = resolve(projectRoot, "pom.xml");
  if (!existsSync(pomPath)) fail(`missing ${pomPath}`);

  const request = await loadRequest(projectRoot, requestPath);
  const javaRelease = readJavaRelease(await readFile(pomPath, "utf8"));
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "flowatlas-java-context-"));

  try {
    const classpathEntries = await buildMavenClasspath(projectRoot, temporaryDirectory);
    const javaArguments = [
      resolve(scriptDirectory, "JavaSemanticSpike.java"),
      "--release",
      javaRelease,
      "--source-root",
      request.sourceRoot,
      "--classpath",
      classpathEntries.join(delimiter),
      "--domain-event",
      request.domainEvent,
      "--event-handler",
      request.eventHandler,
      "--handler",
      request.handler,
      "--provider",
      request.provider,
      "--provider-method",
      request.providerMethod,
      ...[...new Set([...request.scanSources, ...request.resolutionSources])].flatMap((source) => [
        "--source",
        source,
      ]),
      ...request.scanSources.flatMap((source) => ["--scan-source", source]),
      ...request.events.flatMap((event) => ["--event", event]),
    ];
    const { stdout } = await execFileAsync("java", javaArguments, {
      cwd: repositoryRoot,
      maxBuffer: 1024 * 1024,
    });
    const semanticEvidence = JSON.parse(stdout);
    const relativeScanSources = request.scanSources
      .map((source) => relative(request.sourceRoot, source))
      .sort();

    globalThis.process.stdout.write(
      `${JSON.stringify(
        {
          ...semanticEvidence,
          project: {
            root: projectRoot,
            javaRelease,
            sourceRoot: request.sourceRootName,
            classpathEntries: classpathEntries.length,
          },
          scanScope: { files: relativeScanSources },
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};

await run();
