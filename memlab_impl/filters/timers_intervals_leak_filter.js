const fs = require('fs');

module.exports = {
  leakFilter: function (node, snapshot) {
    // We only care about objects with string names
    if (typeof node.name !== 'string') return false;

    // 1. GATEKEEPER: Isolate Timers and Event Listeners
    // V8 typically labels these as 'Timeout', 'DOMTimer', 'EventListener', or 'V8EventListener'
    const isTimer = node.name === 'Timeout' || node.name === 'DOMTimer';
    const isListener = node.name === 'EventListener' || node.name === 'V8EventListener';

    if (!isTimer && !isListener) return false;

    let leakType = isTimer ? "Timer/Interval" : "Event Listener";
    let callbackName = "Anonymous Function";
    let scriptUrl = "Unknown Script";
    let locationData = "";

    let targetFunctionNode = null;

    // 2. THE DOWNWARD TRACE: Find the Callback Function (Universal BFS)
    // We use a queue to pierce through V8's internal wrappers
    let queue = [{ currentNode: node, depth: 0 }]; 
    const MAX_DEPTH = 5; // Go deep enough to pierce complex timer arrays

    while (queue.length > 0) {
      const { currentNode, depth } = queue.shift();

      if (depth > MAX_DEPTH) continue;

      for (const edge of currentNode.references) {
        const edgeName = String(edge.name_or_index);
        const toNode = edge.toNode;

        // BINGO! We found the actual JavaScript function
        if (toNode.type === 'closure') {
          targetFunctionNode = toNode;
          
          if (toNode.name && toNode.name !== 'null') {
            callbackName = toNode.name;
          }
          break; // Break the inner loop
        }
        
        // Push V8 internal wrappers to the queue to search inside them
        if (
          toNode.name === 'V8EventListener' || 
          toNode.name === 'ScheduledAction' || 
          toNode.name === 'V8Function' ||
          !isNaN(parseInt(edgeName, 10)) // If the edge is an array index (0, 1, 2...), follow it!
        ) {
          queue.push({ currentNode: toNode, depth: depth + 1 });
        }
      }
      
      if (targetFunctionNode) break; // Break the outer loop
    }

    // 3. THE SOURCE MAP EXTRACTION: Crack open the V8 Closure
    if (targetFunctionNode) {
      // Grab line/column if V8 attached it
      if (targetFunctionNode.location) {
        const loc = targetFunctionNode.location;
        locationData = `Line: ${loc.line}, Column: ${loc.column}`;
      }

      // Dive into SharedFunctionInfo to get the physical file name/URL
      for (const funcEdge of targetFunctionNode.references) {
        if (funcEdge.name_or_index === 'shared') {
          const sharedInfo = funcEdge.toNode;
          
          for (const sharedEdge of sharedInfo.references) {
            if (sharedEdge.name_or_index === 'script_or_debug_info' || sharedEdge.name_or_index === 'script') {
              const scriptNode = sharedEdge.toNode;
              
              for (const scriptEdge of scriptNode.references) {
                if (scriptEdge.name_or_index === 'name') {
                  scriptUrl = scriptEdge.toNode.name;
                  break;
                }
              }
            }
          }
        }
      }
    }

    // 4. THE NOISE FILTER: Ignore Framework Internals
    // Next.js and React have hundreds of internal timers and listeners.
    // If the leak comes from node_modules, we ignore it. We only want YOUR app's leaks.
    if (scriptUrl.includes('node_modules') || scriptUrl.includes('turbopack') ||scriptUrl === "Unknown Script") {
      return false;
    }

    // 5. PRINT THE BINGO
    let reportOutput = `\n🚨 BINGO! Dangling ${leakType} Detected!\n`;
    reportOutput += `   🪝 Callback Name: ${callbackName === '' ? '(Anonymous)' : callbackName}\n`;
    reportOutput += `   📂 Found in File: ${scriptUrl}\n`;
    
    if (locationData !== "") {
      reportOutput += `   📍 V8 Location: ${locationData}\n`;
    }
    reportOutput += `--------------------------------------------------\n`;

    console.error(reportOutput);
    fs.appendFileSync('timer_leak_report.txt', reportOutput, 'utf8');

    return true; 
  }
};