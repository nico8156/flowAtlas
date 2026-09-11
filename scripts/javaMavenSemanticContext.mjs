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

const optionalString = (object, property) => {
  const value = object[property];
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    fail(`request property ${property} must be a non-empty string when present`);
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
    projectionRepository: optionalString(request, "projectionRepository"),
    projectionMutationMethod: optionalString(request, "projectionMutationMethod"),
    projectionSyncPublisher: optionalString(request, "projectionSyncPublisher"),
    projectionSyncPublishMethod: optionalString(request, "projectionSyncPublishMethod"),
    projectionSyncEvent: optionalString(request, "projectionSyncEvent"),
    projectionSyncFactoryMethod: optionalString(request, "projectionSyncFactoryMethod"),
  };
  const configuredProjectionProperties = Object.values(projectionConfiguration).filter(
    (value) => value !== undefined,
  );
  if (
    configuredProjectionProperties.length > 0 &&
    configuredProjectionProperties.length !== Object.keys(projectionConfiguration).length
  ) {
    fail("all projection request properties must be provided together");
  }

  const externalConfiguration = {
    externalConfiguration: optionalString(request, "externalConfiguration"),
    externalFactoryMethod: optionalString(request, "externalFactoryMethod"),
    externalAdapter: optionalString(request, "externalAdapter"),
    externalAdapterMethod: optionalString(request, "externalAdapterMethod"),
    externalProcessBuilder: optionalString(request, "externalProcessBuilder"),
    externalProcessStartMethod: optionalString(request, "externalProcessStartMethod"),
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
    domainEventPublisher,
    domainEventPublishMethod,
    ...commandConfiguration,
    ...integrationConfiguration,
    ...projectionConfiguration,
    ...externalConfiguration,
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
            "--projection-repository",
            request.projectionRepository,
            "--projection-mutation-method",
            request.projectionMutationMethod,
            "--projection-sync-publisher",
            request.projectionSyncPublisher,
            "--projection-sync-publish-method",
            request.projectionSyncPublishMethod,
            "--projection-sync-event",
            request.projectionSyncEvent,
            "--projection-sync-factory-method",
            request.projectionSyncFactoryMethod,
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
            "--external-process-builder",
            request.externalProcessBuilder,
            "--external-process-start-method",
            request.externalProcessStartMethod,
          ]
        : []),
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
