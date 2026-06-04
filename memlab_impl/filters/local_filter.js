const fs = require('fs');
 
module.exports = {
  leakFilter: function (node, snapshot) {
    if (typeof node.name !== 'string') return false;
 
    const isFiber = node.name.includes('FiberNode');
    const isDetached = node.name.includes('Detached');
 
    if (!isFiber || !isDetached) return false;
 
    // 1. BLACKLIST: Ignore text nodes and raw HTML (<div>, <p>)
    if (node.name.includes('HostText') || node.name.includes('HostComponent') || node.name.includes('HostRoot')) {
        return false;
    }
 
    let componentName = "Unknown Component";
    let locationData = "";
    
    // 2. Traverse the outgoing edges to find the React function
    for (const edge of node.references) {
      if (edge.name_or_index === 'elementType' || edge.name_or_index === 'type') {
        
        // Ensure V8 didn't give us the string "null"
        if (edge.toNode.name && edge.toNode.name !== 'null') {
          componentName = edge.toNode.name;
        }
        
        // Safely extract location data without printing the word "null"
        if (edge.toNode.location) {
          const loc = edge.toNode.location;
          locationData = `      Script ID: ${loc.script_id}\n      Line: ${loc.line}, Column: ${loc.column}\n`;
        }
        
        // Break early so we don't process both 'type' and 'elementType' twice!
        break;
      }
    }
 
    // 3. GATEKEEPER: Only log it if we actually found a valid React component name!
    if (componentName !== "Unknown Component") {
      let reportOutput = `🚨 BINGO! Found a leaked React Component: <${componentName}>\n`;
      
      if (locationData !== "") {
        reportOutput += `   📍 V8 Location Data:\n${locationData}`;
      } else {
        reportOutput += `   📍 V8 Location Data: (Not provided by V8 for this closure)\n`;
      }
      
      reportOutput += `--------------------------------------------------\n`;
 
      // 4. Append to file
      fs.appendFileSync('memlab_leak_report.txt', reportOutput, 'utf8');
 
      // Tell MemLab this is a confirmed leak
      return true;
    }
 
    // If it was just noise, return false so MemLab ignores it
    return false;
  }
};