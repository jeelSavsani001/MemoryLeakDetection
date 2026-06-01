#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const {
  findLeaks,
  run,
  BrowserInteractionResultReader,
  ConsoleMode,
} = require('@memlab/api');
const { getFullHeapFromFile } = require('@memlab/heap-analysis');

const DEFAULT_WORK_DIR = './results';
const DEFAULT_THRESHOLD = 1000000; // 10 MB

function parseArgs(argv) {
  const opts = {
    workDir: DEFAULT_WORK_DIR,
    minRetainedSize: DEFAULT_THRESHOLD,
    json: false,
    run: false,
    scenario: undefined,
    trace: false,
  };

  argv.forEach((arg, index) => {
    if (arg === '--work-dir' || arg === '-w') {
      opts.workDir = argv[index + 1] || opts.workDir;
    } else if (arg.startsWith('--work-dir=')) {
      opts.workDir = arg.split('=')[1];
    } else if (arg === '--min-retained-size' || arg === '-t') {
      opts.minRetainedSize = Number(argv[index + 1]) || opts.minRetainedSize;
    } else if (arg.startsWith('--min-retained-size=')) {
      opts.minRetainedSize = Number(arg.split('=')[1]) || opts.minRetainedSize;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--run') {
      opts.run = true;
    } else if (arg === '--scenario') {
      opts.scenario = argv[index + 1];
    } else if (arg.startsWith('--scenario=')) {
      opts.scenario = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg === '--trace') {
        opts.trace = true;
    }

  });

  if (Number.isNaN(opts.minRetainedSize) || opts.minRetainedSize < 0) {
    opts.minRetainedSize = DEFAULT_THRESHOLD;
  }

  return opts;
}

function printUsage() {
  console.log('Usage: node scripts/memlab-summary.js [--work-dir <dir>] [--min-retained-size <bytes>] [--json] [--run --scenario <scenario.js>]');
  console.log('  --work-dir, -w           MemLab results directory (default: ./results)');
  console.log('  --min-retained-size, -t  Minimum retained size filter in bytes (default: 50000)');
  console.log('  --run                    Execute a MemLab scenario before summarizing results');
  console.log('  --scenario               Path to a MemLab scenario JS file when using --run');
  console.log('  --json                   Emit JSON output instead of plain text');
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(2)} KB`;
}

function isAppSpecificNode(node) {
  if (!node) return false;
  const name = String(node.name || '').toLowerCase();

  // Keep React fiber / detached DOM / components / app-specific references.
  const appKeywords = [
    'fiber',
    'details',
    'cardlayout',
    'apoll',
    'router',
    'usequery',
    'cachedcharacterdata',
    'query',
    'graphql',
    'next',
    'detached',
    'button',
    'div',
    'h1',
    'h3',
    'text',
  ];

  if (node.is_detached) {
    return true;
  }

  if (appKeywords.some((keyword) => name.includes(keyword))) {
    return true;
  }

  return false;
}

function describeHeapNode(node) {
  if (!node) {
    return 'UNKNOWN';
  }

  const parts = [];

  if (node.is_detached) {
    parts.push('Detached');
  }

  const safeName = node.name || node.type || 'unknown';
  const displayName = safeName === 'Object' ? `${safeName}` : safeName;
  parts.push(displayName);

  if (node.type === 'native' && node.name && node.name.startsWith('Detached')) {
    return node.name;
  }

  if (node.type === 'string') {
    return `String(${node.name})`;
  }

  return parts.join(' ');
}

function nodeToHumanPath(node) {
  if (!node) {
    return 'UNKNOWN';
  }

  const description = describeHeapNode(node);
  if (node.location && typeof node.location.getJSONifyableObject === 'function') {
    try {
      const location = node.location.getJSONifyableObject();
      if (location && location.script_id != null) {
        return `${description}@script:${location.script_id}:${location.line}:${location.column}`;
      }
    } catch (e) {
      // ignore location extraction failures
    }
  }

  return description;
}

function compactTracePath(chain) {
  const simplified = [];
  for (const node of chain) {
    const desc = describeHeapNode(node);
    if (!simplified.includes(desc)) {
      simplified.push(desc);
    }
    if (simplified.length >= 6) {
      break;
    }
  }
  return simplified;
}

function buildAppLevelPath(chain) {
  const pathItems = compactTracePath(chain).filter((item) => {
    return (
      item.toLowerCase().includes('detached') ||
      item.toLowerCase().includes('fiber') ||
      item.toLowerCase().includes('details') ||
      item.toLowerCase().includes('cardlayout') ||
      item.toLowerCase().includes('apollo') ||
      item.toLowerCase().includes('query') ||
      item.toLowerCase().includes('router') ||
      item.toLowerCase().includes('button') ||
      item.toLowerCase().includes('div') ||
      item.toLowerCase().includes('h1') ||
      item.toLowerCase().includes('h3')
    );
  });

  if (pathItems.length === 0) {
    return compactTracePath(chain).slice(0, 4).join(' -> ');
  }

  return pathItems.join(' -> ');
}

function getRetainerChain(node) {
  const chain = [];
  let current = node;
  const guard = new Set();

  while (current && !guard.has(current.id) && chain.length < 60) {
    guard.add(current.id);
    chain.push(current);

    if (current.hasPathEdge && current.pathEdge && current.pathEdge.fromNode) {
      current = current.pathEdge.fromNode;
      continue;
    }

    const referrerEdge = current.findAnyReferrer(() => true);
    current = referrerEdge ? referrerEdge.fromNode : null;
  }

  return chain;
}

function formatLeakRow(node, index, clusterInfo = {}) {
  const chain = getRetainerChain(node);
  const appPath = buildAppLevelPath(chain) || describeHeapNode(node);
  const nodeLabel = describeHeapNode(node);
  const size = formatSize(node.retainedSize || 0);

  const summary = {
    id: index + 1,
    retainedSizeBytes: node.retainedSize || 0,
    retainedSize: size,
    path: appPath,
    culprit: nodeLabel,
    rank: clusterInfo.rank ?? null,
    clusterRaw: clusterInfo.raw || null,
  };

  return summary;
}

function pickFinalSnapshot(snapshotFiles) {
  if (!snapshotFiles || snapshotFiles.length === 0) {
    throw new Error('No snapshot files found in the MemLab work directory.');
  }

  const sorted = [...snapshotFiles].sort((a, b) => a.localeCompare(b, 'en')); // s1, s2, s3
  return sorted[sorted.length - 1];
}

function getAppLeakCandidates(snapshot, minRetainedSize, traceMode) {
  const candidates = [];

  snapshot.nodes.forEach((node) => {
    if (!node || node.retainedSize == null) return;

    if (node.retainedSize < minRetainedSize) return;

    if (traceMode) {
      // behave like --trace-object-size-above
      candidates.push(node);
    } else {
      // existing filtered behavior
      if (node.is_detached || isAppSpecificNode(node)) {
        candidates.push(node);
      }
    }
  });

  return candidates;
}

function normalizeLeakInfo(leaks) {
  if (!Array.isArray(leaks)) {
    return [];
  }
  return leaks.map((item, index) => {
    const retainedSize = item.retainedSize || item.retained_size || item.clusterMetaInfo?.retained_size || item.clusterMetaInfo?.leaked_size || 0;
    const leakedNodeIds = Array.isArray(item.leakedNodeIds)
      ? item.leakedNodeIds
      : item.leakedNodeIds && typeof item.leakedNodeIds === 'object'
      ? Array.from(item.leakedNodeIds)
      : [];

    return {
      raw: item,
      retainedSize,
      leakedNodeIds,
      traceSummary: item.clusterMetaInfo?.leak_trace_summary || item.leak_trace_summary || item.trace_summary || '',
      clusterId: item.clusterMetaInfo?.cluster_id || index + 1,
    };
  });
}

async function runSummary() {
  const opts = parseArgs(process.argv.slice(2));
  const workDir = path.resolve(process.cwd(), opts.workDir);

  if (!fs.existsSync(workDir)) {
    throw new Error(`Work directory not found: ${workDir}`);
  }

  console.log(`🔍 Loading MemLab ${opts.run ? 'run' : 'results'} from ${workDir}`);

  let reader;
  let normalized;

  if (opts.run) {
    if (!opts.scenario) {
      throw new Error('--run requires --scenario <path/to/scenario.js>');
    }

    const scenarioPath = path.resolve(process.cwd(), opts.scenario);
    if (!fs.existsSync(scenarioPath)) {
      throw new Error(`Scenario file not found: ${scenarioPath}`);
    }

    const scenarioModule = require(scenarioPath);
    const scenario = scenarioModule.default || scenarioModule;
    const result = await run({scenario, workDir, consoleMode: ConsoleMode.SILENT});
    reader = result.runResult;
    normalized = normalizeLeakInfo(result.leaks);
  } else {
    reader = BrowserInteractionResultReader.from(workDir);
    const leaks = await findLeaks(reader, { consoleMode: ConsoleMode.SILENT });
    normalized = normalizeLeakInfo(leaks);
  }

  const snapshotFiles = reader.getSnapshotFiles();
  const finalSnapshot = pickFinalSnapshot(snapshotFiles);
  console.log(`📦 Using final snapshot: ${path.basename(finalSnapshot)}`);

  const snapshot = await getFullHeapFromFile(finalSnapshot);
  
  const appCandidates = getAppLeakCandidates(snapshot, opts.minRetainedSize, opts.trace);


  const leakedNodeIds = new Set(normalized.flatMap((cluster) => cluster.leakedNodeIds || []));
  const leakedNodes = leakedNodeIds.size
    ? snapshot.getNodesByIds(Array.from(leakedNodeIds)).filter(Boolean)
    : [];

  
  const chosenNodes = opts.trace? [...leakedNodes, ...appCandidates] : (leakedNodes.length > 0 ? leakedNodes : appCandidates);


  const uniqueMap = new Map();
  [...chosenNodes].forEach(node => {
    if (node?.id != null) {
        uniqueMap.set(node.id, node);
    }
  });

  const finalNodes = Array.from(uniqueMap.values());

  const byRetained = finalNodes.sort((a, b) => b.retainedSize - a.retainedSize);
  const leaksSummary = byRetained.map((node, index) => formatLeakRow(node, index));

  const summary = {
    workDir,
    snapshot: finalSnapshot,
    foundClusters: normalized.length,
    appLeakCandidates: leaksSummary.length,
    threshold: opts.minRetainedSize,
    leaks: leaksSummary,
  };

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`✅ MemLab leak clusters discovered: ${normalized.length}`);
  console.log(`✅ App-specific candidate nodes above threshold: ${summary.appLeakCandidates}`);
  console.log('---');

  leaksSummary.forEach((entry) => {
    console.log(`Leak #${entry.id}`);
    console.log(`  Path:   ${entry.path}`);
    console.log(`  Size:   ${entry.retainedSize}`);
    console.log(`  Ctor:   ${entry.culprit}`);
    if (entry.clusterRaw && entry.clusterRaw.traceSummary) {
      console.log(`  Trace:  ${entry.clusterRaw.traceSummary}`);
    }
    console.log('');
  });

  console.log('---');
  console.log(`Tip: use --min-retained-size ${opts.minRetainedSize} to tune noise filtering.`);
}

runSummary().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
