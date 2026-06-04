'use strict';

/**
 * MemLab Component Leak Runner
 * ─────────────────────────────────────────────────────────
 * 1. Runs the memlab scenario (browser automation + heap snapshots).
 * 2. leakFilter in the scenario accumulates info on every leaked FiberNode.
 * 3. After the run, this script searches your src/ directory to map each
 *    leaked component back to its source file and writes a developer-friendly
 *    report to memlab_leak_report.txt.
 *
 * Usage:
 *   npm run memlab
 *   # — or with a custom Chromium path —
 *   CHROMIUM_BINARY="/path/to/chrome" npm run memlab
 *
 * Prerequisites:
 *   - Your Next.js app must be running:  npm run dev
 */

const path = require('path');
const fs = require('fs');
const { run } = require('@memlab/api');

// Import scenario first so its require() of leak_filter registers the module
// in Node's cache.  _collected is then the exact same array that leakFilter
// pushes to during the memlab run.
const scenario = require('./scenarios/details_scenario');
const { _collected } = require('./filters/dev_filter');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'pages');
const REPORT_PATH = path.join(PROJECT_ROOT, 'memlab_leak_report.txt');
const WORK_DIR = path.join(PROJECT_ROOT, 'memlab_results');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

/**
 * Recursively scan srcDir for JS/TS files that define a React component whose
 * name matches componentName.  Returns relative paths from PROJECT_ROOT.
 *
 * Patterns covered:
 *   function MyComp(        export default function MyComp(
 *   class MyComp            export default class MyComp
 *   const MyComp =          const MyComp: React.FC =
 */
function findSourceFiles(srcDir, componentName) {
  const results = [];
  const escaped = componentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`function\\s+${escaped}\\s*[({]`),
    new RegExp(`class\\s+${escaped}\\s*[{(]`),
    new RegExp(`const\\s+${escaped}\\s*[=:]`),
    new RegExp(`export\\s+default\\s+function\\s+${escaped}`),
    new RegExp(`export\\s+default\\s+class\\s+${escaped}`),
  ];

  const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'out']);

  function scan(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) scan(fullPath);
        continue;
      }

      if (!entry.isFile() || !/\.(js|jsx|ts|tsx)$/.test(entry.name)) continue;

      let content;
      try {
        content = fs.readFileSync(fullPath, 'utf8');
      } catch {
        continue;
      }

      if (patterns.some(p => p.test(content))) {
        results.push(path.relative(PROJECT_ROOT, fullPath));
      }
    }
  }

  if (fs.existsSync(srcDir)) scan(srcDir);
  return results;
}

/**
 * Extract the most useful frames from a React component stack string.
 * Finds the frame for componentName and returns it plus up to 3 frames above
 * (parent components), giving the full mount context.
 *
 * Example output:
 *   at DetailsScreen (http://localhost:3000/_next/static/chunks/src_pages_details.js:5:18)
 *   at MyApp (http://localhost:3000/_next/static/chunks/src_pages__app.js:2:5)
 */
function extractStackSnippet(stack, componentName) {
  if (!stack) return null;
  const lines = stack.split('\n').map(l => l.trim()).filter(l => l.startsWith('at '));

  const idx = lines.findIndex(l => l.includes(`at ${componentName}`));
  const start = idx >= 0 ? idx : 0;
  // Show the component frame + up to 3 parent frames for mount context
  return lines.slice(start, start + 4).join('\n    ');
}

/**
 * Pull HTTP bundle URLs from a V8 stack string, e.g.:
 *   at DetailsScreen (http://localhost:3000/_next/static/chunks/src_pages_details.js:5:18)
 * Returns unique URLs with their line:col suffix intact so developers can
 * paste them straight into browser DevTools > Sources.
 */
function extractBundleUrls(stack) {
  if (!stack) return [];
  const re = /\((https?:\/\/[^)\s]+)\)/g;
  const seen = new Set();
  let m;
  while ((m = re.exec(stack)) !== null) seen.add(m[1]);
  return [...seen];
}

// ─── Report generator ─────────────────────────────────────────────────────────

function generateReport(collected) {
  const out = [];

  out.push(`MEMLAB LEAK REPORT`);
  out.push(`Generated: ${new Date().toISOString()}`);
  out.push('');

  if (collected.length === 0) {
    out.push('No leaked React components detected.');
    const text = out.join('\n') + '\n';
    fs.writeFileSync(REPORT_PATH, text, 'utf8');
    console.log(text);
    return;
  }

  // Group by component name, sort by total retained size descending
  const grouped = new Map();
  for (const info of collected) {
    if (!grouped.has(info.componentName)) {
      grouped.set(info.componentName, { count: 0, totalSize: 0, instances: [] });
    }
    const g = grouped.get(info.componentName);
    g.count++;
    g.totalSize += info.retainedSize;
    g.instances.push(info);
  }

  const sorted = [...grouped.entries()].sort((a, b) => b[1].totalSize - a[1].totalSize);

  out.push(`Leaked components: ${grouped.size} (${collected.length} total instances)`);

  sorted.forEach(([componentName, group], i) => {
    const sample = group.instances[0];

    out.push('');
    out.push('---');
    out.push('');
    out.push(`[${i + 1}] ${componentName}`);
    out.push(`    Instances : ${group.count}`);
    out.push(`    Retained  : ${formatSize(group.totalSize)}`);

    if (sample.hookTypes.length > 0) {
      out.push(`    Hooks     : ${sample.hookTypes.join(', ')}`);
    }

    // Source file(s) found by scanning src/
    const sourceFiles = findSourceFiles(SRC_DIR, componentName);
    if (sourceFiles.length > 0) {
      out.push(`    Source    : ${sourceFiles.join(', ')}`);
    } else {
      out.push(`    Source    : not found in src/ (library or dynamic import)`);
    }

    // React dev-mode _debugStack gives real bundle URL + line:col
    const stackSnippet = extractStackSnippet(sample.componentStack, componentName);
    if (stackSnippet) {
      out.push(`    Stack     :`);
      for (const line of stackSnippet.split('\n')) {
        out.push(`      ${line.trim()}`);
      }
    }

    const bundleUrls = extractBundleUrls(sample.componentStack);
    if (bundleUrls.length > 0) {
      out.push(`    Bundle URL:`);
      for (const u of bundleUrls) {
        out.push(`      ${u}`);
      }
    }
  });

  out.push('');
  out.push('---');
  out.push('');

  const text = out.join('\n');
  fs.writeFileSync(REPORT_PATH, text, 'utf8');
  console.log('\n' + text);
  console.log(`Report saved to: ${REPORT_PATH}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Clear stale data from any previous in-process run
  _collected.length = 0;

  fs.mkdirSync(WORK_DIR, { recursive: true });

  const config = { scenario, workDir: WORK_DIR };

  // Allow callers to supply a custom Chromium binary via env var.
  // memlab bundles its own Chromium, so this is only needed when the
  // default binary is unavailable (e.g. on Apple Silicon, CI, etc.).
  if (process.env.CHROMIUM_BINARY) {
    config.chromiumBinary = process.env.CHROMIUM_BINARY;
  } else if (process.platform === 'darwin') {
    // Common paths for Google Chrome on macOS
    const commonPaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    ];
    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        config.chromiumBinary = p;
        break;
      }
    }
  }

  if (config.chromiumBinary) {
    console.log(`Using Chromium: ${config.chromiumBinary}`);
  }

  console.log('Starting memlab run…');
  console.log('Make sure your Next.js app is running:  npm run dev\n');

  try {
    await run(config);
  } catch (err) {
    console.error('\nMemlab run failed:', err.message || err);
    console.error('\nCommon fixes:');
    console.error('  - App not running?  Start it with:  npm run dev');
    console.error('  - Wrong Chromium?   Set:  CHROMIUM_BINARY=/path/to/chrome npm run memlab');
    process.exit(1);
  }

  console.log(`\nMemlab run complete. ${_collected.length} leaked FiberNode(s) captured.`);
  generateReport(_collected);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
