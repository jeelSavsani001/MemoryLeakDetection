const fs = require('fs');
const path = require('path');
const { SourceMapConsumer } = require('source-map');

const LEAKS_FILE = path.join(process.cwd(), 'detected_leaks.json');
const NEXT_CHUNKS_DIR = path.join(process.cwd(), '.next/static/chunks');

async function mapChunksToSources() {
  if (!fs.existsSync(LEAKS_FILE)) {
    console.error(`Error: Leaks file not found at ${LEAKS_FILE}`);
    return;
  }

  const leaks = JSON.parse(fs.readFileSync(LEAKS_FILE, 'utf8'));
  const results = [];

  for (const leak of leaks) {
    const { componentName, chunkName } = leak;
    
    if (!chunkName || chunkName === "Unknown Chunk File") {
      results.push({ ...leak, originalSources: ['Unknown'] });
      continue;
    }

    // chunkName is often a URL like http://localhost:3000/_next/static/chunks/pages/index.js
    // We need to extract the relative path to locate it in .next/static/chunks
    let relativeChunkPath = chunkName;
    if (chunkName.includes('/_next/static/chunks/')) {
      relativeChunkPath = chunkName.split('/_next/static/chunks/')[1];
    } else if (chunkName.startsWith('blob:')) {
       // Handle blob URLs if necessary, but usually Next.js uses standard URLs
       results.push({ ...leak, originalSources: ['Blob URL - Mapping not supported'] });
       continue;
    }

    const mapFilePath = path.join(NEXT_CHUNKS_DIR, `${relativeChunkPath}.map`);

    if (fs.existsSync(mapFilePath)) {
      const rawSourceMap = JSON.parse(fs.readFileSync(mapFilePath, 'utf8'));
      await SourceMapConsumer.with(rawSourceMap, null, (consumer) => {
        const sources = consumer.sources.map(s => {
          // Clean up source paths (remove webpack:/// and other prefixes)
          return s.replace(/^webpack:\/\/\//, '').replace(/^\.\//, '');
        }).filter(s => !s.includes('node_modules') && !s.includes('(webpack)'));
        
        results.push({
          ...leak,
          mapFile: mapFilePath,
          originalSources: sources.length > 0 ? sources : ['No non-node_modules sources found']
        });
      });
    } else {
      results.push({
        ...leak,
        error: `Source map not found at ${mapFilePath}`,
        originalSources: ['Unknown']
      });
    }
  }

  console.log('\n=== Memory Leak Source Mapping Report ===\n');
  results.forEach(res => {
    console.log(`Component: ${res.componentName}`);
    console.log(`Chunk:     ${res.chunkName}`);
    if (res.originalSources) {
      console.log(`Sources:   ${res.originalSources.join(', ')}`);
    }
    if (res.error) {
      console.log(`Error:     ${res.error}`);
    }
    console.log('-------------------------------------------\n');
  });

  fs.writeFileSync(
    path.join(process.cwd(), 'leak_mapping_report.json'),
    JSON.stringify(results, null, 2)
  );
  console.log(`Full report saved to leak_mapping_report.json`);
}

mapChunksToSources().catch(console.error);
