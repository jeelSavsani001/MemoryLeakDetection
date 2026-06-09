const fs = require('fs');

async function resolveLeaks() {
  if (!fs.existsSync('raw_leaks.jsonl')) {
    console.log("✅ No memory leaks found!");
    return;
  }

  // Read the JSONL file and parse each line
  const rawData = fs.readFileSync('raw_leaks.jsonl', 'utf8');
  const lines = rawData.split('\n').filter(line => line.trim() !== '');
  
  for (const line of lines) {
    const leak = JSON.parse(line);

    let filePath = "Unknown File Path";

    // Only attempt fetch if it's a valid localhost URL
    if (leak.url && leak.url.startsWith('http://localhost')) {
      try {
        const response = await fetch(leak.url);
        
        if (response.ok) {
          const jsText = await response.text();
          
          // The Turbopack HMR Regex Hack
          const match = jsText.match(/\[project\]\/([^"'\s]+)/);
          if (match && match[1]) {
            filePath = match[1]; 
          }
        }
      } catch (err) {
        filePath = "(Dev server unreachable. Could not resolve file.)";
      }
    }

    // Print the final, beautiful output
    console.log(`\n🚨 BINGO! Leaked React Component Detected`);
    console.log(`   🧩 Component: <${leak.component}>`);
    console.log(`   🏷️ Node ID: @${leak.id}`);
    console.log(`   📂 Source File: ${filePath}`);
    console.log(`--------------------------------------------------`);
  }

  // Cleanup the file for the next run
  fs.unlinkSync('raw_leaks.jsonl');
}

resolveLeaks();