#!/usr/bin/env node
/**
 * TypeScript-driven EasyEDA API query and validation CLI.
 *
 * The target plugin project's installed @jlceda/pro-api-types package is the
 * source of truth. Markdown resources remain useful semantic notes, but are not
 * used to prove API existence or signatures here.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const SCHEMA_VERSION = 4;

const ExitCode = {
  OK: 0,
  NOT_FOUND: 2,
  TYPE_ERROR: 3,
  ENV_ERROR: 4,
};

const Severity = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

function main() {
  const argv = process.argv.slice(2);
  const command = argv.shift();
  const opts = parseArgs(argv);

  if (!command || opts.help) {
    printUsage();
    process.exit(command ? ExitCode.OK : ExitCode.ENV_ERROR);
  }

  run(command, opts)
    .then(({ exitCode = ExitCode.OK, data }) => {
      if (opts.format === 'json') {
        process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
      }
      else if (typeof data === 'string') {
        process.stdout.write(`${data}\n`);
      }
      else {
        process.stdout.write(`${formatMarkdown(command, data)}\n`);
      }
      process.exit(exitCode);
    })
    .catch((err) => {
      const payload = {
        error: {
          message: err.message,
          code: err.exitCode || ExitCode.ENV_ERROR,
          details: err.details || null,
        },
      };
      if (opts.format === 'json') {
        process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
      }
      else {
        process.stderr.write(`[ERROR] ${err.message}\n`);
        if (err.details) process.stderr.write(`${err.details}\n`);
      }
      process.exit(err.exitCode || ExitCode.ENV_ERROR);
    });
}

async function run(command, opts) {
  opts.project = path.resolve(opts.project || process.cwd());
  opts.format = opts.format || (opts.json ? 'json' : 'markdown');

  if (command === 'doctor') {
    const ctx = loadContext(opts.project);
    const graph = loadGraph(ctx);
    return { data: { ...publicContext(ctx), counts: countGraph(graph) } };
  }

  if (command === 'search') {
    const ctx = loadContext(opts.project);
    const graph = loadGraph(ctx);
    const results = searchGraph(graph, opts);
    return { exitCode: results.length ? ExitCode.OK : ExitCode.NOT_FOUND, data: { context: publicContext(ctx), results } };
  }

  if (command === 'inspect') {
    const ctx = loadContext(opts.project);
    const graph = loadGraph(ctx);
    const result = inspectGraph(graph, opts);
    return { exitCode: result ? ExitCode.OK : ExitCode.NOT_FOUND, data: { context: publicContext(ctx), result } };
  }

  if (command === 'lint') {
    const ctx = loadContext(opts.project);
    loadGraph(ctx);
    const result = lintProject(ctx, opts);
    return { exitCode: result.errorCount ? ExitCode.TYPE_ERROR : ExitCode.OK, data: result };
  }

  throw envError(`Unknown command "${command}"`);
}

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--closure') opts.closure = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) opts[key] = true;
      else opts[key] = argv[++i];
    }
    else opts._.push(arg);
  }
  return opts;
}

function printUsage() {
  process.stdout.write([
    'Usage:',
    '  node scripts/eda-api.js doctor --project <path> [--format markdown|json]',
    '  node scripts/eda-api.js search --name <keyword> | --member <method> [--project <path>]',
    '  node scripts/eda-api.js inspect --mount <edaMount> [--member <name>] [--closure] [--project <path>]',
    '  node scripts/eda-api.js lint --project <path> <src...> [--format markdown|json]',
  ].join('\n') + '\n');
}

function loadContext(projectRoot) {
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    throw envError(`Project path does not exist or is not a directory: ${projectRoot}`);
  }

  const targetRequire = createRequire(path.join(projectRoot, 'package.json'));
  const apiPackagePath = resolveFromTarget(targetRequire, projectRoot, '@jlceda/pro-api-types/package.json');
  const apiPackage = readJson(apiPackagePath);
  const declarationPath = path.resolve(path.dirname(apiPackagePath), apiPackage.typings || apiPackage.types || 'index.d.ts');
  if (!fs.existsSync(declarationPath)) {
    throw envError(`@jlceda/pro-api-types declaration file not found: ${declarationPath}`);
  }

  const tsPath = resolveFromTarget(targetRequire, projectRoot, 'typescript');
  const ts = require(tsPath);
  const tsPackagePath = resolveFromTarget(targetRequire, projectRoot, 'typescript/package.json');
  const tsPackage = readJson(tsPackagePath);
  const declarationText = fs.readFileSync(declarationPath, 'utf8');
  const declarationHash = sha256(declarationText);

  return {
    projectRoot,
    targetRequire,
    ts,
    apiPackagePath,
    apiPackageVersion: apiPackage.version || 'unknown',
    declarationPath,
    declarationHash,
    typescriptPath: tsPath,
    typescriptVersion: tsPackage.version || ts.version || 'unknown',
    cachePath: path.join(projectRoot, 'node_modules', '.cache', 'extension-dev-skill', `api-${SCHEMA_VERSION}-${apiPackage.version || 'unknown'}-${declarationHash.slice(0, 16)}-${(tsPackage.version || 'unknown').replace(/[^\w.-]/g, '_')}.json`),
  };
}

function resolveFromTarget(targetRequire, projectRoot, specifier) {
  try {
    const resolved = targetRequire.resolve(specifier);
    const relative = path.relative(projectRoot, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw envError(`Resolved ${specifier} outside the target project: ${resolved}`);
    }
    return resolved;
  }
  catch (err) {
    if (err.exitCode) throw err;
    throw envError(`Cannot resolve ${specifier} from target project ${projectRoot}. Run npm install in the plugin project first.`);
  }
}

function loadGraph(ctx) {
  const cached = readCache(ctx);
  if (cached) return cached;

  const graph = buildGraph(ctx);
  writeCache(ctx, graph);
  return graph;
}

function readCache(ctx) {
  try {
    if (!fs.existsSync(ctx.cachePath)) return null;
    const parsed = readJson(ctx.cachePath);
    if (
      parsed.meta &&
      parsed.meta.schemaVersion === SCHEMA_VERSION &&
      parsed.meta.packageVersion === ctx.apiPackageVersion &&
      parsed.meta.declarationHash === ctx.declarationHash &&
      parsed.meta.typescriptVersion === ctx.typescriptVersion
    ) {
      return parsed;
    }
  }
  catch {
    return null;
  }
  return null;
}

function writeCache(ctx, graph) {
  try {
    fs.mkdirSync(path.dirname(ctx.cachePath), { recursive: true });
    fs.writeFileSync(ctx.cachePath, JSON.stringify(graph, null, 2), 'utf8');
  }
  catch {
    graph.meta.cache = { writable: false, reason: 'Cache directory is not writable; parsed in memory.' };
  }
}

function buildGraph(ctx) {
  const ts = ctx.ts;
  const compilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
  };
  const program = ts.createProgram([ctx.declarationPath], compilerOptions);
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(ctx.declarationPath);
  if (!sf) throw envError(`TypeScript could not read ${ctx.declarationPath}`);

  const graph = {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      packageVersion: ctx.apiPackageVersion,
      declarationPath: ctx.declarationPath,
      declarationHash: ctx.declarationHash,
      typescriptVersion: ctx.typescriptVersion,
      generatedAt: new Date().toISOString(),
      source: '@jlceda/pro-api-types/index.d.ts',
    },
    classes: {},
    interfaces: {},
    enums: {},
    typeAliases: {},
    mounts: {},
  };

  visitDeclarations(sf);

  graph.mounts = extractEdaMounts(graph);
  return graph;

  function visitDeclarations(node) {
    if (ts.isClassDeclaration(node) && node.name) {
      graph.classes[node.name.text] = serializeObjectLike(ctx, checker, node, 'class');
    }
    else if (ts.isInterfaceDeclaration(node) && node.name) {
      graph.interfaces[node.name.text] = serializeObjectLike(ctx, checker, node, 'interface');
    }
    else if (ts.isEnumDeclaration(node)) {
      graph.enums[node.name.text] = serializeEnum(ctx, checker, node);
    }
    else if (ts.isTypeAliasDeclaration(node)) {
      graph.typeAliases[node.name.text] = serializeTypeAlias(ctx, checker, node);
    }

    if (ts.isModuleDeclaration(node) || ts.isModuleBlock(node) || ts.isSourceFile(node)) {
      ts.forEachChild(node, visitDeclarations);
    }
  }
}

function serializeObjectLike(ctx, checker, node, kind) {
  const ts = ctx.ts;
  const name = node.name.text;
  const symbol = checker.getSymbolAtLocation(node.name);
  const type = symbol ? checker.getDeclaredTypeOfSymbol(symbol) : null;
  const source = node.getSourceFile();
  const baseTypes = [];
  if (node.heritageClauses) {
    for (const clause of node.heritageClauses) {
      for (const item of clause.types) baseTypes.push(item.expression.getText(source));
    }
  }

  const members = {};
  if (type) {
    for (const prop of checker.getPropertiesOfType(type)) {
      const declarations = (prop.declarations || []).filter(d => !isHiddenMember(ctx, d));
      if (!declarations.length) continue;
      const propType = checker.getTypeOfSymbolAtLocation(prop, declarations[0]);
      const callSignatures = propType.getCallSignatures();
      const signatures = [];
      if (callSignatures.length) {
        for (const sig of callSignatures) signatures.push(serializeSignature(ctx, checker, sig, declarations[0]));
      }
      else {
        for (const decl of declarations) {
          const declarationType = checker.getTypeOfSymbolAtLocation(prop, decl);
          signatures.push({
            kind: 'property',
            declaration: declarationText(decl),
            type: checker.typeToString(declarationType),
            parameters: [],
            returnType: checker.typeToString(declarationType),
            line: lineOf(decl),
            maturity: maturityOf(ctx, decl),
            warnings: maturityWarnings(ctx, decl),
          });
        }
      }
      members[prop.name] = { name: prop.name, declarations: signatures };
    }
  }

  return {
    kind,
    name,
    declaration: compactDeclaration(node),
    line: lineOf(node),
    maturity: maturityOf(ctx, node),
    baseTypes,
    members,
  };
}

function serializeSignature(ctx, checker, sig, fallbackDecl) {
  const decl = sig.getDeclaration() || fallbackDecl;
  const source = decl.getSourceFile();
  return {
    kind: 'method',
    declaration: declarationText(decl),
    signature: checker.signatureToString(sig),
    parameters: sig.getParameters().map((param) => {
      const pDecl = param.valueDeclaration || (param.declarations && param.declarations[0]);
      const pType = checker.getTypeOfSymbolAtLocation(param, pDecl || decl);
      return {
        name: param.name,
        type: checker.typeToString(pType),
        optional: Boolean(pDecl && (pDecl.questionToken || pDecl.initializer)),
        rest: Boolean(pDecl && pDecl.dotDotDotToken),
        line: pDecl ? lineOf(pDecl) : lineOf(decl),
      };
    }),
    returnType: checker.typeToString(sig.getReturnType()),
    line: source.getLineAndCharacterOfPosition(decl.getStart(source)).line + 1,
    maturity: maturityOf(ctx, decl),
    warnings: maturityWarnings(ctx, decl),
  };
}

function serializeEnum(ctx, checker, node) {
  const source = node.getSourceFile();
  return {
    kind: 'enum',
    name: node.name.text,
    declaration: compactDeclaration(node),
    line: lineOf(node),
    maturity: maturityOf(ctx, node),
    members: node.members
      .filter(member => !isInternal(ctx, member))
      .map(member => ({
        name: member.name.getText(source),
        value: checker.getConstantValue(member),
        declaration: declarationText(member),
        line: lineOf(member),
        maturity: maturityOf(ctx, member),
      })),
  };
}

function serializeTypeAlias(ctx, checker, node) {
  const type = checker.getTypeAtLocation(node);
  return {
    kind: 'type',
    name: node.name.text,
    declaration: compactDeclaration(node),
    type: checker.typeToString(type),
    line: lineOf(node),
    maturity: maturityOf(ctx, node),
    unionTypes: node.type && ctx.ts.isUnionTypeNode(node.type)
      ? node.type.types.map(t => t.getText(node.getSourceFile()))
      : [],
  };
}

function extractEdaMounts(graph) {
  const eda = graph.classes.EDA || graph.interfaces.EDA;
  if (!eda) return {};
  const mounts = {};
  for (const [name, member] of Object.entries(eda.members)) {
    const decl = member.declarations[0];
    if (!decl || decl.kind !== 'property') continue;
    const type = decl.type;
    mounts[name] = {
      name,
      type,
      variants: splitUnion(type),
      commonMembers: commonMembers(graph, splitUnion(type)),
      line: decl.line,
      declaration: decl.declaration,
      maturity: decl.maturity,
      warnings: decl.warnings,
    };
  }
  return mounts;
}

function splitUnion(typeText) {
  return typeText.split('|').map(part => part.trim()).filter(Boolean);
}

function commonMembers(graph, variants) {
  if (variants.length <= 1) return [];
  const memberSets = variants.map((name) => {
    const target = graph.classes[name] || graph.interfaces[name];
    return new Set(target ? Object.keys(target.members) : []);
  });
  if (!memberSets.length) return [];
  return [...memberSets[0]].filter(name => memberSets.every(set => set.has(name))).sort();
}

function searchGraph(graph, opts) {
  const needle = String(opts.name || opts.member || '').toLowerCase();
  if (!needle) throw envError('search requires --name <keyword> or --member <method>');
  const results = [];

  if (opts.member) {
    for (const [mountName, mount] of Object.entries(graph.mounts)) {
      for (const variant of mount.variants) {
        const target = graph.classes[variant] || graph.interfaces[variant];
        if (!target) continue;
        for (const memberName of Object.keys(target.members)) {
          if (memberName.toLowerCase().includes(needle)) {
            results.push({ kind: 'member', mount: mountName, type: variant, member: memberName, line: target.members[memberName].declarations[0].line });
          }
        }
      }
    }
    return results;
  }

  for (const [mountName, mount] of Object.entries(graph.mounts)) {
    if (mountName.toLowerCase().includes(needle) || mount.type.toLowerCase().includes(needle)) {
      results.push({ kind: 'mount', mount: mountName, type: mount.type, line: mount.line });
    }
  }
  addNamedMatches(results, 'class', graph.classes, needle);
  addNamedMatches(results, 'interface', graph.interfaces, needle);
  addNamedMatches(results, 'enum', graph.enums, needle);
  addNamedMatches(results, 'type', graph.typeAliases, needle);
  return results;
}

function addNamedMatches(results, kind, table, needle) {
  for (const [name, value] of Object.entries(table)) {
    if (name.toLowerCase().includes(needle)) results.push({ kind, name, line: value.line });
  }
}

function inspectGraph(graph, opts) {
  if (!opts.mount) throw envError('inspect requires --mount <edaMount>');
  const mountName = String(opts.mount).replace(/^eda\./, '');
  const mount = graph.mounts[mountName];
  if (!mount) return null;

  const result = { mount, variants: [] };
  for (const variant of mount.variants) {
    const target = graph.classes[variant] || graph.interfaces[variant] || graph.typeAliases[variant] || null;
    if (!target) {
      result.variants.push({ name: variant, unresolved: true });
      continue;
    }
    const selected = clone(target);
    if (opts.member) {
      selected.members = selected.members && selected.members[opts.member]
        ? { [opts.member]: selected.members[opts.member] }
        : {};
    }
    if (opts.closure) {
      selected.closure = closureFor(graph, selected);
    }
    result.variants.push(selected);
  }
  return result;
}

function closureFor(graph, selected) {
  const refs = { interfaces: {}, classes: {}, enums: {}, typeAliases: {} };
  const visited = new Set();
  const queue = [];
  if (selected.baseTypes) queue.push(...selected.baseTypes);
  if (selected.members) {
    for (const member of Object.values(selected.members)) {
      for (const decl of member.declarations || []) {
        for (const p of decl.parameters || []) queue.push(...typeNames(p.type));
        queue.push(...typeNames(decl.returnType || decl.type || ''));
      }
    }
  }

  while (queue.length) {
    const name = queue.shift();
    if (!name || visited.has(name)) continue;
    visited.add(name);
    if (graph.interfaces[name]) {
      refs.interfaces[name] = graph.interfaces[name];
      queue.push(...graph.interfaces[name].baseTypes);
      enqueueMemberTypes(queue, graph.interfaces[name]);
    }
    else if (graph.classes[name]) {
      refs.classes[name] = graph.classes[name];
      queue.push(...graph.classes[name].baseTypes);
      enqueueMemberTypes(queue, graph.classes[name]);
    }
    else if (graph.enums[name]) {
      refs.enums[name] = graph.enums[name];
    }
    else if (graph.typeAliases[name]) {
      refs.typeAliases[name] = graph.typeAliases[name];
      queue.push(...typeNames(graph.typeAliases[name].declaration));
      queue.push(...graph.typeAliases[name].unionTypes);
    }
  }
  return refs;
}

function enqueueMemberTypes(queue, target) {
  for (const member of Object.values(target.members || {})) {
    for (const decl of member.declarations || []) {
      for (const p of decl.parameters || []) queue.push(...typeNames(p.type));
      queue.push(...typeNames(decl.returnType || decl.type || ''));
    }
  }
}

function typeNames(text) {
  const names = new Set();
  const regex = /\b(?:I[A-Z][A-Za-z0-9_$]*|E[A-Z][A-Za-z0-9_$]*|T[A-Z][A-Za-z0-9_$]*|SCH_[A-Za-z0-9_$]+|PCB_[A-Za-z0-9_$]+|DMT_[A-Za-z0-9_$]+|LIB_[A-Za-z0-9_$]+|SYS_[A-Za-z0-9_$]+|PNL_[A-Za-z0-9_$]+)\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) names.add(match[0]);
  return [...names];
}

function lintProject(ctx, opts) {
  const inputs = opts._ || [];
  if (!inputs.length) throw envError('lint requires one or more source files/directories');
  const sourceFiles = collectInputs(ctx.projectRoot, inputs);
  const tsFiles = sourceFiles.filter(file => /\.(tsx?|mts|cts)$/i.test(file));
  const htmlFiles = sourceFiles.filter(file => /\.html?$/i.test(file));
  const compiler = runTypeCheck(ctx, tsFiles);
  const policy = runPolicyChecks(ctx, sourceFiles, htmlFiles);
  const diagnostics = [...compiler.diagnostics, ...policy];
  const errorCount = diagnostics.filter(d => d.severity === Severity.ERROR).length;
  return {
    context: publicContext(ctx),
    verifiedAgainst: `@jlceda/pro-api-types ${ctx.apiPackageVersion} (${ctx.declarationHash})`,
    files: sourceFiles,
    errorCount,
    warningCount: diagnostics.filter(d => d.severity === Severity.WARNING).length,
    diagnostics,
  };
}

function runTypeCheck(ctx, tsFiles) {
  if (!tsFiles.length) return { diagnostics: [] };
  const ts = ctx.ts;
  const configPath = ts.findConfigFile(ctx.projectRoot, ts.sys.fileExists, 'tsconfig.json');
  let options = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: ['@jlceda/pro-api-types'],
  };
  let roots = tsFiles;

  if (configPath) {
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error) {
      return { diagnostics: [tsDiagnostic(ctx, configFile.error)] };
    }
    const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath), { noEmit: true }, configPath);
    options = { ...parsed.options, noEmit: true };
    roots = [...new Set([...parsed.fileNames, ...tsFiles])];
  }

  if (!roots.includes(ctx.declarationPath)) roots.push(ctx.declarationPath);
  const program = ts.createProgram(roots, options);
  const diagnostics = ts.getPreEmitDiagnostics(program).map(d => tsDiagnostic(ctx, d));
  return { diagnostics };
}

function tsDiagnostic(ctx, diagnostic) {
  const ts = ctx.ts;
  const flattened = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
  let file = null;
  let line = 0;
  let col = 0;
  if (diagnostic.file && typeof diagnostic.start === 'number') {
    const pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    file = diagnostic.file.fileName;
    line = pos.line + 1;
    col = pos.character + 1;
  }
  return { file, line, col, severity: Severity.ERROR, rule: `ts-${diagnostic.code}`, message: flattened };
}

function runPolicyChecks(ctx, sourceFiles, htmlFiles) {
  const diagnostics = [];
  for (const file of sourceFiles) {
    const rel = normalizePath(path.relative(ctx.projectRoot, file));
    const text = fs.readFileSync(file, 'utf8');
    const isIframe = rel.startsWith('iframe/');
    const isMain = rel.startsWith('src/');
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const loc = { file, line: i + 1, col: 1 };
      if (/\bconsole\.log\s*\(/.test(line)) {
        diagnostics.push(policyDiagnostic(loc, Severity.INFO, 'no-console-log', 'Use console.warn or console.error with PLUGIN_TAG instead of console.log.'));
      }
      if (isMain && /\b(window|document|localStorage|sessionStorage|navigator)\b/.test(line)) {
        diagnostics.push(policyDiagnostic(loc, Severity.ERROR, 'main-runtime-api', 'src/ runs in the EasyEDA sandbox; DOM and browser storage APIs are forbidden there.'));
      }
      if (isMain && /\b(import|require)\s*(?:\(|['"])/.test(line) && /(?:fs|path|child_process|chart\.js|react|vue|svelte)/.test(line)) {
        diagnostics.push(policyDiagnostic(loc, Severity.ERROR, 'main-node-or-dom-package', 'Do not use Node or DOM-oriented npm packages in src/ main-process code; put browser UI dependencies under iframe/.'));
      }
      if (!isIframe && /\bwindow\.(parent\.)?eda\b/.test(line)) {
        diagnostics.push(policyDiagnostic(loc, Severity.WARNING, 'unnecessary-window-eda', 'Use eda directly instead of window.eda or window.parent.eda.'));
      }
      if (/openIFrame\s*\([^)]*\?[^)]*\)/.test(line)) {
        diagnostics.push(policyDiagnostic(loc, Severity.ERROR, 'iframe-query-params', 'openIFrame paths must not contain query parameters; use storage or message APIs for data.'));
      }
      if (/getExtensionUserConfig\s*\(\s*\)/.test(line)) {
        diagnostics.push(policyDiagnostic(loc, Severity.ERROR, 'storage-missing-key', 'getExtensionUserConfig requires a key parameter.'));
      }
    }
  }
  diagnostics.push(...lintExtensionJson(ctx.projectRoot));
  diagnostics.push(...lintHtmlMarkup(htmlFiles));
  return diagnostics;
}

function policyDiagnostic(loc, severity, rule, message) {
  return { ...loc, severity, rule, message };
}

function lintExtensionJson(projectRoot) {
  const diagnostics = [];
  const extensionPath = path.join(projectRoot, 'extension.json');
  if (!fs.existsSync(extensionPath)) return diagnostics;
  let data;
  try {
    data = readJson(extensionPath);
  }
  catch (err) {
    return [policyDiagnostic({ file: extensionPath, line: 1, col: 1 }, Severity.ERROR, 'extension-json-parse', err.message)];
  }
  const menuIds = new Map();
  const menus = [];
  collectHeaderMenus(data, menus);
  for (const menu of menus) {
    if (menu.id) {
      if (menuIds.has(menu.id)) {
        diagnostics.push(policyDiagnostic({ file: extensionPath, line: 1, col: 1 }, Severity.ERROR, 'menu-id-unique', `Duplicate header menu id "${menu.id}".`));
      }
      menuIds.set(menu.id, true);
    }
    if (typeof menu.title === 'string' && /^%.*%$/.test(menu.title)) {
      diagnostics.push(policyDiagnostic({ file: extensionPath, line: 1, col: 1 }, Severity.ERROR, 'menu-title-i18n', 'Menu title must be plain text and translated in locales/extensionJson/, not %key% syntax.'));
    }
  }
  const en = path.join(projectRoot, 'locales', 'extensionJson', 'en.json');
  const zh = path.join(projectRoot, 'locales', 'extensionJson', 'zh-Hans.json');
  if (menus.length && (!fs.existsSync(en) || !fs.existsSync(zh))) {
    diagnostics.push(policyDiagnostic({ file: extensionPath, line: 1, col: 1 }, Severity.WARNING, 'menu-title-i18n-files', 'Menu title translations should live in locales/extensionJson/en.json and zh-Hans.json.'));
  }
  return diagnostics;
}

function collectHeaderMenus(value, result) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectHeaderMenus(item, result);
    return;
  }
  if (Array.isArray(value.headerMenus)) {
    for (const item of value.headerMenus) {
      if (item && typeof item === 'object') result.push(item);
      collectHeaderMenus(item, result);
    }
  }
  for (const item of Object.values(value)) collectHeaderMenus(item, result);
}

function lintHtmlMarkup(htmlFiles) {
  const diagnostics = [];
  for (const file of htmlFiles) {
    const normalized = normalizePath(file);
    if (!/\/iframe\//.test(normalized)) continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const relPathMatch = lines[i].match(/(?:href|src)\s*=\s*["'](\.\.?\/[^"']+)["']/);
      if (relPathMatch) {
        diagnostics.push(policyDiagnostic({ file, line: i + 1, col: relPathMatch.index + 1 }, Severity.ERROR, 'iframe-relative-path', `Use absolute iframe resource paths instead of "${relPathMatch[1]}".`));
      }
    }
  }
  return diagnostics;
}

function collectInputs(projectRoot, inputs) {
  const files = [];
  for (const input of inputs) {
    const full = path.resolve(projectRoot, input);
    if (!fs.existsSync(full)) throw envError(`Input path not found: ${input}`);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) collectFiles(full, files);
    else if (/\.(tsx?|mts|cts|html?)$/i.test(full)) files.push(full);
  }
  return [...new Set(files)];
}

function collectFiles(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'build', 'dist'].includes(entry.name)) continue;
      collectFiles(path.join(dir, entry.name), out);
    }
    else if (/\.(tsx?|mts|cts|html?)$/i.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
}

function isHiddenMember(ctx, node) {
  const ts = ctx.ts;
  const flags = ts.getCombinedModifierFlags(node);
  return Boolean(flags & ts.ModifierFlags.Private) ||
    Boolean(flags & ts.ModifierFlags.Protected) ||
    isInternal(ctx, node);
}

function isInternal(ctx, node) {
  return maturityOf(ctx, node).includes('internal');
}

function maturityOf(ctx, node) {
  const stabilityTags = new Set(['public', 'beta', 'alpha', 'internal']);
  const tags = ctx.ts.getJSDocTags(node)
    .map(tag => tag.tagName.getText())
    .filter(tag => stabilityTags.has(tag));
  return tags.length ? tags : ['unspecified'];
}

function maturityWarnings(ctx, node) {
  const tags = maturityOf(ctx, node);
  const warnings = [];
  if (tags.includes('beta')) warnings.push('API is marked @beta; verify compatibility for the installed SDK version.');
  if (tags.includes('alpha')) warnings.push('API is marked @alpha; expect possible changes across SDK versions.');
  return warnings;
}

function declarationText(node) {
  return node.getText(node.getSourceFile()).replace(/\r?\n\s*/g, ' ').trim();
}

function compactDeclaration(node) {
  const text = declarationText(node);
  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}

function lineOf(node) {
  const sf = node.getSourceFile();
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function formatMarkdown(command, data) {
  if (command === 'doctor') {
    return [
      '# EasyEDA API Doctor',
      '',
      `- Project: ${data.projectRoot}`,
      `- Package: @jlceda/pro-api-types ${data.apiPackageVersion}`,
      `- Declaration: ${data.declarationPath}`,
      `- SHA-256: ${data.declarationHash}`,
      `- TypeScript: ${data.typescriptVersion}`,
      `- Cache: ${data.cachePath}`,
      `- Counts: ${data.counts.classes} classes, ${data.counts.interfaces} interfaces, ${data.counts.enums} enums, ${data.counts.typeAliases} type aliases, ${data.counts.mounts} eda mounts`,
    ].join('\n');
  }
  if (command === 'search') {
    if (!data.results.length) return 'No matching API symbols found.';
    return data.results.map(formatSearchResult).join('\n');
  }
  if (command === 'inspect') {
    if (!data.result) return 'Mount not found.';
    return formatInspect(data.result);
  }
  if (command === 'lint') {
    const lines = [
      `Verified against ${data.verifiedAgainst}`,
      `${data.files.length} file(s), ${data.errorCount} error(s), ${data.warningCount} warning(s)`,
    ];
    for (const d of data.diagnostics) {
      lines.push(`${d.file || '<unknown>'}:${d.line || 0}:${d.col || 0} [${d.severity}] ${d.message} (${d.rule})`);
    }
    return lines.join('\n');
  }
  return JSON.stringify(data, null, 2);
}

function formatSearchResult(result) {
  if (result.kind === 'mount') return `- mount eda.${result.mount}: ${result.type} (line ${result.line})`;
  if (result.kind === 'member') return `- eda.${result.mount}.${result.member}: ${result.type} (line ${result.line})`;
  return `- ${result.kind} ${result.name} (line ${result.line})`;
}

function formatInspect(result) {
  const lines = [`# eda.${result.mount.name}`, '', `Type: ${result.mount.type}`, `Line: ${result.mount.line}`];
  if (result.mount.variants.length > 1) {
    lines.push(`Union variants: ${result.mount.variants.join(' | ')}`);
    lines.push(`Common members: ${result.mount.commonMembers.join(', ') || '(none)'}`);
  }
  for (const variant of result.variants) {
    lines.push('', `## ${variant.name}`);
    if (variant.unresolved) {
      lines.push('Unresolved type.');
      continue;
    }
    if (variant.baseTypes && variant.baseTypes.length) lines.push(`Extends: ${variant.baseTypes.join(', ')}`);
    const members = Object.values(variant.members || {});
    if (!members.length) lines.push('No members matched.');
    for (const member of members) {
      lines.push('', `### ${member.name}`);
      for (const decl of member.declarations) {
        if (decl.warnings && decl.warnings.length) lines.push(...decl.warnings.map(w => `Warning: ${w}`));
        lines.push(`- line ${decl.line}: \`${decl.signature || decl.declaration}\``);
      }
    }
    if (variant.closure) {
      const counts = countClosure(variant.closure);
      lines.push('', `Closure: ${counts.interfaces} interfaces, ${counts.classes} classes, ${counts.enums} enums, ${counts.typeAliases} type aliases`);
      for (const [name, value] of Object.entries(variant.closure.enums || {})) {
        lines.push(`- enum ${name}: ${value.members.map(m => m.name).join(', ')}`);
      }
      for (const name of Object.keys(variant.closure.interfaces || {})) lines.push(`- interface ${name}`);
      for (const name of Object.keys(variant.closure.typeAliases || {})) lines.push(`- type ${name}`);
    }
  }
  return lines.join('\n');
}

function countGraph(graph) {
  return {
    classes: Object.keys(graph.classes).length,
    interfaces: Object.keys(graph.interfaces).length,
    enums: Object.keys(graph.enums).length,
    typeAliases: Object.keys(graph.typeAliases).length,
    mounts: Object.keys(graph.mounts).length,
  };
}

function countClosure(closure) {
  return {
    classes: Object.keys(closure.classes || {}).length,
    interfaces: Object.keys(closure.interfaces || {}).length,
    enums: Object.keys(closure.enums || {}).length,
    typeAliases: Object.keys(closure.typeAliases || {}).length,
  };
}

function publicContext(ctx) {
  return {
    projectRoot: ctx.projectRoot,
    apiPackagePath: ctx.apiPackagePath,
    apiPackageVersion: ctx.apiPackageVersion,
    declarationPath: ctx.declarationPath,
    declarationHash: ctx.declarationHash,
    typescriptPath: ctx.typescriptPath,
    typescriptVersion: ctx.typescriptVersion,
    schemaVersion: SCHEMA_VERSION,
    cachePath: ctx.cachePath,
  };
}

function normalizePath(value) {
  return value.replace(/\\/g, '/');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function envError(message, details) {
  const err = new Error(message);
  err.exitCode = ExitCode.ENV_ERROR;
  err.details = details;
  return err;
}

if (require.main === module) main();

module.exports = {
  buildGraph,
  inspectGraph,
  lintProject,
  loadContext,
  loadGraph,
  searchGraph,
  ExitCode,
};
