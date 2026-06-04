const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { findLeaksBySnapshotFilePaths } = require('@memlab/api');
const { config } = require('@memlab/core');
const { leakFilter, _collected } = require('./memlab_impl/filters/dev_filter');

const SNAPSHOT_DIR = path.resolve(__dirname, 'interactive_snapshots');
if (!fs.existsSync(SNAPSHOT_DIR)) {
  fs.mkdirSync(SNAPSHOT_DIR);
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

let urlStack = [];
let baseStack = [];
let targetStack = [];
let latestSnapshot = null;
let currentUrl = null;
let browser, page, client;
let isProcessing = false;

/**
 * Normalizes URL to use as a key and filename component
 */
function normalizeUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    return url.pathname;
  } catch (e) {
    return urlStr;
  }
}

/**
 * Waits for the page to be stable before taking a snapshot
 */
async function waitForSettle() {
  // Wait for a few seconds to let animations/async data finish
  await new Promise(resolve => setTimeout(resolve, 2500));
}

async function takeSnapshot(url, type) {
  await waitForSettle();
  
  const timestamp = Date.now();
  const safeUrl = url.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
  const filename = `${type}_${safeUrl}_${timestamp}.heapsnapshot`;
  const savePath = path.join(SNAPSHOT_DIR, filename);

  // Trigger GC before snapshot
  await client.send('HeapProfiler.collectGarbage');
  
  let snapshotData = '';
  const onChunk = (params) => { snapshotData += params.chunk; };
  client.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  
  await client.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  
  client.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
  
  fs.writeFileSync(savePath, snapshotData);
  console.log(`[SNAPSHOT] ${type.toUpperCase()} taken for ${url}`);
  return savePath;
}

async function runAnalysis(baselinePath, targetPath, finalPath, url) {
  console.log(`\n--- Analyzing Leak for Scene: ${url} ---`);
  
  // Clear stale data from leak filter collection
  _collected.length = 0;

  try {
    // Register the leak filter correctly via config.scenario
    config.scenario = { leakFilter };
    
    // Memlab analysis: Baseline, Target, Final
    const leaks = await findLeaksBySnapshotFilePaths(baselinePath, targetPath, finalPath);

    console.log(_collected.length);
    console.log('something is written');
    
    if (_collected.length > 0) {
      console.log(`🚨 BINGO! Found ${_collected.length} leaked React components for ${url}:`);
      
      // Group by component name
      const grouped = new Map();
      for (const info of _collected) {
        const key = `${info.componentName}|${info.chunkName}`;
        if (!grouped.has(key)) {
          grouped.set(key, { 
            name: info.componentName, 
            chunk: info.chunkName, 
            count: 0, 
            totalSize: 0, 
            hooks: [] 
          });
        }
        const g = grouped.get(key);
        g.count++;
        g.totalSize += info.retainedSize;
        if (info.hookTypes && info.hookTypes.length > 0 && g.hooks.length === 0) {
          g.hooks = info.hookTypes;
        }
      }

      for (const g of grouped.values()) {
        console.log(`  - <${g.name}>: ${g.count} instance(s), Retained: ${formatSize(g.totalSize)}`);
        console.log(`    📂 Found in Chunk: ${g.chunk}`);
        if (g.hooks.length > 0) {
          console.log(`    Hooks: ${g.hooks.join(', ')}`);
        }
      }
    } else if (leaks && leaks.length > 0) {
      console.log(`[LEAK] Found ${leaks.length} generic leak clusters for ${url}.`);
    } else {
      console.log(`[OK] No leaks detected for ${url}.`);
    }
  } catch (err) {
    console.error(`Analysis failed for ${url}:`, err.message);
  }
  console.log('-------------------------------------------\n');
}

async function handleUrlChange(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (url === currentUrl || isProcessing) return;

  isProcessing = true;
  const prevUrl = currentUrl;
  currentUrl = url;

  try {
    if (urlStack.length > 1 && url === urlStack[urlStack.length - 2]) {
      // BACKWARD NAVIGATION (e.g., P3 -> P2)
      const finalPath = await takeSnapshot(url, 'final');
      const targetPath = targetStack.pop();
      const baselinePath = baseStack.pop();
      const leakedUrl = urlStack.pop();
      
      console.log(`[BACK] Navigated back to ${url} from ${leakedUrl}`);
      
      // Run analysis
      runAnalysis(baselinePath, targetPath, finalPath, leakedUrl);
      
      // Update latest snapshot for the current page (P2)
      latestSnapshot = finalPath;
    } else {
      // FORWARD NAVIGATION
      if (latestSnapshot) {
        // Current state of previous page becomes baseline for next page
        baseStack.push(latestSnapshot);
      }
      
      const targetPath = await takeSnapshot(url, 'target');
      targetStack.push(targetPath);
      urlStack.push(url);
      latestSnapshot = targetPath;
      
      console.log(`[FORWARD] Navigated to ${url}. Depth: ${urlStack.length}`);
    }
  } catch (err) {
    console.error(`Error during URL change handling for ${url}:`, err);
  } finally {
    isProcessing = false;
  }
}

async function start() {
  const startUrl = process.argv[2] || 'https://memory-leak-detection-git-develop-jeelsavsani001s-projects.vercel.app/';
  
  console.log('Launching browser...');
  browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  
  const pages = await browser.pages();
  page = pages[0];
  
  client = await page.target().createCDPSession();
  await client.send('HeapProfiler.enable');

  // Expose function to be called from the page
  await page.exposeFunction('notifyUrlChange', (url) => {
    handleUrlChange(url);
  });

  // Inject script to monitor pushState and popstate
  await page.evaluateOnNewDocument(() => {
    const originalPushState = history.pushState;
    history.pushState = function() {
      originalPushState.apply(this, arguments);
      window.notifyUrlChange(window.location.href);
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
      originalReplaceState.apply(this, arguments);
      window.notifyUrlChange(window.location.href);
    };

    window.addEventListener('popstate', () => {
      window.notifyUrlChange(window.location.href);
    });
  });

  // Also listen for standard navigations
  page.on('framenavigated', async (frame) => {
    if (frame === page.mainFrame()) {
      handleUrlChange(page.url());
    }
  });

  console.log(`Navigating to ${startUrl}...`);
  await page.goto(startUrl);

  console.log('\n--- Interactive Leak Detection Active ---');
  console.log('1. Interact with the browser as a user would.');
  console.log('2. The script captures Baseline on forward navigation.');
  console.log('3. The script captures Final and runs analysis on backward navigation.');
  console.log('4. Stack logic handles nested scenes (P1 -> P2 -> P3 -> P2 -> P1).');
  console.log('-----------------------------------------\n');
}

start().catch(err => {
  console.error('Fatal error starting the interactive detector:', err);
  process.exit(1);
});
