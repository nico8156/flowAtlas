import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
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

import javax.lang.model.element.Element;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.TypeElement;
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

            return new ProbeResult(
                    typeEvidence,
                    handlerEvidence,
                    invocations,
                    publications,
                    diagnosticEvidence(diagnostics, config));
        }
    }

    private static TypeElement requiredType(
            Elements elements,
            String qualifiedName,
            DiagnosticCollector<JavaFileObject> diagnostics) {
        TypeElement result = elements.getTypeElement(qualifiedName);
        if (result != null) return result;
        throw new IllegalStateException(
                "Could not resolve " + qualifiedName + ". Diagnostics: " + String.join(" | ", diagnosticMessages(diagnostics)));
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

    private record ProbeResult(
            List<TypeEvidence> types,
            HandlerEvidence handler,
            List<InvocationEvidence> providerInvocations,
            List<PublicationEvidence> domainEventPublications,
            List<DiagnosticEvidence> diagnostics) {
        private String toJson() {
            return "{\"engine\":\"jdk-compiler-api\",\"types\":"
                    + jsonArray(types.stream().map(TypeEvidence::toJson).toList())
                    + ",\"handler\":" + handler.toJson()
                    + ",\"providerInvocations\":"
                    + jsonArray(providerInvocations.stream().map(InvocationEvidence::toJson).toList())
                    + ",\"domainEventPublications\":"
                    + jsonArray(domainEventPublications.stream().map(PublicationEvidence::toJson).toList())
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
