import com.sun.source.tree.BinaryTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.EnhancedForLoopTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.IfTree;
import com.sun.source.tree.InstanceOfTree;
import com.sun.source.tree.LiteralTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.ParenthesizedTree;
import com.sun.source.tree.ReturnTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.UnaryTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.JavacTask;
import com.sun.source.util.TreePath;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.Trees;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.StreamSupport;

import javax.lang.model.element.AnnotationMirror;
import javax.lang.model.element.AnnotationValue;
import javax.lang.model.element.Element;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.TypeElement;
import javax.lang.model.element.VariableElement;
import javax.lang.model.type.DeclaredType;
import javax.lang.model.type.TypeMirror;
import javax.lang.model.util.Elements;
import javax.lang.model.util.Types;
import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;

public final class JavaSemanticSpike {
    private JavaSemanticSpike() {
    }

    public static void main(String[] arguments) throws Exception {
        Config config = Config.parse(arguments);
        ProbeResult result = analyze(config);
        System.out.println(result.toJson());
    }

    private static ProbeResult analyze(Config config) throws IOException {
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            throw new IllegalStateException("A JDK with the system Java compiler is required");
        }

        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        try (StandardJavaFileManager fileManager = compiler.getStandardFileManager(diagnostics, null, null)) {
            Iterable<? extends JavaFileObject> sourceFiles = fileManager.getJavaFileObjectsFromPaths(config.sources());
            List<String> options = new ArrayList<>(List.of(
                    "-proc:none",
                    "--release", config.release(),
                    "-sourcepath", config.sourceRoot().toString()));
            if (config.classpath() != null) {
                options.add("-classpath");
                options.add(config.classpath());
            }

            JavacTask task = (JavacTask) compiler.getTask(
                    null,
                    fileManager,
                    diagnostics,
                    options,
                    null,
                    sourceFiles);
            List<? extends CompilationUnitTree> units = StreamSupport.stream(
                    task.parse().spliterator(), false).toList();
            task.analyze();

            Trees trees = Trees.instance(task);
            Elements elements = task.getElements();
            Types types = task.getTypes();

            TypeElement domainEvent = requiredType(elements, config.domainEvent(), diagnostics);
            List<TypeEvidence> typeEvidence = config.events().stream()
                    .map(eventName -> {
                        TypeElement event = requiredType(elements, eventName, diagnostics);
                        boolean assignable = types.isAssignable(
                                types.erasure(event.asType()),
                                types.erasure(domainEvent.asType()));
                        return new TypeEvidence(eventName, assignable, locationOf(trees, event, config));
                    })
                    .toList();

            TypeElement handler = requiredType(elements, config.handler(), diagnostics);
            TypeMirror eventType = findGenericArgument(
                    handler.asType(),
                    config.eventHandler(),
                    types,
                    new HashSet<>());
            if (eventType == null) {
                throw new IllegalStateException(
                        config.handler() + " does not implement " + config.eventHandler() + " with a resolvable type argument");
            }
            HandlerEvidence handlerEvidence = new HandlerEvidence(
                    config.handler(),
                    eventType.toString(),
                    locationOf(trees, handler, config));

            List<InvocationEvidence> invocations = findProviderInvocations(
                    units,
                    trees,
                    config.provider(),
                    config.providerMethod(),
                    config);

            List<PublicationEvidence> publications = findDomainEventPublications(
                    units,
                    trees,
                    config.domainEventPublisher(),
                    config.domainEventPublishMethod(),
                    config);

            CommandSliceEvidence commandSlice = analyzeCommandSlice(
                    units,
                    trees,
                    elements,
                    types,
                    diagnostics,
                    config);

            IntegrationSliceEvidence integrationSlice = analyzeIntegrationSlice(
                    units,
                    trees,
                    elements,
                    types,
                    diagnostics,
                    config);

            ProjectionSliceEvidence projectionSlice = analyzeProjectionSlice(
                    trees,
                    elements,
                    types,
                    diagnostics,
                    config);

            ExternalSliceEvidence externalSlice = analyzeExternalSlice(
                    trees,
                    elements,
                    types,
                    diagnostics,
                    config,
                    invocations);

            ScheduledSliceEvidence scheduledSlice = analyzeScheduledSlice(trees, elements, diagnostics, config);

            return new ProbeResult(
                    typeEvidence,
                    handlerEvidence,
                    invocations,
                    publications,
                    commandSlice,
                    integrationSlice,
                    projectionSlice,
                    externalSlice,
                    scheduledSlice,
                    diagnosticEvidence(diagnostics, config));
        }
    }

    private static TypeElement requiredType(
            Elements elements,
            String qualifiedName,
            DiagnosticCollector<JavaFileObject> diagnostics) {
        TypeElement result = elements.getTypeElement(qualifiedName);
        if (result != null) return result;
        String details = diagnostics == null
                ? ""
                : ". Diagnostics: " + String.join(" | ", diagnosticMessages(diagnostics));
        throw new IllegalStateException(
                "Could not resolve " + qualifiedName + details);
    }

    private static TypeMirror findGenericArgument(
            TypeMirror candidate,
            String targetInterface,
            Types types,
            Set<String> visited) {
        String identity = candidate.toString();
        if (!visited.add(identity)) return null;

        if (candidate instanceof DeclaredType declared) {
            Element element = declared.asElement();
            if (element instanceof TypeElement type
                    && type.getQualifiedName().contentEquals(targetInterface)
                    && declared.getTypeArguments().size() == 1) {
                return declared.getTypeArguments().getFirst();
            }
        }

        for (TypeMirror supertype : types.directSupertypes(candidate)) {
            TypeMirror result = findGenericArgument(supertype, targetInterface, types, visited);
            if (result != null) return result;
        }
        return null;
    }

    private static List<InvocationEvidence> findProviderInvocations(
            List<? extends CompilationUnitTree> units,
            Trees trees,
            String provider,
            String providerMethod,
            Config config) {
        List<InvocationEvidence> result = new ArrayList<>();

        for (CompilationUnitTree unit : units) {
            new TreePathScanner<Void, Void>() {
                private final Deque<ExecutableElement> callers = new ArrayDeque<>();

                @Override
                public Void visitMethod(MethodTree method, Void unused) {
                    Element element = trees.getElement(getCurrentPath());
                    if (!(element instanceof ExecutableElement executable)) {
                        return super.visitMethod(method, unused);
                    }
                    callers.push(executable);
                    try {
                        return super.visitMethod(method, unused);
                    } finally {
                        callers.pop();
                    }
                }

                @Override
                public Void visitMethodInvocation(MethodInvocationTree invocation, Void unused) {
                    Element element = trees.getElement(getCurrentPath());
                    if (element instanceof ExecutableElement executable
                            && executable.getEnclosingElement() instanceof TypeElement owner
                            && owner.getQualifiedName().contentEquals(provider)
                            && executable.getSimpleName().contentEquals(providerMethod)
                            && !callers.isEmpty()) {
                        result.add(new InvocationEvidence(
                                owner.getQualifiedName().toString(),
                                executableSignature(executable),
                                callerSignature(callers.peek()),
                                locationOf(trees, getCurrentPath(), config)));
                    }
                    return super.visitMethodInvocation(invocation, unused);
                }
            }.scan(unit, null);
        }

        return result;
    }

    private static List<PublicationEvidence> findDomainEventPublications(
            List<? extends CompilationUnitTree> units,
            Trees trees,
            String publisher,
            String publishMethod,
            Config config) {
        if (publisher == null || publishMethod == null) return List.of();

        List<PublicationEvidence> result = new ArrayList<>();
        for (CompilationUnitTree unit : units) {
            new TreePathScanner<Void, Void>() {
                private final Deque<ExecutableElement> callers = new ArrayDeque<>();

                @Override
                public Void visitMethod(MethodTree method, Void unused) {
                    Element element = trees.getElement(getCurrentPath());
                    if (!(element instanceof ExecutableElement executable)) {
                        return super.visitMethod(method, unused);
                    }
                    callers.push(executable);
                    try {
                        return super.visitMethod(method, unused);
                    } finally {
                        callers.pop();
                    }
                }

                @Override
                public Void visitMethodInvocation(MethodInvocationTree invocation, Void unused) {
                    Element element = trees.getElement(getCurrentPath());
                    if (element instanceof ExecutableElement executable
                            && executable.getEnclosingElement() instanceof TypeElement owner
                            && owner.getQualifiedName().contentEquals(publisher)
                            && executable.getSimpleName().contentEquals(publishMethod)
                            && invocation.getArguments().size() == 1
                            && !callers.isEmpty()) {
                        TreePath argumentPath = new TreePath(
                                getCurrentPath(),
                                invocation.getArguments().getFirst());
                        TypeMirror argumentType = trees.getTypeMirror(argumentPath);
                        if (argumentType != null) {
                            result.add(new PublicationEvidence(
                                    owner.getQualifiedName().toString(),
                                    executableSignature(executable),
                                    callerSignature(callers.peek()),
                                    argumentType.toString(),
                                    locationOf(trees, getCurrentPath(), config)));
                        }
                    }
                    return super.visitMethodInvocation(invocation, unused);
                }
            }.scan(unit, null);
        }
        return result;
    }

    private static CommandSliceEvidence analyzeCommandSlice(
            List<? extends CompilationUnitTree> units,
            Trees trees,
            Elements elements,
            Types types,
            DiagnosticCollector<JavaFileObject> diagnostics,
            Config config) {
        if (config.command() == null) return null;

        TypeElement commandMarker = requiredType(elements, config.commandMarker(), diagnostics);
        TypeElement command = requiredType(elements, config.command(), diagnostics);
        CommandEvidence commandEvidence = new CommandEvidence(
                config.command(),
                types.isAssignable(types.erasure(command.asType()), types.erasure(commandMarker.asType())),
                locationOf(trees, command, config));

        TypeElement handler = requiredType(elements, config.commandHandler(), diagnostics);
        TypeMirror commandType = findGenericArgument(
                handler.asType(),
                config.commandHandlerInterface(),
                types,
                new HashSet<>());
        if (commandType == null) {
            throw new IllegalStateException(
                    config.commandHandler() + " does not implement " + config.commandHandlerInterface()
                            + " with a resolvable type argument");
        }
        CommandHandlerEvidence handlerEvidence = new CommandHandlerEvidence(
                config.commandHandler(),
                commandType.toString(),
                locationOf(trees, handler, config));

        TypeElement controller = requiredType(elements, config.controller(), diagnostics);
        List<ExecutableElement> controllerMethods = controller.getEnclosedElements().stream()
                .filter(ExecutableElement.class::isInstance)
                .map(ExecutableElement.class::cast)
                .filter(method -> method.getSimpleName().contentEquals(config.controllerMethod()))
                .toList();
        if (controllerMethods.size() != 1) {
            throw new IllegalStateException(
                    "Expected exactly one " + config.controller() + "#" + config.controllerMethod());
        }
        ExecutableElement controllerMethod = controllerMethods.getFirst();
        String basePath = annotationPath(controller, config.requestMappingAnnotation());
        String methodPath = annotationPath(controllerMethod, config.httpMethodMappingAnnotation());
        if (basePath == null || methodPath == null) {
            throw new IllegalStateException("Could not resolve configured HTTP mapping annotations");
        }
        HttpEndpointEvidence endpoint = new HttpEndpointEvidence(
                config.controller(),
                callerSignature(controllerMethod),
                config.httpMethod(),
                combineHttpPaths(basePath, methodPath),
                locationOf(trees, controllerMethod, config));

        return new CommandSliceEvidence(
                commandEvidence,
                handlerEvidence,
                endpoint,
                findCommandDispatches(units, trees, config.commandBus(), config.commandDispatchMethod(), config));
    }

    private static String annotationPath(Element element, String annotationType) {
        for (AnnotationMirror annotation : element.getAnnotationMirrors()) {
            Element declaration = annotation.getAnnotationType().asElement();
            if (!(declaration instanceof TypeElement type)
                    || !type.getQualifiedName().contentEquals(annotationType)) {
                continue;
            }
            for (Map.Entry<? extends ExecutableElement, ? extends AnnotationValue> entry
                    : annotation.getElementValues().entrySet()) {
                String property = entry.getKey().getSimpleName().toString();
                if (!property.equals("value") && !property.equals("path")) continue;
                Object raw = entry.getValue().getValue();
                if (raw instanceof List<?> values && !values.isEmpty()
                        && values.getFirst() instanceof AnnotationValue value
                        && value.getValue() instanceof String path) {
                    return path;
                }
                if (raw instanceof String path) return path;
            }
        }
        return null;
    }

    private static String combineHttpPaths(String basePath, String methodPath) {
        String combined = ("/" + basePath + "/" + methodPath).replaceAll("/{2,}", "/");
        return combined.length() > 1 && combined.endsWith("/")
                ? combined.substring(0, combined.length() - 1)
                : combined;
    }

    private static List<CommandDispatchEvidence> findCommandDispatches(
            List<? extends CompilationUnitTree> units,
            Trees trees,
            String commandBus,
            String dispatchMethod,
            Config config) {
        List<CommandDispatchEvidence> result = new ArrayList<>();
        for (CompilationUnitTree unit : units) {
            new TreePathScanner<Void, Void>() {
                private final Deque<ExecutableElement> callers = new ArrayDeque<>();

                @Override
                public Void visitMethod(MethodTree method, Void unused) {
                    Element element = trees.getElement(getCurrentPath());
                    if (!(element instanceof ExecutableElement executable)) {
                        return super.visitMethod(method, unused);
                    }
                    callers.push(executable);
                    try {
                        return super.visitMethod(method, unused);
                    } finally {
                        callers.pop();
                    }
                }

                @Override
                public Void visitMethodInvocation(MethodInvocationTree invocation, Void unused) {
                    Element element = trees.getElement(getCurrentPath());
                    if (element instanceof ExecutableElement executable
                            && executable.getEnclosingElement() instanceof TypeElement owner
                            && owner.getQualifiedName().contentEquals(commandBus)
                            && executable.getSimpleName().contentEquals(dispatchMethod)
                            && invocation.getArguments().size() == 1
                            && !callers.isEmpty()) {
                        TypeMirror argumentType = trees.getTypeMirror(new TreePath(
                                getCurrentPath(), invocation.getArguments().getFirst()));
                        if (argumentType != null) {
                            result.add(new CommandDispatchEvidence(
                                    owner.getQualifiedName().toString(),
                                    executableSignature(executable),
                                    callerSignature(callers.peek()),
                                    argumentType.toString(),
                                    locationOf(trees, getCurrentPath(), config)));
                        }
                    }
                    return super.visitMethodInvocation(invocation, unused);
                }
            }.scan(unit, null);
        }
        return result;
    }

    private static IntegrationSliceEvidence analyzeIntegrationSlice(
            List<? extends CompilationUnitTree> units,
            Trees trees,
            Elements elements,
            Types types,
            DiagnosticCollector<JavaFileObject> diagnostics,
            Config config) {
        if (config.integrationProducerEvent() == null) return null;

        TypeElement producerEvent = requiredType(elements, config.integrationProducerEvent(), diagnostics);
        String producerSimpleName = producerEvent.getSimpleName().toString();
        AggregateTypeEvidence aggregateType = findOutboxAggregateType(
                trees,
                elements,
                config,
                producerEvent);
        List<DestinationEvidence> destinations = findIntegrationDestinations(
                trees,
                elements,
                config,
                producerEvent,
                aggregateType.aggregateType());
        StableTypeEvidence stableType = findStableIntegrationType(
                trees,
                elements,
                config,
                producerSimpleName);
        VersionEvidence version = findIntegrationVersion(trees, elements, config);
        SenderEvidence sender = findIntegrationSender(trees, elements, config);
        SourceLocation inboxSource = proveInboxRouting(trees, elements, config);
        List<IntegrationConsumerEvidence> consumers = findIntegrationConsumers(
                trees,
                elements,
                types,
                config,
                inboxSource);

        List<IntegrationMappingEvidence> mappings = destinations.stream()
                .map(destination -> new IntegrationMappingEvidence(
                        config.integrationProducerEvent(),
                        aggregateType.aggregateType(),
                        destination.destination(),
                        stableType.eventType(),
                        version.version(),
                        sender.handler(),
                        sender.source(),
                        aggregateType.source(),
                        destination.source(),
                        stableType.source(),
                        version.source()))
                .toList();
        return new IntegrationSliceEvidence(mappings, consumers);
    }

    private static AggregateTypeEvidence findOutboxAggregateType(
            Trees trees,
            Elements elements,
            Config config,
            TypeElement producerEvent) {
        TypeElement contributor = requiredType(elements, config.outboxMetadataContributor(), null);
        TypeElement metadata = requiredType(elements, config.outboxMetadata(), null);
        TreePath contributorPath = trees.getPath(contributor);
        List<AggregateTypeEvidence> matches = new ArrayList<>();

        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitIf(IfTree ifTree, Void unused) {
                ExpressionTree condition = unwrap(ifTree.getCondition());
                if (condition instanceof InstanceOfTree instanceOf) {
                    TypeMirror checkedType = trees.getTypeMirror(new TreePath(getCurrentPath(), instanceOf.getType()));
                    if (checkedType != null && checkedType.toString().equals(producerEvent.getQualifiedName().toString())) {
                        new TreePathScanner<Void, Void>() {
                            @Override
                            public Void visitNewClass(NewClassTree newClass, Void nestedUnused) {
                                TypeMirror constructed = trees.getTypeMirror(
                                        new TreePath(getCurrentPath(), newClass.getIdentifier()));
                                if (constructed != null
                                        && constructed.toString().equals(metadata.getQualifiedName().toString())
                                        && !newClass.getArguments().isEmpty()) {
                                    String value = constantString(
                                            trees,
                                            new TreePath(getCurrentPath(), newClass.getArguments().getFirst()));
                                    if (value != null) {
                                        matches.add(new AggregateTypeEvidence(
                                                value,
                                                locationOf(trees, getCurrentPath(), config)));
                                    }
                                }
                                return super.visitNewClass(newClass, nestedUnused);
                            }
                        }.scan(new TreePath(getCurrentPath(), ifTree.getThenStatement()), null);
                    }
                }
                return super.visitIf(ifTree, unused);
            }
        }.scan(contributorPath, null);

        List<AggregateTypeEvidence> distinct = matches.stream()
                .collect(java.util.stream.Collectors.toMap(
                        AggregateTypeEvidence::aggregateType,
                        value -> value,
                        (first, duplicate) -> first,
                        LinkedHashMap::new))
                .values().stream().toList();
        if (distinct.size() != 1) {
            throw new IllegalStateException(
                    "Expected exactly one outbox aggregate type for " + config.integrationProducerEvent());
        }
        return distinct.getFirst();
    }

    private static List<DestinationEvidence> findIntegrationDestinations(
            Trees trees,
            Elements elements,
            Config config,
            TypeElement producerEvent,
            String aggregateType) {
        TypeElement resolver = requiredType(elements, config.integrationDestinationResolver(), null);
        ExecutableElement method = requiredMethod(resolver, config.integrationDestinationMethod());
        TreePath methodPath = trees.getPath(method);
        Map<Element, String> roles = new LinkedHashMap<>();

        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitVariable(VariableTree variable, Void unused) {
                if (variable.getInitializer() instanceof MethodInvocationTree invocation) {
                    ExecutableElement invoked = executableAt(
                            trees,
                            new TreePath(getCurrentPath(), invocation));
                    if (invoked != null) {
                        String role = invoked.getSimpleName().contentEquals(config.aggregateTypeGetter())
                                ? "aggregateType"
                                : invoked.getSimpleName().contentEquals(config.eventTypeGetter())
                                        ? "eventType"
                                        : null;
                        Element variableElement = trees.getElement(getCurrentPath());
                        if (role != null && variableElement != null) roles.put(variableElement, role);
                    }
                }
                return super.visitVariable(variable, unused);
            }
        }.scan(methodPath, null);

        List<DestinationEvidence> destinations = new ArrayList<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitIf(IfTree ifTree, Void unused) {
                TreePath conditionPath = new TreePath(getCurrentPath(), ifTree.getCondition());
                Boolean selected = evaluateKnownStringCondition(
                        trees,
                        conditionPath,
                        roles,
                        producerEvent.getQualifiedName().toString(),
                        aggregateType);
                boolean eventSpecific = referencesRole(trees, conditionPath, roles, "eventType");
                if (Boolean.TRUE.equals(selected)
                        && eventSpecific
                        && hasMatchingAggregateAncestor(
                                trees,
                                getCurrentPath(),
                                roles,
                                producerEvent.getQualifiedName().toString(),
                                aggregateType)) {
                    destinations.addAll(returnedStringConstants(
                            trees,
                            new TreePath(getCurrentPath(), ifTree.getThenStatement()),
                            config));
                }
                return super.visitIf(ifTree, unused);
            }
        }.scan(methodPath, null);

        List<DestinationEvidence> distinct = destinations.stream()
                .collect(java.util.stream.Collectors.toMap(
                        DestinationEvidence::destination,
                        value -> value,
                        (first, duplicate) -> first,
                        LinkedHashMap::new))
                .values().stream().toList();
        if (distinct.isEmpty()) {
            throw new IllegalStateException(
                    "Could not resolve integration destinations for " + config.integrationProducerEvent());
        }
        return distinct;
    }

    private static StableTypeEvidence findStableIntegrationType(
            Trees trees,
            Elements elements,
            Config config,
            String producerSimpleName) {
        TypeElement catalog = requiredType(elements, config.integrationTypeCatalog(), null);
        List<StableTypeEvidence> matches = new ArrayList<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree invocation, Void unused) {
                if (invocation.getArguments().size() == 2) {
                    TreePath firstPath = new TreePath(getCurrentPath(), invocation.getArguments().get(0));
                    TreePath secondPath = new TreePath(getCurrentPath(), invocation.getArguments().get(1));
                    if (producerSimpleName.equals(constantString(trees, firstPath))) {
                        String stableType = constantString(trees, secondPath);
                        if (stableType != null) {
                            matches.add(new StableTypeEvidence(
                                    stableType,
                                    locationOf(trees, getCurrentPath(), config)));
                        }
                    }
                }
                return super.visitMethodInvocation(invocation, unused);
            }
        }.scan(trees.getPath(catalog), null);

        List<StableTypeEvidence> distinct = matches.stream()
                .collect(java.util.stream.Collectors.toMap(
                        StableTypeEvidence::eventType,
                        value -> value,
                        (first, duplicate) -> first,
                        LinkedHashMap::new))
                .values().stream().toList();
        if (distinct.size() != 1) {
            throw new IllegalStateException(
                    "Expected exactly one stable integration type for " + producerSimpleName);
        }
        return distinct.getFirst();
    }

    private static VersionEvidence findIntegrationVersion(
            Trees trees,
            Elements elements,
            Config config) {
        TypeElement catalog = requiredType(elements, config.integrationTypeCatalog(), null);
        ExecutableElement method = requiredMethod(catalog, config.integrationVersionMethod());
        List<VersionEvidence> values = new ArrayList<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitReturn(ReturnTree returnTree, Void unused) {
                if (returnTree.getExpression() instanceof LiteralTree literal
                        && literal.getValue() instanceof Integer value) {
                    values.add(new VersionEvidence(value, locationOf(trees, getCurrentPath(), config)));
                }
                return super.visitReturn(returnTree, unused);
            }
        }.scan(trees.getPath(method), null);
        List<VersionEvidence> distinct = values.stream()
                .collect(java.util.stream.Collectors.toMap(
                        VersionEvidence::version,
                        value -> value,
                        (first, duplicate) -> first,
                        LinkedHashMap::new))
                .values().stream().toList();
        if (distinct.size() != 1) {
            throw new IllegalStateException("Expected one constant integration event version");
        }
        return distinct.getFirst();
    }

    private static SenderEvidence findIntegrationSender(
            Trees trees,
            Elements elements,
            Config config) {
        TypeElement sender = requiredType(elements, config.integrationSender(), null);
        ExecutableElement method = requiredMethod(sender, config.integrationSenderMethod());
        if (method.getParameters().size() != 1
                || !method.getParameters().getFirst().asType().toString().equals(config.outboxEventEntity())) {
            throw new IllegalStateException("Configured integration sender must accept the outbox entity");
        }
        VariableElement eventParameter = method.getParameters().getFirst();
        List<SourceLocation> publications = new ArrayList<>();

        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitEnhancedForLoop(EnhancedForLoopTree loop, Void unused) {
                if (!(loop.getExpression() instanceof MethodInvocationTree destinationInvocation)) {
                    return super.visitEnhancedForLoop(loop, unused);
                }
                TreePath destinationInvocationPath = new TreePath(getCurrentPath(), destinationInvocation);
                ExecutableElement destinationMethod = executableAt(trees, destinationInvocationPath);
                if (destinationMethod == null
                        || !ownerName(destinationMethod).equals(config.integrationDestinationResolver())
                        || !destinationMethod.getSimpleName().contentEquals(config.integrationDestinationMethod())
                        || destinationInvocation.getArguments().size() != 1
                        || trees.getElement(new TreePath(
                                destinationInvocationPath,
                                destinationInvocation.getArguments().getFirst())) != eventParameter) {
                    return super.visitEnhancedForLoop(loop, unused);
                }

                Element destinationVariable = trees.getElement(new TreePath(getCurrentPath(), loop.getVariable()));
                Map<Element, Boolean> envelopeVariables = new LinkedHashMap<>();
                new TreePathScanner<Void, Void>() {
                    @Override
                    public Void visitVariable(VariableTree variable, Void nestedUnused) {
                        if (variable.getInitializer() instanceof MethodInvocationTree invocation) {
                            TreePath invocationPath = new TreePath(getCurrentPath(), invocation);
                            ExecutableElement invoked = executableAt(trees, invocationPath);
                            if (invoked != null
                                    && ownerName(invoked).equals(config.integrationEnvelopeFactory())
                                    && invoked.getSimpleName().contentEquals(
                                            config.integrationEnvelopeFactoryMethod())
                                    && invocation.getArguments().size() == 2
                                    && trees.getElement(new TreePath(
                                            invocationPath,
                                            invocation.getArguments().get(0))) == eventParameter
                                    && trees.getElement(new TreePath(
                                            invocationPath,
                                            invocation.getArguments().get(1))) == destinationVariable) {
                                Element variableElement = trees.getElement(getCurrentPath());
                                if (variableElement != null) envelopeVariables.put(variableElement, true);
                            }
                        }
                        return super.visitVariable(variable, nestedUnused);
                    }

                    @Override
                    public Void visitMethodInvocation(MethodInvocationTree invocation, Void nestedUnused) {
                        TreePath invocationPath = getCurrentPath();
                        ExecutableElement invoked = executableAt(trees, invocationPath);
                        if (invoked != null
                                && ownerName(invoked).equals(config.integrationMessagePublisher())
                                && invoked.getSimpleName().contentEquals(
                                    config.integrationMessagePublishMethod())
                                && invocation.getArguments().size() == 1
                                && envelopeVariables.containsKey(trees.getElement(new TreePath(
                                    invocationPath,
                                    invocation.getArguments().getFirst())))) {
                            publications.add(locationOf(trees, invocationPath, config));
                        }
                        return super.visitMethodInvocation(invocation, nestedUnused);
                    }
                }.scan(new TreePath(getCurrentPath(), loop.getStatement()), null);
                return super.visitEnhancedForLoop(loop, unused);
            }
        }.scan(trees.getPath(method), null);

        if (publications.size() != 1) {
            throw new IllegalStateException("Could not prove the configured integration sender pipeline");
        }
        return new SenderEvidence(callerSignature(method), publications.getFirst());
    }

    private static SourceLocation proveInboxRouting(
            Trees trees,
            Elements elements,
            Config config) {
        TypeElement router = requiredType(elements, config.sqsRouter(), null);
        ExecutableElement routeMethod = requiredMethod(router, config.sqsRouterMethod());
        List<SourceLocation> claims = new ArrayList<>();
        List<ExecutableElement> delegatedMethods = new ArrayList<>();

        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree invocation, Void unused) {
                ExecutableElement invoked = executableAt(trees, getCurrentPath());
                if (invoked != null
                        && ownerName(invoked).equals(config.inboxRepository())
                        && invoked.getSimpleName().contentEquals(config.inboxClaimMethod())) {
                    claims.add(locationOf(trees, getCurrentPath(), config));
                }
                if (invoked != null
                        && ownerName(invoked).equals(config.sqsRouter())
                        && !invoked.equals(routeMethod)) {
                    delegatedMethods.add(invoked);
                }
                return super.visitMethodInvocation(invocation, unused);
            }
        }.scan(trees.getPath(routeMethod), null);

        boolean dispatchesToHandler = delegatedMethods.stream().distinct().anyMatch(method -> {
            final boolean[] found = { false };
            new TreePathScanner<Void, Void>() {
                @Override
                public Void visitMethodInvocation(MethodInvocationTree invocation, Void unused) {
                    ExecutableElement invoked = executableAt(trees, getCurrentPath());
                    if (invoked != null
                            && ownerName(invoked).equals(config.sqsHandlerInterface())
                            && invoked.getSimpleName().contentEquals(config.sqsHandleMethod())) {
                        found[0] = true;
                    }
                    return super.visitMethodInvocation(invocation, unused);
                }
            }.scan(trees.getPath(method), null);
            return found[0];
        });
        if (claims.size() != 1 || !dispatchesToHandler) {
            throw new IllegalStateException("Could not prove inbox-backed SQS routing");
        }
        return claims.getFirst();
    }

    private static List<IntegrationConsumerEvidence> findIntegrationConsumers(
            Trees trees,
            Elements elements,
            Types types,
            Config config,
            SourceLocation inboxSource) {
        TypeElement configuration = requiredType(elements, config.sqsConfiguration(), null);
        TypeElement handlerInterface = requiredType(elements, config.sqsHandlerInterface(), null);
        List<IntegrationConsumerEvidence> consumers = new ArrayList<>();
        for (Element enclosed : configuration.getEnclosedElements()) {
            if (!(enclosed instanceof ExecutableElement method)
                    || !types.isAssignable(
                            types.erasure(method.getReturnType()),
                            types.erasure(handlerInterface.asType()))) {
                continue;
            }
            new TreePathScanner<Void, Void>() {
                @Override
                public Void visitNewClass(NewClassTree newClass, Void unused) {
                    TypeMirror constructed = trees.getTypeMirror(
                            new TreePath(getCurrentPath(), newClass.getIdentifier()));
                    if (constructed != null
                            && types.isAssignable(types.erasure(constructed), types.erasure(handlerInterface.asType()))
                            && newClass.getArguments().size() >= 2) {
                        String destination = constantString(
                                trees,
                                new TreePath(getCurrentPath(), newClass.getArguments().get(0)));
                        String eventType = constantString(
                                trees,
                                new TreePath(getCurrentPath(), newClass.getArguments().get(1)));
                        if (destination != null && eventType != null) {
                            consumers.add(new IntegrationConsumerEvidence(
                                    callerSignature(method),
                                    destination,
                                    eventType,
                                    true,
                                    inboxSource,
                                    locationOf(trees, method, config)));
                        }
                    }
                    return super.visitNewClass(newClass, unused);
                }
            }.scan(trees.getPath(method), null);
        }
        return consumers;
    }

    private static ProjectionSliceEvidence analyzeProjectionSlice(
            Trees trees,
            Elements elements,
            Types types,
            DiagnosticCollector<JavaFileObject> diagnostics,
            Config config) {
        if (config.projectionHandler() == null) return null;

        TypeElement handler = requiredType(elements, config.projectionHandler(), diagnostics);
        ExecutableElement method = requiredMethod(handler, config.projectionHandlerMethod());
        if (method.getParameters().size() != 1) {
            throw new IllegalStateException("Configured projection handler must accept exactly one event");
        }
        TypeElement domainEvent = requiredType(elements, config.domainEvent(), diagnostics);
        TypeMirror eventType = method.getParameters().getFirst().asType();
        if (!types.isAssignable(types.erasure(eventType), types.erasure(domainEvent.asType()))) {
            throw new IllegalStateException("Configured projection handler parameter must be a DomainEvent");
        }

        TypeElement repository = requiredType(elements, config.projectionRepository(), diagnostics);
        TypeElement publisher = config.projectionSyncPublisher() == null
                ? null : requiredType(elements, config.projectionSyncPublisher(), diagnostics);
        TypeElement syncEvent = config.projectionSyncEvent() == null
                ? null : requiredType(elements, config.projectionSyncEvent(), diagnostics);
        TreePath methodPath = trees.getPath(method);
        VariableElement eventParameter = method.getParameters().getFirst();
        List<SourceLocation> mutations = new ArrayList<>();
        List<ProjectionSyncEvidence> syncs = new ArrayList<>();

        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree invocation, Void unused) {
                TreePath invocationPath = getCurrentPath();
                ExecutableElement invoked = executableAt(trees, invocationPath);
                if (invoked != null
                        && ownerName(invoked).equals(repository.getQualifiedName().toString())
                        && invoked.getSimpleName().contentEquals(config.projectionMutationMethod())
                        && invocation.getArguments().size() == 1
                        && trees.getElement(new TreePath(
                                invocationPath,
                                invocation.getArguments().getFirst())) == eventParameter) {
                    mutations.add(locationOf(trees, invocationPath, config));
                }

                if (publisher != null && invoked != null
                        && ownerName(invoked).equals(publisher.getQualifiedName().toString())
                        && invoked.getSimpleName().contentEquals(config.projectionSyncPublishMethod())
                        && invocation.getArguments().size() == 1) {
                    TreePath argumentPath = new TreePath(invocationPath, invocation.getArguments().getFirst());
                    if (argumentPath.getLeaf() instanceof MethodInvocationTree factoryInvocation) {
                        ExecutableElement factory = executableAt(trees, argumentPath);
                        if (syncEvent != null && factory != null
                                && ownerName(factory).equals(syncEvent.getQualifiedName().toString())
                                && factory.getSimpleName().contentEquals(config.projectionSyncFactoryMethod())
                                && factoryInvocation.getArguments().size() > config.projectionSyncProjectionArgumentIndex()
                                && factoryInvocation.getArguments().size() > config.projectionSyncScopeArgumentIndex()) {
                            String projection = constantString(
                                    trees,
                                    new TreePath(
                                            argumentPath,
                                            factoryInvocation.getArguments()
                                                    .get(config.projectionSyncProjectionArgumentIndex())));
                            String scope = constantString(
                                    trees,
                                    new TreePath(
                                            argumentPath,
                                            factoryInvocation.getArguments()
                                                    .get(config.projectionSyncScopeArgumentIndex())));
                            if (projection != null && scope != null) {
                                syncs.add(new ProjectionSyncEvidence(
                                        projection,
                                        scope,
                                        locationOf(trees, invocationPath, config)));
                            }
                        }
                    }
                }
                return super.visitMethodInvocation(invocation, unused);
            }
        }.scan(methodPath, null);

        if (mutations.size() != 1 || (publisher != null && syncs.size() != 1)) {
            throw new IllegalStateException(
                    "Could not prove one direct projection mutation and configured projection-sync publication");
        }
        ProjectionSyncEvidence sync = syncs.isEmpty() ? null : syncs.getFirst();
        if (config.projectionState() == null && sync == null) {
            throw new IllegalStateException("Projection requires an explicit state id or proven sync contract");
        }
        String projection = config.projectionState() == null ? sync.projection() : config.projectionState();
        if (sync != null && !sync.projection().equals(projection)) {
            throw new IllegalStateException("Configured projectionState does not match projection-sync contract");
        }
        return new ProjectionSliceEvidence(List.of(new ProjectionUpdateEvidence(
                callerSignature(method),
                eventType.toString(),
                projection,
                sync == null ? null : sync.scope(),
                locationOf(trees, method, config),
                mutations.getFirst(),
                sync == null ? null : sync.source())));
    }

    private static ScheduledSliceEvidence analyzeScheduledSlice(
            Trees trees,
            Elements elements,
            DiagnosticCollector<JavaFileObject> diagnostics,
            Config config) {
        if (config.scheduledHandler() == null) return null;
        TypeElement handler = requiredType(elements, config.scheduledHandler(), diagnostics);
        ExecutableElement method = requiredMethod(handler, config.scheduledMethod());
        boolean scheduled = method.getAnnotationMirrors().stream()
                .map(annotation -> annotation.getAnnotationType().asElement())
                .filter(TypeElement.class::isInstance)
                .map(TypeElement.class::cast)
                .anyMatch(annotation -> annotation.getQualifiedName().contentEquals(config.scheduledAnnotation()));
        if (!scheduled) {
            throw new IllegalStateException("Configured scheduled method does not carry annotation "
                    + config.scheduledAnnotation());
        }
        return new ScheduledSliceEvidence(List.of(new ScheduledHandlerEvidence(
                handler.getQualifiedName().toString(),
                callerSignature(method).substring(callerSignature(method).indexOf('#') + 1),
                locationOf(trees, method, config))));
    }

    private static ExternalSliceEvidence analyzeExternalSlice(
            Trees trees,
            Elements elements,
            Types types,
            DiagnosticCollector<JavaFileObject> diagnostics,
            Config config,
            List<InvocationEvidence> providerInvocations) {
        if (config.externalConfiguration() == null) return null;

        TypeElement port = requiredType(elements, config.provider(), diagnostics);
        TypeElement configuration = requiredType(elements, config.externalConfiguration(), diagnostics);
        ExecutableElement factory = requiredMethod(configuration, config.externalFactoryMethod());
        TypeElement adapter = requiredType(elements, config.externalAdapter(), diagnostics);
        if (!types.isAssignable(types.erasure(adapter.asType()), types.erasure(port.asType()))) {
            throw new IllegalStateException("Configured external adapter must implement the configured port");
        }
        if (!types.isAssignable(types.erasure(factory.getReturnType()), types.erasure(port.asType()))) {
            throw new IllegalStateException("Configured external factory must return the configured port");
        }

        final boolean[] constructsAdapter = { false };
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitNewClass(NewClassTree newClass, Void unused) {
                TypeMirror constructed = trees.getTypeMirror(new TreePath(getCurrentPath(), newClass.getIdentifier()));
                if (constructed != null && constructed.toString().equals(adapter.getQualifiedName().toString())) {
                    constructsAdapter[0] = true;
                }
                return super.visitNewClass(newClass, unused);
            }
        }.scan(trees.getPath(factory), null);
        if (!constructsAdapter[0]) {
            throw new IllegalStateException("Configured external factory must construct the configured adapter");
        }

        TypeElement processBuilder = requiredType(elements, config.externalProcessBuilder(), diagnostics);
        ExecutableElement adapterMethod = requiredMethod(adapter, config.externalAdapterMethod());
        List<SourceLocation> starts = new ArrayList<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree invocation, Void unused) {
                ExecutableElement invoked = executableAt(trees, getCurrentPath());
                if (invoked != null
                        && ownerName(invoked).equals(processBuilder.getQualifiedName().toString())
                        && invoked.getSimpleName().contentEquals(config.externalProcessStartMethod())) {
                    starts.add(locationOf(trees, getCurrentPath(), config));
                }
                return super.visitMethodInvocation(invocation, unused);
            }
        }.scan(trees.getPath(adapterMethod), null);
        if (starts.size() != 1) {
            throw new IllegalStateException("Could not prove one configured local-process execution boundary");
        }

        List<InvocationEvidence> calls = providerInvocations.stream()
                .filter(invocation -> invocation.caller().startsWith(config.externalHandler() + "#"))
                .toList();
        if (calls.size() != 1) {
            throw new IllegalStateException("Could not prove configured external handler invocation: handler="
                    + config.externalHandler() + "; port=" + config.provider() + "; method=" + config.providerMethod());
        }
        InvocationEvidence call = calls.getFirst();
        return new ExternalSliceEvidence(List.of(new ExternalCallEvidence(
                call.caller(),
                port.getQualifiedName().toString(),
                adapter.getQualifiedName().toString(),
                "local-process:" + processBuilder.getQualifiedName(),
                call.source(),
                locationOf(trees, factory, config),
                locationOf(trees, adapter, config),
                starts.getFirst())));
    }

    private static List<DestinationEvidence> returnedStringConstants(
            Trees trees,
            TreePath statementPath,
            Config config) {
        List<DestinationEvidence> result = new ArrayList<>();
        new TreePathScanner<Void, Void>() {
            @Override
            public Void visitReturn(ReturnTree returnTree, Void unused) {
                if (returnTree.getExpression() instanceof MethodInvocationTree invocation) {
                    for (ExpressionTree argument : invocation.getArguments()) {
                        TreePath argumentPath = new TreePath(getCurrentPath(), argument);
                        String value = constantString(trees, argumentPath);
                        if (value != null) {
                            result.add(new DestinationEvidence(
                                    value,
                                    locationOf(trees, argumentPath, config)));
                        }
                    }
                }
                return super.visitReturn(returnTree, unused);
            }
        }.scan(statementPath, null);
        return result;
    }

    private static boolean hasMatchingAggregateAncestor(
            Trees trees,
            TreePath path,
            Map<Element, String> roles,
            String eventType,
            String aggregateType) {
        for (TreePath candidate = path.getParentPath(); candidate != null; candidate = candidate.getParentPath()) {
            if (!(candidate.getLeaf() instanceof IfTree ifTree)) continue;
            TreePath conditionPath = new TreePath(candidate, ifTree.getCondition());
            if (referencesRole(trees, conditionPath, roles, "aggregateType")
                    && Boolean.TRUE.equals(evaluateKnownStringCondition(
                            trees,
                            conditionPath,
                            roles,
                            eventType,
                            aggregateType))) {
                return true;
            }
        }
        return false;
    }

    private static Boolean evaluateKnownStringCondition(
            Trees trees,
            TreePath path,
            Map<Element, String> roles,
            String eventType,
            String aggregateType) {
        Tree leaf = unwrap(path.getLeaf());
        TreePath unwrappedPath = leaf == path.getLeaf() ? path : new TreePath(path, leaf);
        if (leaf instanceof BinaryTree binary) {
            Boolean left = evaluateKnownStringCondition(
                    trees,
                    new TreePath(unwrappedPath, binary.getLeftOperand()),
                    roles,
                    eventType,
                    aggregateType);
            Boolean right = evaluateKnownStringCondition(
                    trees,
                    new TreePath(unwrappedPath, binary.getRightOperand()),
                    roles,
                    eventType,
                    aggregateType);
            if (binary.getKind() == Tree.Kind.CONDITIONAL_AND) {
                if (Boolean.FALSE.equals(left) || Boolean.FALSE.equals(right)) return false;
                return left == null || right == null ? null : true;
            }
            if (binary.getKind() == Tree.Kind.CONDITIONAL_OR) {
                if (Boolean.TRUE.equals(left) || Boolean.TRUE.equals(right)) return true;
                return left == null || right == null ? null : false;
            }
        }
        if (leaf instanceof UnaryTree unary && unary.getKind() == Tree.Kind.LOGICAL_COMPLEMENT) {
            Boolean value = evaluateKnownStringCondition(
                    trees,
                    new TreePath(unwrappedPath, unary.getExpression()),
                    roles,
                    eventType,
                    aggregateType);
            return value == null ? null : !value;
        }
        if (!(leaf instanceof MethodInvocationTree invocation)
                || !(invocation.getMethodSelect() instanceof MemberSelectTree select)
                || invocation.getArguments().size() != 1) {
            return null;
        }
        ExecutableElement method = executableAt(trees, unwrappedPath);
        if (method == null || !ownerName(method).equals("java.lang.String")) return null;

        TreePath receiverPath = new TreePath(unwrappedPath, select.getExpression());
        TreePath argumentPath = new TreePath(unwrappedPath, invocation.getArguments().getFirst());
        String receiverRole = roles.get(trees.getElement(receiverPath));
        String argumentRole = roles.get(trees.getElement(argumentPath));
        String receiverConstant = constantString(trees, receiverPath);
        String argumentConstant = constantString(trees, argumentPath);
        String methodName = method.getSimpleName().toString();

        if (methodName.equals("endsWith") && receiverRole != null && argumentConstant != null) {
            String known = receiverRole.equals("eventType") ? eventType : aggregateType;
            return known.endsWith(argumentConstant);
        }
        if (methodName.equals("equals")) {
            if (receiverRole != null && argumentConstant != null) {
                String known = receiverRole.equals("eventType") ? eventType : aggregateType;
                return known.equals(argumentConstant);
            }
            if (receiverConstant != null && argumentRole != null) {
                String known = argumentRole.equals("eventType") ? eventType : aggregateType;
                return receiverConstant.equals(known);
            }
        }
        return null;
    }

    private static boolean referencesRole(
            Trees trees,
            TreePath path,
            Map<Element, String> roles,
            String role) {
        final boolean[] found = { false };
        new TreePathScanner<Void, Void>() {
            @Override
            public Void scan(Tree tree, Void unused) {
                if (tree == null || found[0]) return null;
                return super.scan(tree, unused);
            }

            @Override
            public Void visitIdentifier(com.sun.source.tree.IdentifierTree identifier, Void unused) {
                if (role.equals(roles.get(trees.getElement(getCurrentPath())))) found[0] = true;
                return super.visitIdentifier(identifier, unused);
            }
        }.scan(path, null);
        return found[0];
    }

    private static ExpressionTree unwrap(ExpressionTree expression) {
        ExpressionTree current = expression;
        while (current instanceof ParenthesizedTree parenthesized) {
            current = parenthesized.getExpression();
        }
        return current;
    }

    private static Tree unwrap(Tree tree) {
        return tree instanceof ExpressionTree expression ? unwrap(expression) : tree;
    }

    private static String constantString(Trees trees, TreePath path) {
        if (path.getLeaf() instanceof LiteralTree literal && literal.getValue() instanceof String value) {
            return value;
        }
        Element element = trees.getElement(path);
        return element instanceof VariableElement variable && variable.getConstantValue() instanceof String value
                ? value
                : null;
    }

    private static ExecutableElement executableAt(Trees trees, TreePath path) {
        Element element = trees.getElement(path);
        return element instanceof ExecutableElement executable ? executable : null;
    }

    private static String ownerName(ExecutableElement method) {
        return method.getEnclosingElement() instanceof TypeElement owner
                ? owner.getQualifiedName().toString()
                : "";
    }

    private static ExecutableElement requiredMethod(TypeElement type, String methodName) {
        List<ExecutableElement> methods = type.getEnclosedElements().stream()
                .filter(ExecutableElement.class::isInstance)
                .map(ExecutableElement.class::cast)
                .filter(method -> method.getSimpleName().contentEquals(methodName))
                .toList();
        if (methods.size() != 1) {
            throw new IllegalStateException(
                    "Expected exactly one " + type.getQualifiedName() + "#" + methodName);
        }
        return methods.getFirst();
    }

    private static String executableSignature(ExecutableElement executable) {
        return executable.getSimpleName() + "(" + executable.getParameters().stream()
                .map(parameter -> parameter.asType().toString())
                .reduce((left, right) -> left + "," + right)
                .orElse("") + ")";
    }

    private static String callerSignature(ExecutableElement executable) {
        TypeElement owner = (TypeElement) executable.getEnclosingElement();
        return owner.getQualifiedName() + "#" + executableSignature(executable);
    }

    private static SourceLocation locationOf(Trees trees, Element element, Config config) {
        TreePath path = trees.getPath(element);
        if (path == null) {
            throw new IllegalStateException("No source location for " + element);
        }
        return locationOf(trees, path, config);
    }

    private static SourceLocation locationOf(Trees trees, TreePath path, Config config) {
        CompilationUnitTree unit = path.getCompilationUnit();
        long position = trees.getSourcePositions().getStartPosition(unit, path.getLeaf());
        long line = unit.getLineMap().getLineNumber(position);
        Path source = Path.of(unit.getSourceFile().toUri()).toAbsolutePath().normalize();
        return locationOf(source, line, config);
    }

    private static SourceLocation locationOf(Path source, long line, Config config) {
        Path normalizedSource = source.toAbsolutePath().normalize();
        Path root = config.sourceRoot().toAbsolutePath().normalize();
        String file = normalizedSource.startsWith(root)
                ? root.relativize(normalizedSource).toString()
                : normalizedSource.toString();
        boolean inScanScope = config.scanSources().stream()
                .map(path -> path.toAbsolutePath().normalize())
                .anyMatch(normalizedSource::equals);
        return new SourceLocation(file, line, inScanScope);
    }

    private static List<String> diagnosticMessages(DiagnosticCollector<JavaFileObject> diagnostics) {
        return diagnostics.getDiagnostics().stream()
                .filter(diagnostic -> diagnostic.getKind() == Diagnostic.Kind.ERROR)
                .map(diagnostic -> diagnostic.getMessage(null))
                .toList();
    }

    private static List<DiagnosticEvidence> diagnosticEvidence(
            DiagnosticCollector<JavaFileObject> diagnostics,
            Config config) {
        return diagnostics.getDiagnostics().stream()
                .map(diagnostic -> {
                    SourceLocation source = diagnostic.getSource() == null
                            ? null
                            : locationOf(
                                    Path.of(diagnostic.getSource().toUri()),
                                    diagnostic.getLineNumber(),
                                    config);
                    return new DiagnosticEvidence(
                            diagnostic.getKind().name(),
                            diagnostic.getMessage(null),
                            source);
                })
                .toList();
    }

    private record Config(
            String release,
            Path sourceRoot,
            String classpath,
            String domainEvent,
            String eventHandler,
            String handler,
            String provider,
            String providerMethod,
            String domainEventPublisher,
            String domainEventPublishMethod,
            String command,
            String commandMarker,
            String commandHandlerInterface,
            String commandHandler,
            String controller,
            String controllerMethod,
            String requestMappingAnnotation,
            String httpMethodMappingAnnotation,
            String httpMethod,
            String commandBus,
            String commandDispatchMethod,
            String integrationProducerEvent,
            String outboxMetadataContributor,
            String outboxMetadata,
            String integrationDestinationResolver,
            String integrationDestinationMethod,
            String outboxEventEntity,
            String aggregateTypeGetter,
            String eventTypeGetter,
            String integrationTypeCatalog,
            String integrationVersionMethod,
            String integrationSender,
            String integrationSenderMethod,
            String integrationEnvelopeFactory,
            String integrationEnvelopeFactoryMethod,
            String integrationMessagePublisher,
            String integrationMessagePublishMethod,
            String sqsHandlerInterface,
            String sqsConfiguration,
            String sqsRouter,
            String sqsRouterMethod,
            String inboxRepository,
            String inboxClaimMethod,
            String sqsHandleMethod,
            String projectionHandler,
            String projectionHandlerMethod,
            String projectionRepository,
            String projectionMutationMethod,
            String projectionState,
            String projectionSyncPublisher,
            String projectionSyncPublishMethod,
            String projectionSyncEvent,
            String projectionSyncFactoryMethod,
            int projectionSyncProjectionArgumentIndex,
            int projectionSyncScopeArgumentIndex,
            String externalConfiguration,
            String externalFactoryMethod,
            String externalAdapter,
            String externalAdapterMethod,
            String externalHandler,
            String externalProcessBuilder,
            String externalProcessStartMethod,
            String scheduledHandler,
            String scheduledMethod,
            String scheduledAnnotation,
            List<Path> sources,
            List<Path> scanSources,
            List<String> events) {

        private static Config parse(String[] arguments) {
            Map<String, List<String>> options = new LinkedHashMap<>();
            for (int index = 0; index < arguments.length; index += 2) {
                if (index + 1 >= arguments.length || !arguments[index].startsWith("--")) {
                    throw new IllegalArgumentException("Expected --option value pairs");
                }
                options.computeIfAbsent(arguments[index], ignored -> new ArrayList<>()).add(arguments[index + 1]);
            }

            List<Path> sources = many(options, "--source").stream().map(Path::of).toList();
            List<String> configuredScanSources = optionalMany(options, "--scan-source");
            List<Path> scanSources = configuredScanSources.isEmpty()
                    ? sources
                    : configuredScanSources.stream().map(Path::of).toList();

            return new Config(
                    single(options, "--release"),
                    Path.of(single(options, "--source-root")),
                    optional(options, "--classpath"),
                    single(options, "--domain-event"),
                    single(options, "--event-handler"),
                    single(options, "--handler"),
                    single(options, "--provider"),
                    single(options, "--provider-method"),
                    optional(options, "--domain-event-publisher"),
                    optional(options, "--domain-event-publish-method"),
                    optional(options, "--command"),
                    optional(options, "--command-marker"),
                    optional(options, "--command-handler-interface"),
                    optional(options, "--command-handler"),
                    optional(options, "--controller"),
                    optional(options, "--controller-method"),
                    optional(options, "--request-mapping-annotation"),
                    optional(options, "--http-method-mapping-annotation"),
                    optional(options, "--http-method"),
                    optional(options, "--command-bus"),
                    optional(options, "--command-dispatch-method"),
                    optional(options, "--integration-producer-event"),
                    optional(options, "--outbox-metadata-contributor"),
                    optional(options, "--outbox-metadata"),
                    optional(options, "--integration-destination-resolver"),
                    optional(options, "--integration-destination-method"),
                    optional(options, "--outbox-event-entity"),
                    optional(options, "--aggregate-type-getter"),
                    optional(options, "--event-type-getter"),
                    optional(options, "--integration-type-catalog"),
                    optional(options, "--integration-version-method"),
                    optional(options, "--integration-sender"),
                    optional(options, "--integration-sender-method"),
                    optional(options, "--integration-envelope-factory"),
                    optional(options, "--integration-envelope-factory-method"),
                    optional(options, "--integration-message-publisher"),
                    optional(options, "--integration-message-publish-method"),
                    optional(options, "--sqs-handler-interface"),
                    optional(options, "--sqs-configuration"),
                    optional(options, "--sqs-router"),
                    optional(options, "--sqs-router-method"),
                    optional(options, "--inbox-repository"),
                    optional(options, "--inbox-claim-method"),
                    optional(options, "--sqs-handle-method"),
                    optional(options, "--projection-handler"),
                    optional(options, "--projection-handler-method"),
                    optional(options, "--projection-repository"),
                    optional(options, "--projection-mutation-method"),
                    optional(options, "--projection-state"),
                    optional(options, "--projection-sync-publisher"),
                    optional(options, "--projection-sync-publish-method"),
                    optional(options, "--projection-sync-event"),
                    optional(options, "--projection-sync-factory-method"),
                    optionalInt(options, "--projection-sync-projection-argument-index"),
                    optionalInt(options, "--projection-sync-scope-argument-index"),
                    optional(options, "--external-configuration"),
                    optional(options, "--external-factory-method"),
                    optional(options, "--external-adapter"),
                    optional(options, "--external-adapter-method"),
                    optional(options, "--external-handler"),
                    optional(options, "--external-process-builder"),
                    optional(options, "--external-process-start-method"),
                    optional(options, "--scheduled-handler"),
                    optional(options, "--scheduled-method"),
                    optional(options, "--scheduled-annotation"),
                    sources,
                    scanSources,
                    many(options, "--event"));
        }

        private static String single(Map<String, List<String>> options, String name) {
            List<String> values = many(options, name);
            if (values.size() != 1) throw new IllegalArgumentException("Expected exactly one " + name);
            return values.getFirst();
        }

        private static String optional(Map<String, List<String>> options, String name) {
            List<String> values = options.getOrDefault(name, List.of());
            if (values.size() > 1) throw new IllegalArgumentException("Expected at most one " + name);
            return values.isEmpty() ? null : values.getFirst();
        }

        private static int optionalInt(Map<String, List<String>> options, String name) {
            List<String> values = options.getOrDefault(name, List.of());
            if (values.size() > 1) throw new IllegalArgumentException("Expected at most one " + name);
            return values.isEmpty() ? 0 : Integer.parseInt(values.getFirst());
        }

        private static List<String> many(Map<String, List<String>> options, String name) {
            List<String> values = options.getOrDefault(name, List.of());
            if (values.isEmpty()) throw new IllegalArgumentException("Expected at least one " + name);
            return values;
        }

        private static List<String> optionalMany(Map<String, List<String>> options, String name) {
            return options.getOrDefault(name, List.of());
        }
    }

    private record SourceLocation(String file, long line, boolean inScanScope) {
        private String toJson() {
            return "{\"file\":" + quote(file)
                    + ",\"line\":" + line
                    + ",\"inScanScope\":" + inScanScope + "}";
        }
    }

    private record DiagnosticEvidence(String kind, String message, SourceLocation source) {
        private String toJson() {
            return "{\"kind\":" + quote(kind)
                    + ",\"message\":" + quote(message)
                    + (source == null ? "" : ",\"source\":" + source.toJson())
                    + "}";
        }
    }

    private record TypeEvidence(
            String qualifiedName,
            boolean assignableToDomainEvent,
            SourceLocation source) {
        private String toJson() {
            return "{\"qualifiedName\":" + quote(qualifiedName)
                    + ",\"assignableToDomainEvent\":" + assignableToDomainEvent
                    + ",\"source\":" + source.toJson() + "}";
        }
    }

    private record HandlerEvidence(String qualifiedName, String eventType, SourceLocation source) {
        private String toJson() {
            return "{\"qualifiedName\":" + quote(qualifiedName)
                    + ",\"eventType\":" + quote(eventType)
                    + ",\"source\":" + source.toJson() + "}";
        }
    }

    private record InvocationEvidence(
            String owner,
            String method,
            String caller,
            SourceLocation source) {
        private String toJson() {
            return "{\"owner\":" + quote(owner)
                    + ",\"method\":" + quote(method)
                    + ",\"caller\":" + quote(caller)
                    + ",\"source\":" + source.toJson() + "}";
        }
    }

    private record PublicationEvidence(
            String owner,
            String method,
            String caller,
            String argumentType,
            SourceLocation source) {
        private String toJson() {
            return "{\"owner\":" + quote(owner)
                    + ",\"method\":" + quote(method)
                    + ",\"caller\":" + quote(caller)
                    + ",\"argumentType\":" + quote(argumentType)
                    + ",\"source\":" + source.toJson() + "}";
        }
    }

    private record CommandEvidence(
            String qualifiedName,
            boolean assignableToCommand,
            SourceLocation source) {
        private String toJson() {
            return "{\"qualifiedName\":" + quote(qualifiedName)
                    + ",\"assignableToCommand\":" + assignableToCommand
                    + ",\"source\":" + source.toJson() + "}";
        }
    }

    private record CommandHandlerEvidence(
            String qualifiedName,
            String commandType,
            SourceLocation source) {
        private String toJson() {
            return "{\"qualifiedName\":" + quote(qualifiedName)
                    + ",\"commandType\":" + quote(commandType)
                    + ",\"source\":" + source.toJson() + "}";
        }
    }

    private record HttpEndpointEvidence(
            String controller,
            String handler,
            String httpMethod,
            String path,
            SourceLocation source) {
        private String toJson() {
            return "{\"controller\":" + quote(controller)
                    + ",\"handler\":" + quote(handler)
                    + ",\"httpMethod\":" + quote(httpMethod)
                    + ",\"path\":" + quote(path)
                    + ",\"source\":" + source.toJson() + "}";
        }
    }

    private record CommandDispatchEvidence(
            String owner,
            String method,
            String caller,
            String argumentType,
            SourceLocation source) {
        private String toJson() {
            return "{\"owner\":" + quote(owner)
                    + ",\"method\":" + quote(method)
                    + ",\"caller\":" + quote(caller)
                    + ",\"argumentType\":" + quote(argumentType)
                    + ",\"source\":" + source.toJson() + "}";
        }
    }

    private record CommandSliceEvidence(
            CommandEvidence command,
            CommandHandlerEvidence handler,
            HttpEndpointEvidence endpoint,
            List<CommandDispatchEvidence> dispatches) {
    }

    private record DestinationEvidence(String destination, SourceLocation source) {
    }

    private record AggregateTypeEvidence(String aggregateType, SourceLocation source) {
    }

    private record StableTypeEvidence(String eventType, SourceLocation source) {
    }

    private record VersionEvidence(int version, SourceLocation source) {
    }

    private record SenderEvidence(String handler, SourceLocation source) {
    }

    private record IntegrationMappingEvidence(
            String producerEvent,
            String aggregateType,
            String destination,
            String eventType,
            int version,
            String sender,
            SourceLocation senderSource,
            SourceLocation aggregateSource,
            SourceLocation destinationSource,
            SourceLocation typeSource,
            SourceLocation versionSource) {
        private String toJson() {
            return "{\"producerEvent\":" + quote(producerEvent)
                    + ",\"aggregateType\":" + quote(aggregateType)
                    + ",\"destination\":" + quote(destination)
                    + ",\"eventType\":" + quote(eventType)
                    + ",\"version\":" + version
                    + ",\"sender\":" + quote(sender)
                    + ",\"senderSource\":" + senderSource.toJson()
                    + ",\"aggregateSource\":" + aggregateSource.toJson()
                    + ",\"destinationSource\":" + destinationSource.toJson()
                    + ",\"typeSource\":" + typeSource.toJson()
                    + ",\"versionSource\":" + versionSource.toJson()
                    + "}";
        }
    }

    private record IntegrationConsumerEvidence(
            String handler,
            String destination,
            String eventType,
            boolean inboxBacked,
            SourceLocation inboxSource,
            SourceLocation source) {
        private String toJson() {
            return "{\"handler\":" + quote(handler)
                    + ",\"destination\":" + quote(destination)
                    + ",\"eventType\":" + quote(eventType)
                    + ",\"inboxBacked\":" + inboxBacked
                    + ",\"inboxSource\":" + inboxSource.toJson()
                    + ",\"source\":" + source.toJson()
                    + "}";
        }
    }

    private record IntegrationSliceEvidence(
            List<IntegrationMappingEvidence> mappings,
            List<IntegrationConsumerEvidence> consumers) {
    }

    private record ProjectionSyncEvidence(
            String projection,
            String scope,
            SourceLocation source) {
    }

    private record ProjectionUpdateEvidence(
            String handler,
            String eventType,
            String projection,
            String scope,
            SourceLocation handlerSource,
            SourceLocation mutationSource,
            SourceLocation syncSource) {
        private String toJson() {
            return "{\"handler\":" + quote(handler)
                    + ",\"eventType\":" + quote(eventType)
                    + ",\"projection\":" + quote(projection)
                    + ",\"scope\":" + (scope == null ? "null" : quote(scope))
                    + ",\"handlerSource\":" + handlerSource.toJson()
                    + ",\"mutationSource\":" + mutationSource.toJson()
                    + ",\"syncSource\":" + (syncSource == null ? "null" : syncSource.toJson())
                    + "}";
        }
    }

    private record ProjectionSliceEvidence(List<ProjectionUpdateEvidence> updates) {
    }

    private record ExternalCallEvidence(
            String handler,
            String port,
            String adapter,
            String external,
            SourceLocation handlerSource,
            SourceLocation factorySource,
            SourceLocation adapterSource,
            SourceLocation externalSource) {
        private String toJson() {
            return "{\"handler\":" + quote(handler)
                    + ",\"port\":" + quote(port)
                    + ",\"adapter\":" + quote(adapter)
                    + ",\"external\":" + quote(external)
                    + ",\"handlerSource\":" + handlerSource.toJson()
                    + ",\"factorySource\":" + factorySource.toJson()
                    + ",\"adapterSource\":" + adapterSource.toJson()
                    + ",\"externalSource\":" + externalSource.toJson()
                    + "}";
        }
    }

    private record ExternalSliceEvidence(List<ExternalCallEvidence> calls) {
    }

    private record ScheduledHandlerEvidence(String handler, String method, SourceLocation source) {
        private String toJson() {
            return "{\"handler\":" + quote(handler)
                    + ",\"method\":" + quote(method)
                    + ",\"source\":" + source.toJson() + "}";
        }
    }

    private record ScheduledSliceEvidence(List<ScheduledHandlerEvidence> handlers) {
    }

    private record ProbeResult(
            List<TypeEvidence> types,
            HandlerEvidence handler,
            List<InvocationEvidence> providerInvocations,
            List<PublicationEvidence> domainEventPublications,
            CommandSliceEvidence commandSlice,
            IntegrationSliceEvidence integrationSlice,
            ProjectionSliceEvidence projectionSlice,
            ExternalSliceEvidence externalSlice,
            ScheduledSliceEvidence scheduledSlice,
            List<DiagnosticEvidence> diagnostics) {
        private String toJson() {
            return "{\"engine\":\"jdk-compiler-api\",\"types\":"
                    + jsonArray(types.stream().map(TypeEvidence::toJson).toList())
                    + ",\"handler\":" + handler.toJson()
                    + ",\"providerInvocations\":"
                    + jsonArray(providerInvocations.stream().map(InvocationEvidence::toJson).toList())
                    + ",\"domainEventPublications\":"
                    + jsonArray(domainEventPublications.stream().map(PublicationEvidence::toJson).toList())
                    + ",\"command\":" + (commandSlice == null ? "null" : commandSlice.command().toJson())
                    + ",\"commandHandler\":" + (commandSlice == null ? "null" : commandSlice.handler().toJson())
                    + ",\"httpEndpoint\":" + (commandSlice == null ? "null" : commandSlice.endpoint().toJson())
                    + ",\"commandDispatches\":" + (commandSlice == null
                            ? "[]"
                            : jsonArray(commandSlice.dispatches().stream().map(CommandDispatchEvidence::toJson).toList()))
                    + ",\"integrationEventMappings\":" + (integrationSlice == null
                            ? "[]"
                            : jsonArray(integrationSlice.mappings().stream()
                                    .map(IntegrationMappingEvidence::toJson).toList()))
                    + ",\"integrationEventConsumers\":" + (integrationSlice == null
                            ? "[]"
                            : jsonArray(integrationSlice.consumers().stream()
                                    .map(IntegrationConsumerEvidence::toJson).toList()))
                    + ",\"projectionUpdates\":" + (projectionSlice == null
                            ? "[]"
                            : jsonArray(projectionSlice.updates().stream()
                                    .map(ProjectionUpdateEvidence::toJson).toList()))
                    + ",\"externalCalls\":" + (externalSlice == null
                            ? "[]"
                            : jsonArray(externalSlice.calls().stream()
                                    .map(ExternalCallEvidence::toJson).toList()))
                    + ",\"scheduledHandlers\":" + (scheduledSlice == null
                            ? "[]"
                            : jsonArray(scheduledSlice.handlers().stream()
                                    .map(ScheduledHandlerEvidence::toJson).toList()))
                    + ",\"diagnostics\":" + jsonArray(diagnostics.stream().map(DiagnosticEvidence::toJson).toList())
                    + "}";
        }
    }

    private static String jsonArray(List<String> values) {
        return "[" + String.join(",", values) + "]";
    }

    private static String quote(String value) {
        StringBuilder escaped = new StringBuilder("\"");
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            switch (character) {
                case '\\' -> escaped.append("\\\\");
                case '\"' -> escaped.append("\\\"");
                case '\n' -> escaped.append("\\n");
                case '\r' -> escaped.append("\\r");
                case '\t' -> escaped.append("\\t");
                default -> escaped.append(character);
            }
        }
        return escaped.append('\"').toString();
    }
}
