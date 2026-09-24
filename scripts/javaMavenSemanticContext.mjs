import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
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

const optionalString = (object, property) => {
  const value = object[property];
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    fail(`request property ${property} must be a non-empty string when present`);
  }
  return value;
};

const projectionMutations = (request) => {
  const configured = request.projectionMutations;
  if (configured !== undefined) {
    if (!Array.isArray(configured) || configured.length === 0) {
      fail("request property projectionMutations must be a non-empty array when present");
    }
    return configured.map((mutation, index) => {
      if (!mutation || typeof mutation !== "object" || Array.isArray(mutation)) {
        fail("projectionMutations[" + index + "] must be an object");
      }
      return {
        repository: requireString(mutation, "repository"),
        method: requireString(mutation, "method"),
        state: requireString(mutation, "state"),
      };
    });
  }
  const repository = optionalString(request, "projectionRepository");
  const method = optionalString(request, "projectionMutationMethod");
  if ((repository === undefined) !== (method === undefined)) {
    fail("projectionRepository and projectionMutationMethod must be provided together");
  }
  return repository
    ? [{ repository, method, state: optionalString(request, "projectionState") }]
    : [];
};

const optionalNumber = (object, property) => {
  const value = object[property];
  if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
    fail(`request property ${property} must be a non-negative integer when present`);
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

const resolveJavaExecutable = () =>
  globalThis.process.env.JAVA_HOME ? join(globalThis.process.env.JAVA_HOME, "bin", "java") : "java";

const readJavaRuntime = async (executable) => {
  let versionOutput;
  try {
    ({ stderr: versionOutput } = await execFileAsync(executable, ["-version"], {
      maxBuffer: 16 * 1024,
    }));
  } catch (error) {
    fail(
      `cannot execute Java runtime ${executable}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const version = versionOutput.match(/version "([^"\s]+)/u)?.[1];
  const feature = version?.match(/^(\d+)/u)?.[1];
  if (!version || !feature) fail(`cannot identify Java version from ${executable}`);
  return { executable, version, feature };
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

const javaFailureDetail = (error) => {
  const output = [
    error && typeof error === "object" ? error.stderr : undefined,
    error && typeof error === "object" ? error.stdout : undefined,
  ]
    .filter((value) => typeof value === "string")
    .join("\n");
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const relevant = lines.filter((line) =>
    /Exception in thread|\.java:\d+:\s+error:|Could not prove|does not implement|Configured projection|Projection requires/u.test(
      line,
    ),
  );
  if (relevant.length > 0) return relevant.slice(0, 4).join(" ");
  const fallback = lines.find(
    (line) => !line.includes("Command failed:") && !line.includes("--classpath"),
  );
  if (fallback) return fallback.slice(0, 600);
  return error instanceof Error ? error.message.split("\n")[0].slice(0, 600) : String(error);
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

  const domainEventPublisher = optionalString(request, "domainEventPublisher");
  const domainEventPublishMethod = optionalString(request, "domainEventPublishMethod");
  if ((domainEventPublisher === undefined) !== (domainEventPublishMethod === undefined)) {
    fail("domainEventPublisher and domainEventPublishMethod must be provided together");
  }

  const commandConfiguration = {
    command: optionalString(request, "command"),
    commandMarker: optionalString(request, "commandMarker"),
    commandHandlerInterface: optionalString(request, "commandHandlerInterface"),
    commandHandler: optionalString(request, "commandHandler"),
    controller: optionalString(request, "controller"),
    controllerMethod: optionalString(request, "controllerMethod"),
    requestMappingAnnotation: optionalString(request, "requestMappingAnnotation"),
    httpMethodMappingAnnotation: optionalString(request, "httpMethodMappingAnnotation"),
    httpMethod: optionalString(request, "httpMethod"),
    commandBus: optionalString(request, "commandBus"),
    commandDispatchMethod: optionalString(request, "commandDispatchMethod"),
  };
  const configuredCommandProperties = Object.values(commandConfiguration).filter(
    (value) => value !== undefined,
  );
  if (
    configuredCommandProperties.length > 0 &&
    configuredCommandProperties.length !== Object.keys(commandConfiguration).length
  ) {
    fail("all HTTP command request properties must be provided together");
  }

  const integrationConfiguration = {
    integrationProducerEvent: optionalString(request, "integrationProducerEvent"),
    outboxMetadataContributor: optionalString(request, "outboxMetadataContributor"),
    outboxMetadata: optionalString(request, "outboxMetadata"),
    integrationDestinationResolver: optionalString(request, "integrationDestinationResolver"),
    integrationDestinationMethod: optionalString(request, "integrationDestinationMethod"),
    outboxEventEntity: optionalString(request, "outboxEventEntity"),
    aggregateTypeGetter: optionalString(request, "aggregateTypeGetter"),
    eventTypeGetter: optionalString(request, "eventTypeGetter"),
    integrationTypeCatalog: optionalString(request, "integrationTypeCatalog"),
    integrationVersionMethod: optionalString(request, "integrationVersionMethod"),
    integrationSender: optionalString(request, "integrationSender"),
    integrationSenderMethod: optionalString(request, "integrationSenderMethod"),
    integrationEnvelopeFactory: optionalString(request, "integrationEnvelopeFactory"),
    integrationEnvelopeFactoryMethod: optionalString(request, "integrationEnvelopeFactoryMethod"),
    integrationMessagePublisher: optionalString(request, "integrationMessagePublisher"),
    integrationMessagePublishMethod: optionalString(request, "integrationMessagePublishMethod"),
    sqsHandlerInterface: optionalString(request, "sqsHandlerInterface"),
    sqsConfiguration: optionalString(request, "sqsConfiguration"),
    sqsRouter: optionalString(request, "sqsRouter"),
    sqsRouterMethod: optionalString(request, "sqsRouterMethod"),
    inboxRepository: optionalString(request, "inboxRepository"),
    inboxClaimMethod: optionalString(request, "inboxClaimMethod"),
    sqsHandleMethod: optionalString(request, "sqsHandleMethod"),
  };
  const configuredIntegrationProperties = Object.values(integrationConfiguration).filter(
    (value) => value !== undefined,
  );
  if (
    configuredIntegrationProperties.length > 0 &&
    configuredIntegrationProperties.length !== Object.keys(integrationConfiguration).length
  ) {
    fail("all integration event request properties must be provided together");
  }

  const projectionConfiguration = {
    projectionHandler: optionalString(request, "projectionHandler"),
    projectionHandlerMethod: optionalString(request, "projectionHandlerMethod"),
  };
  const mutations = projectionMutations(request);
  const projectionState = optionalString(request, "projectionState");
  const configuredProjectionProperties = Object.values(projectionConfiguration).filter(
    (value) => value !== undefined,
  );
  if (
    configuredProjectionProperties.length > 0 &&
    configuredProjectionProperties.length !== Object.keys(projectionConfiguration).length
  ) {
    fail("all projection request properties must be provided together");
  }
  if ((mutations.length > 0 || projectionState) && !projectionConfiguration.projectionHandler) {
    fail("projectionState requires a projection request block");
  }
  if (request.projectionMutations !== undefined && projectionState !== undefined) {
    fail("projectionState cannot be combined with projectionMutations; set state on each mutation");
  }

  const projectionSyncConfiguration = {
    projectionSyncPublisher: optionalString(request, "projectionSyncPublisher"),
    projectionSyncPublishMethod: optionalString(request, "projectionSyncPublishMethod"),
    projectionSyncEvent: optionalString(request, "projectionSyncEvent"),
    projectionSyncFactoryMethod: optionalString(request, "projectionSyncFactoryMethod"),
    projectionSyncProjectionArgumentIndex: optionalNumber(
      request,
      "projectionSyncProjectionArgumentIndex",
    ),
    projectionSyncScopeArgumentIndex: optionalNumber(request, "projectionSyncScopeArgumentIndex"),
  };
  const configuredProjectionSyncProperties = Object.values(projectionSyncConfiguration).filter(
    (value) => value !== undefined,
  );
  if (
    configuredProjectionSyncProperties.length > 0 &&
    configuredProjectionSyncProperties.length !== Object.keys(projectionSyncConfiguration).length
  ) {
    fail("all projection sync request properties must be provided together");
  }
  if (projectionConfiguration.projectionHandler && mutations.length === 0) {
    fail("a projection handler requires at least one configured projection mutation");
  }
  if (configuredProjectionSyncProperties.length > 0 && !projectionConfiguration.projectionHandler) {
    fail("projection sync requires a projection request block");
  }
  if (
    projectionConfiguration.projectionHandler &&
    mutations.some((mutation) => !mutation.state) &&
    !projectionSyncConfiguration.projectionSyncPublisher
  ) {
    fail("projectionState is required when projection sync is absent");
  }

  const localOutboxConfiguration = {
    localOutboxHandler: optionalString(request, "localOutboxHandler"),
    localOutboxHandlerInterface: optionalString(request, "localOutboxHandlerInterface"),
    localOutboxEventTypeMethod: optionalString(request, "localOutboxEventTypeMethod"),
    localOutboxHandleMethod: optionalString(request, "localOutboxHandleMethod"),
    localOutboxDispatcher: optionalString(request, "localOutboxDispatcher"),
    localOutboxDispatchMethod: optionalString(request, "localOutboxDispatchMethod"),
  };
  const configuredLocalOutboxProperties = Object.values(localOutboxConfiguration).filter(
    (value) => value !== undefined,
  );
  if (
    configuredLocalOutboxProperties.length > 0 &&
    configuredLocalOutboxProperties.length !== Object.keys(localOutboxConfiguration).length
  ) {
    fail("all local outbox handler request properties must be provided together");
  }

  const externalConfiguration = {
    externalConfiguration: optionalString(request, "externalConfiguration"),
    externalFactoryMethod: optionalString(request, "externalFactoryMethod"),
    externalAdapter: optionalString(request, "externalAdapter"),
    externalAdapterMethod: optionalString(request, "externalAdapterMethod"),
    externalHandler: optionalString(request, "externalHandler"),
  };
  const externalPort = optionalString(request, "externalPort");
  const externalPortMethod = optionalString(request, "externalPortMethod");
  if ((externalPort === undefined) !== (externalPortMethod === undefined)) {
    fail("externalPort and externalPortMethod must be provided together");
  }
  const externalProcessConfiguration = {
    externalProcessBuilder: optionalString(request, "externalProcessBuilder"),
    externalProcessStartMethod: optionalString(request, "externalProcessStartMethod"),
  };
  const externalClientConfiguration = {
    externalClient: optionalString(request, "externalClient"),
    externalClientMethod: optionalString(request, "externalClientMethod"),
  };
  const configuredExternalProperties = Object.values(externalConfiguration).filter(
    (value) => value !== undefined,
  );
  if (
    configuredExternalProperties.length > 0 &&
    configuredExternalProperties.length !== Object.keys(externalConfiguration).length
  ) {
    fail("all external request properties must be provided together");
  }
  const configuredProcessProperties = Object.values(externalProcessConfiguration).filter(
    (value) => value !== undefined,
  );
  const configuredClientProperties = Object.values(externalClientConfiguration).filter(
    (value) => value !== undefined,
  );
  if (
    (configuredProcessProperties.length > 0 &&
      configuredProcessProperties.length !== Object.keys(externalProcessConfiguration).length) ||
    (configuredClientProperties.length > 0 &&
      configuredClientProperties.length !== Object.keys(externalClientConfiguration).length)
  ) {
    fail("external execution request properties must be provided in pairs");
  }
  if (configuredExternalProperties.length > 0) {
    if (configuredProcessProperties.length > 0 === configuredClientProperties.length > 0) {
      fail("one external execution boundary must be configured");
    }
    if (configuredClientProperties.length > 0 && !externalPort) {
      fail("external client execution requires externalPort and externalPortMethod");
    }
  } else if (
    configuredProcessProperties.length > 0 ||
    configuredClientProperties.length > 0 ||
    externalPort
  ) {
    fail("external execution requires an external request block");
  }

  const scheduledConfiguration = {
    scheduledHandler: optionalString(request, "scheduledHandler"),
    scheduledMethod: optionalString(request, "scheduledMethod"),
    scheduledAnnotation: optionalString(request, "scheduledAnnotation"),
  };
  const configuredScheduledProperties = Object.values(scheduledConfiguration).filter(
    (value) => value !== undefined,
  );
  if (
    configuredScheduledProperties.length > 0 &&
    configuredScheduledProperties.length !== Object.keys(scheduledConfiguration).length
  ) {
    fail("all scheduled request properties must be provided together");
  }

  const legacyEventConfiguration = {
    domainEvent: optionalString(request, "domainEvent"),
    eventHandler: optionalString(request, "eventHandler"),
    handler: optionalString(request, "handler"),
    provider: optionalString(request, "provider"),
    providerMethod: optionalString(request, "providerMethod"),
  };
  const events = optionalStringArray(request, "events");
  const configuredLegacyProperties = Object.values(legacyEventConfiguration).filter(
    (value) => value !== undefined,
  );
  if (
    configuredLegacyProperties.length > 0 &&
    configuredLegacyProperties.length !== Object.keys(legacyEventConfiguration).length
  ) {
    fail("all typed event-handler request properties must be provided together");
  }
  if (configuredLegacyProperties.length > 0 && events.length === 0) {
    fail("events must be non-empty with a typed event-handler request");
  }
  if (events.length > 0 && !legacyEventConfiguration.domainEvent) {
    fail("events require a typed event-handler request");
  }
  if (domainEventPublisher && !legacyEventConfiguration.domainEvent) {
    fail("domainEventPublisher requires a typed event-handler request");
  }

  return {
    sourceRootName,
    sourceRoot,
    scanSources,
    resolutionSources,
    ...legacyEventConfiguration,
    domainEventPublisher,
    domainEventPublishMethod,
    ...commandConfiguration,
    ...integrationConfiguration,
    ...projectionConfiguration,
    projectionMutations: mutations,
    projectionState,
    ...projectionSyncConfiguration,
    ...localOutboxConfiguration,
    ...externalConfiguration,
    externalPort,
    externalPortMethod,
    ...externalProcessConfiguration,
    ...externalClientConfiguration,
    ...scheduledConfiguration,
    events,
  };
};

const run = async () => {
  const [projectArgument, requestArgument] = globalThis.process.argv.slice(2);
  if (!projectArgument || !requestArgument) {
    fail("usage: node scripts/javaMavenSemanticContext.mjs <maven-project> <request.json>");
  }

  const requestedRoot = await realpath(resolve(projectArgument));
  const projectRoot = await resolveMavenProjectRoot(requestedRoot);
  const requestPath = await realpath(resolve(requestArgument));
  const pomPath = resolve(projectRoot, "pom.xml");
  if (!existsSync(pomPath)) fail(`missing ${pomPath}`);

  const request = await loadRequest(projectRoot, requestPath);
  const javaRelease = readJavaRelease(await readFile(pomPath, "utf8"));
  const javaRuntime = await readJavaRuntime(resolveJavaExecutable());
  if (Number(javaRuntime.feature) < Number(javaRelease)) {
    fail(
      `Java runtime ${javaRuntime.executable} is ${javaRuntime.version}, below Maven release ${javaRelease}`,
    );
  }
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
      ...(request.domainEvent
        ? [
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
          ]
        : []),
      ...(request.domainEventPublisher
        ? [
            "--domain-event-publisher",
            request.domainEventPublisher,
            "--domain-event-publish-method",
            request.domainEventPublishMethod,
          ]
        : []),
      ...(request.command
        ? [
            "--command",
            request.command,
            "--command-marker",
            request.commandMarker,
            "--command-handler-interface",
            request.commandHandlerInterface,
            "--command-handler",
            request.commandHandler,
            "--controller",
            request.controller,
            "--controller-method",
            request.controllerMethod,
            "--request-mapping-annotation",
            request.requestMappingAnnotation,
            "--http-method-mapping-annotation",
            request.httpMethodMappingAnnotation,
            "--http-method",
            request.httpMethod,
            "--command-bus",
            request.commandBus,
            "--command-dispatch-method",
            request.commandDispatchMethod,
          ]
        : []),
      ...(request.integrationProducerEvent
        ? [
            "--integration-producer-event",
            request.integrationProducerEvent,
            "--outbox-metadata-contributor",
            request.outboxMetadataContributor,
            "--outbox-metadata",
            request.outboxMetadata,
            "--integration-destination-resolver",
            request.integrationDestinationResolver,
            "--integration-destination-method",
            request.integrationDestinationMethod,
            "--outbox-event-entity",
            request.outboxEventEntity,
            "--aggregate-type-getter",
            request.aggregateTypeGetter,
            "--event-type-getter",
            request.eventTypeGetter,
            "--integration-type-catalog",
            request.integrationTypeCatalog,
            "--integration-version-method",
            request.integrationVersionMethod,
            "--integration-sender",
            request.integrationSender,
            "--integration-sender-method",
            request.integrationSenderMethod,
            "--integration-envelope-factory",
            request.integrationEnvelopeFactory,
            "--integration-envelope-factory-method",
            request.integrationEnvelopeFactoryMethod,
            "--integration-message-publisher",
            request.integrationMessagePublisher,
            "--integration-message-publish-method",
            request.integrationMessagePublishMethod,
            "--sqs-handler-interface",
            request.sqsHandlerInterface,
            "--sqs-configuration",
            request.sqsConfiguration,
            "--sqs-router",
            request.sqsRouter,
            "--sqs-router-method",
            request.sqsRouterMethod,
            "--inbox-repository",
            request.inboxRepository,
            "--inbox-claim-method",
            request.inboxClaimMethod,
            "--sqs-handle-method",
            request.sqsHandleMethod,
          ]
        : []),
      ...(request.projectionHandler
        ? [
            "--projection-handler",
            request.projectionHandler,
            "--projection-handler-method",
            request.projectionHandlerMethod,
            ...request.projectionMutations.flatMap((mutation) => [
              "--projection-mutation-repository",
              mutation.repository,
              "--projection-mutation-method",
              mutation.method,
              "--projection-mutation-state",
              mutation.state ?? "",
            ]),
            ...(request.projectionSyncPublisher
              ? [
                  "--projection-sync-publisher",
                  request.projectionSyncPublisher,
                  "--projection-sync-publish-method",
                  request.projectionSyncPublishMethod,
                  "--projection-sync-event",
                  request.projectionSyncEvent,
                  "--projection-sync-factory-method",
                  request.projectionSyncFactoryMethod,
                  "--projection-sync-projection-argument-index",
                  String(request.projectionSyncProjectionArgumentIndex),
                  "--projection-sync-scope-argument-index",
                  String(request.projectionSyncScopeArgumentIndex),
                ]
              : []),
          ]
        : []),
      ...(request.localOutboxHandler
        ? [
            "--local-outbox-handler",
            request.localOutboxHandler,
            "--local-outbox-handler-interface",
            request.localOutboxHandlerInterface,
            "--local-outbox-event-type-method",
            request.localOutboxEventTypeMethod,
            "--local-outbox-handle-method",
            request.localOutboxHandleMethod,
            "--local-outbox-dispatcher",
            request.localOutboxDispatcher,
            "--local-outbox-dispatch-method",
            request.localOutboxDispatchMethod,
          ]
        : []),
      ...(request.externalConfiguration
        ? [
            "--external-configuration",
            request.externalConfiguration,
            "--external-factory-method",
            request.externalFactoryMethod,
            "--external-adapter",
            request.externalAdapter,
            "--external-adapter-method",
            request.externalAdapterMethod,
            "--external-handler",
            request.externalHandler,
            ...(request.externalPort
              ? [
                  "--external-port",
                  request.externalPort,
                  "--external-port-method",
                  request.externalPortMethod,
                ]
              : []),
            ...(request.externalProcessBuilder
              ? [
                  "--external-process-builder",
                  request.externalProcessBuilder,
                  "--external-process-start-method",
                  request.externalProcessStartMethod,
                ]
              : []),
            ...(request.externalClient
              ? [
                  "--external-client",
                  request.externalClient,
                  "--external-client-method",
                  request.externalClientMethod,
                ]
              : []),
          ]
        : []),
      ...(request.scheduledHandler
        ? [
            "--scheduled-handler",
            request.scheduledHandler,
            "--scheduled-method",
            request.scheduledMethod,
            "--scheduled-annotation",
            request.scheduledAnnotation,
          ]
        : []),
      ...[...new Set([...request.scanSources, ...request.resolutionSources])].flatMap((source) => [
        "--source",
        source,
      ]),
      ...request.scanSources.flatMap((source) => ["--scan-source", source]),
      ...request.events.flatMap((event) => ["--event", event]),
    ];
    let stdout;
    try {
      ({ stdout } = await execFileAsync(javaRuntime.executable, javaArguments, {
        cwd: repositoryRoot,
        maxBuffer: 1024 * 1024,
      }));
    } catch (error) {
      fail("Java semantic analysis failed: " + javaFailureDetail(error));
    }
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
            javaRuntime,
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

const resolveMavenProjectRoot = async (requestedRoot) => {
  if (existsSync(resolve(requestedRoot, "pom.xml"))) return requestedRoot;

  let gitRoot;
  try {
    ({ stdout: gitRoot } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], {
      cwd: requestedRoot,
      maxBuffer: 16 * 1024,
    }));
  } catch {
    fail("missing " + resolve(requestedRoot, "pom.xml") + "; module discovery requires a Git root");
  }
  gitRoot = await realpath(gitRoot.trim());
  if (gitRoot !== requestedRoot) {
    fail(
      "missing " +
        resolve(requestedRoot, "pom.xml") +
        "; pass the Git root to discover Maven modules",
    );
  }

  const entries = await readdir(gitRoot, { withFileTypes: true });
  const modules = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map(async (entry) => {
        const moduleRoot = resolve(gitRoot, entry.name);
        return existsSync(resolve(moduleRoot, "pom.xml")) ? moduleRoot : undefined;
      }),
  );
  const candidates = modules.filter((moduleRoot) => moduleRoot !== undefined).sort();
  if (candidates.length === 1) return await realpath(candidates[0]);
  if (candidates.length > 1) {
    fail(
      "multiple direct Maven modules found: " +
        candidates.map((path) => relative(gitRoot, path)).join(", ") +
        "; pass the intended module as projectPath",
    );
  }
  fail("no pom.xml found at " + requestedRoot + " or in its direct Git-root modules");
};

await run();
