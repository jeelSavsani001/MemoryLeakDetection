const fs = require('fs');

// Accumulated component info across all leakFilter calls.
// Runner reads this after run() completes.
const _collected = [];

module.exports = {
  leakFilter: function (node, snapshot) {
    let hasMemoizedState = false;
    let hasElementType = false;
    let hasReturn = false;
   
    let componentName = "Unknown Minified Component";
    let chunkName = "Unknown Chunk File";
 
    // 1. Scan the shape of the object
    for (const edge of node.references) {
      if (edge.name_or_index === 'memoizedState') hasMemoizedState = true;
      if (edge.name_or_index === 'return') hasReturn = true;
     
      if (edge.name_or_index === 'elementType') {
        hasElementType = true;
        const componentNode = edge.toNode;
       
        // Get the minified component name (e.g., 't' or 'n')
        if (componentNode.name && componentNode.name !== 'null') {
          componentName = componentNode.name;
        }
 
        // 🔍 Dive into the V8 Closure to extract the Script File Name
        for (const funcEdge of componentNode.references) {
          if (funcEdge.name_or_index === 'shared') {
            const sharedFunctionInfo = funcEdge.toNode;
           
            for (const sharedEdge of sharedFunctionInfo.references) {
              if (sharedEdge.name_or_index === 'script_or_debug_info' || sharedEdge.name_or_index === 'script') {
                const scriptNode = sharedEdge.toNode;
               
                for (const scriptEdge of scriptNode.references) {
                  // The 'name' property on a Script node holds the actual URL/Filename
                  if (scriptEdge.name_or_index === 'name') {
                    chunkName = scriptEdge.toNode.name;
                    break;
                  }
                }
              }
            }
          }
        }
      }
    }
 
    // 2. The Ultimate React Signature
    const isFiberShape = hasMemoizedState && hasElementType && hasReturn;
 
    fs.appendFileSync('debug_filter.txt', `Node: ${node.name}, isFiberShape: ${isFiberShape}, chunkName: ${chunkName}\n`);

    if (!isFiberShape || chunkName === "Unknown Chunk File") {
      return false; // Throw it out, it's just random V8 noise
    }
 
    // 3. Collect the results
    const info = {
      componentName,
      chunkName,
      retainedSize: node.retainedSize || 0,
      // For compatibility with runner.js expectations:
      hookTypes: [],
      componentStack: null,
    };
    
    _collected.push(info);

    // console.log often doesn't show up during heap analysis because memlab
    // may run this in a context where stdout is captured or suppressed.
    // We use _collected to pass data back to the main runner.
    
    return true;
  },
  _collected
};
