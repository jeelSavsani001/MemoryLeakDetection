// const fs = require('fs');

// module.exports = {
//   leakFilter: function (node, snapshot) {
//     if (typeof node.name !== 'string') return false;

//     const isFiber = node.name.includes('FiberNode');
//     const isDetached = node.name.includes('Detached');

//     if (!isFiber || !isDetached) return false;

//     // 1. BLACKLIST: Ignore text nodes and raw HTML (<div>, <p>)
//     if (node.name.includes('HostText') || node.name.includes('HostComponent') || node.name.includes('HostRoot')) {
//         return false;
//     }

//     // 🛡️ NEW GATEKEEPER: Ignore React Ghosts!
//     let isReactGhost = false;

//     for (const referrerEdge of node.referrers) {
//       const edgeName = String(referrerEdge.name_or_index);

//       // Case 1: Direct pointers (alternate, _debugOwner, return, stateNode)
//       if (
//         edgeName === 'alternate' || 
//         edgeName === '_debugOwner' || 
//         edgeName === 'return'
//       ) {
//         isReactGhost = true;
//         break;
//       }

//       // Case 2: The Array Proxy Trap (deletions, dependencies)
//       // If the edge name is a number (like '0' or '1'), it means we are inside an Array.
//       // We need to look one step further back to see WHO is holding the Array.
//       if (!isNaN(parseInt(edgeName, 10)) && referrerEdge.fromNode) {
//         const parentArrayNode = referrerEdge.fromNode;

//         // Check the incoming edges to the Array itself
//         for (const arrayReferrerEdge of parentArrayNode.referrers) {
//           if (
//             arrayReferrerEdge.name_or_index === 'deletions' || 
//             arrayReferrerEdge.name_or_index === 'dependencies'
//           ) {
//             isReactGhost = true;
//             break; // Break the inner loop
//           }
//         }
//       }

//       if (isReactGhost) break; // Break the outer loop
//     }

//     if (isReactGhost) {
//       return false; // Throw it out, it's just React doing internal cleanup!
//     }

//     let componentName = "Unknown Component";
//     let locationData = "";
    
//     // 2. Traverse the outgoing edges to find the React function
//     for (const edge of node.references) {
//       if (edge.name_or_index === 'elementType' || edge.name_or_index === 'type') {
        
//         if (edge.toNode.name && edge.toNode.name !== 'null') {
//           componentName = edge.toNode.name;
//         }
        
//         if (edge.toNode.location) {
//           const loc = edge.toNode.location;
//           locationData = `      Script ID: ${loc.script_id}\n      Line: ${loc.line}, Column: ${loc.column}\n`;
//         }
        
//         break; 
//       }
//     }

//     // 3. GATEKEEPER: Only log it if we actually found a valid React component name!
//     if (componentName !== "Unknown Component") {
//       let reportOutput = `🚨 BINGO! Found a leaked React Component: <${componentName}>\n`;
      
//       if (locationData !== "") {
//         reportOutput += `   📍 V8 Location Data:\n${locationData}`;
//       } else {
//         reportOutput += `   📍 V8 Location Data: (Not provided by V8 for this closure)\n`;
//       }
      
//       reportOutput += `--------------------------------------------------\n`;

//       // 4. Append to file
//       fs.appendFileSync('memlab_leak_report.txt', reportOutput, 'utf8');

//       return true; 
//     }

//     return false;
//   }
// };
const fs = require('fs');

module.exports = {
  leakFilter: function (node, snapshot) {
    let detailsPageLogs = "";
    let printOrNot = false;

    // 1. Check if it's the component we are debugging
    if (getComponentName(node) === "DetailsPage") {
      printOrNot = true;
      detailsPageLogs += `\n🔍 Analyzing leak candidate: Node @${node.id} | "${node.name}"\n`;
    }

    if (!isFiberNodeLocal(node)) {
        if (printOrNot) fs.appendFileSync('details_page_analysis.txt', detailsPageLogs + "  ❌ Exited: Not a FiberNode\n", 'utf8');
        return false;
    }

    if (printOrNot) {
      detailsPageLogs += `   ✅ Passed FiberNode check: "${node.name}"\n`;
    }
    
    if (isPrimitiveFiber(node)) {
        if (printOrNot) fs.appendFileSync('details_page_analysis.txt', detailsPageLogs + "  ❌ Exited: Is Primitive Fiber\n", 'utf8');
        return false;
    }

    if (printOrNot) {
      detailsPageLogs += `   ✅ Passed Primitive Fiber check: Custom React component.\n`;
    }

    let cur = node;
    const visitedIds = new Set();
    
    // 🛡️ THE INVERSION FIX: Assume it is a leak until proven attached!
    let isDetachedLeak = true; 

    // 2. UPWARD TRAVERSAL & DOMINATOR CHECK (Production Parity)
    while (cur && isFiberNodeLocal(cur)) {
      if (visitedIds.has(cur.id)) break;
      visitedIds.add(cur.id);

      if (printOrNot) {
        detailsPageLogs += `   🔍 Traversing up: Currently at "${cur.name}" (Node @${cur.id})\n`;
      }

      // Check if we hit the active React Root
      if (isHostRootLocal(cur)) {
        if (printOrNot) {
          detailsPageLogs += `   🏁 Hit the HostRoot! Proven attached to the active DOM.\n`;
          fs.appendFileSync('details_page_analysis.txt', detailsPageLogs, 'utf8');
        }
        isDetachedLeak = false; // Proven innocent!
        return false; 
      }

      const dominator = cur.dominatorNode;
      if (dominator && dominator.id !== 1) {
        if (printOrNot) {
          detailsPageLogs += `   🕵️‍♂️ Checking dominator: "${dominator.name}" (Node @${dominator.id})\n`;
        }
        if (isDOMNodeLocal(dominator) && !isDetachedDOMNodeLocal(dominator)) {
          if (printOrNot) {
            detailsPageLogs += `   🕵️‍♂️ Dominated by a healthy, attached DOM element. Proven innocent.\n`;
            fs.appendFileSync('details_page_analysis.txt', detailsPageLogs, 'utf8');
          }
          isDetachedLeak = false; // Proven innocent!
          return false; 
        } else if (!isFiberNodeLocal(dominator)) {
          // Structurally severed by a non-React dominator!
          isDetachedLeak = true; 
          break;
        }
      }

      cur = getReactFiberNodeLocal(cur, 'return');
    }

    // 3. THE NOISE GUARDS
    if (isDetachedLeak) {
      if (printOrNot) {
        detailsPageLogs += `   🚨 Found a detached leak! Checking noise guards...\n`;
      }
      
      if (isNodeDominatedByDeletionsArray(node)) {
        if (printOrNot) {
            detailsPageLogs += `   ❌ Exited: React Ghost! Dominated by deletions array.\n`;
            fs.appendFileSync('details_page_analysis.txt', detailsPageLogs, 'utf8');
        }
        return false;
      }

      if (printOrNot) {
        detailsPageLogs += `   ✅ Passed Deletions Array check.\n`;
      }
      
      if (isNodeDominatedByDevTools(node)) {
        if (printOrNot) {
            detailsPageLogs += `   ❌ Exited: DevTools artifact.\n`;
            fs.appendFileSync('details_page_analysis.txt', detailsPageLogs, 'utf8');
        }
        return false;
      }

      if (printOrNot) {
        detailsPageLogs += `   ✅ Passed DevTools check.\n`;
      }

      // 🚨 BINGO! Extract component name and chunk URL
      const componentName = getComponentName(node);
      const chunkUrl = getChunkURLFromFiber(node);
      
      const leakData = {
        id: node.id,
        component: componentName,
        url: chunkUrl
      };
      
      fs.appendFileSync('raw_leaks.jsonl', JSON.stringify(leakData) + '\n', 'utf8');
      
      if (printOrNot) {
          detailsPageLogs += `   🎯 CONFIRMED BINGO! Dumped to raw_leaks.jsonl\n`;
          fs.appendFileSync('details_page_analysis.txt', detailsPageLogs, 'utf8');
      }
      return true;
    }

    // 🛡️ THE FIX: This was the silent killer! 
    // If the node wasn't a detached leak, it exited here without printing.
    if (printOrNot) {
        detailsPageLogs += `   ❌ Traversal finished, but isDetachedLeak was false. It is not a leak.\n`;
        fs.appendFileSync('details_page_analysis.txt', detailsPageLogs, 'utf8');
    }
    
    return false;
  }
};

// --- LOCAL DEV HELPERS ---

/**
 * 🛡️ THE FIX: Identifies native HTML elements and text nodes structurally
 */
function isPrimitiveFiber(fiberNode) {
  const typeNode = getToNodeByEdge(fiberNode, 'elementType') || getToNodeByEdge(fiberNode, 'type');
  
  // 1. HostText (Raw text inside tags) usually lacks an elementType or it points to 'null'
  if (!typeNode || typeNode.name === 'null') {
    return true; 
  }
  
  // 2. HostComponent (Native HTML tags) have an elementType that is a literal string ("div", "button")
  if (typeNode.type === 'string') {
    return true; 
  }
  
  // It's a custom React component (Closure/Object)!
  return false;
}

function isFiberNodeLocal(node) {
  if (!node || typeof node.name !== 'string') return false;
  return node.name.includes('FiberNode'); // Catches "FiberNode" and "Detached FiberNode"
}

function isHostRootLocal(node) {
  if (!isFiberNodeLocal(node)) return false;
  const stateNode = getToNodeByEdge(node, 'stateNode');
  // In local dev, minification isn't a problem, so we can check the name directly!
  return !!stateNode && stateNode.name === 'FiberRootNode';
}

function getReactFiberNodeLocal(node, propName) {
  if (!node || !isFiberNodeLocal(node)) return null;
  const targetNode = getToNodeByEdge(node, propName);
  return isFiberNodeLocal(targetNode) ? targetNode : null;
}

function getToNodeByEdge(node, edgeName) {
  if (!node.references) return null;
  for (const edge of node.references) {
    if (String(edge.name_or_index) === edgeName) {
      return edge.toNode;
    }
  }
  return null;
}

const htmlElementRegex = /^HTML.*Element$/;
const svgElementRegex = /^SVG.*Element$/;
const htmlCollectionRegex = /^HTML.*Collection$/;
const cssElementRegex = /^CSS/;
const styleSheetRegex = /StyleSheet/;
const newDOMNodeRegex = /^<[a-zA-Z]+.*>$/;

const domElementSpecialNames = new Set([
  'DOMTokenList', 
  'HTMLDocument', 
  'InternalNode', 
  'Text', 
  'XMLDocument'
]);

function isDOMNodeLocal(node) {
  if (!node || node.type !== 'native') return false;
  
  let name = node.name || '';
  
  if (name.startsWith('Detached ')) {
    name = name.substring(9); // "Detached ".length is 9
  }
  
  name = name.trim();

  // Test against all structural DOM patterns
  return (
    htmlElementRegex.test(name) ||
    svgElementRegex.test(name) ||
    cssElementRegex.test(name) ||
    styleSheetRegex.test(name) ||
    htmlCollectionRegex.test(name) ||
    newDOMNodeRegex.test(name) ||
    domElementSpecialNames.has(name)
  );
}

function isDetachedDOMNodeLocal(node) {
  if (!node || isFiberNodeLocal(node)) return false;
  return String(node.name).startsWith('Detached ');
}

function getComponentName(node) {
  const elementTypeNode = getToNodeByEdge(node, 'elementType') || getToNodeByEdge(node, 'type');
  if (elementTypeNode && elementTypeNode.name && elementTypeNode.name !== 'null') {
    return elementTypeNode.name;
  }
  return "Unknown Component";
}

function getChunkURLFromFiber(fiberNode) {
  const componentClosure = getToNodeByEdge(fiberNode, 'elementType') || getToNodeByEdge(fiberNode, 'type');
  if (!componentClosure || componentClosure.type === 'string') return "Built-in HTML Element";

  const sharedInfoNode = getToNodeByEdge(componentClosure, 'shared');
  if (!sharedInfoNode) return "Unknown File";

  // V8 wraps scripts differently depending on the engine state, check both common names
  const scriptNode = getToNodeByEdge(sharedInfoNode, 'script_or_debug_info') || getToNodeByEdge(sharedInfoNode, 'script');
  if (!scriptNode || !scriptNode.references) return "Unknown File";

  const nameNodeEdge = getToNodeByEdge(scriptNode, 'name');
  if (nameNodeEdge) return nameNodeEdge.name;

  return "Unknown File";
}

/**
 * Bridges the gap between the Fiber Object and the Function Closure
 * to extract MemLab's pre-computed location data.
 */
function getLocationFromFiber(fiberNode) {
  // Jump from the Fiber to the actual React function (the Closure)
  const componentClosure = getToNodeByEdge(fiberNode, 'elementType') || getToNodeByEdge(fiberNode, 'type');
  
  // If we found the closure and MemLab successfully attached the location data
  if (componentClosure && componentClosure.location) {
    return {
      line: componentClosure.location.line,
      column: componentClosure.location.column
    };
  }
  
  return null; // Fallback if it's a native HTML element without a location
}

// --- DOMINATOR NOISE GUARDS ---

function isNodeDominatedByDeletionsArray(node) {
  let cur = node;
  const visited = new Set();
  while (cur && cur.id !== 1) { 
    if (visited.has(cur.id)) break;
    visited.add(cur.id);
    if (cur.referrers) {
      for (const edge of cur.referrers) {
        if (String(edge.name_or_index) === 'deletions') return true; 
      }
    }
    cur = cur.dominatorNode;
  }
  return false;
}

function isNodeDominatedByDevTools(node) {
  let cur = node;
  const visited = new Set();
  while (cur && cur.id !== 1) {
    if (visited.has(cur.id)) break;
    visited.add(cur.id);
    if (cur.name && String(cur.name).includes('DevTools console')) return true;
    if (cur.referrers) {
      for (const edge of cur.referrers) {
        if (String(edge.name_or_index).includes('DevTools console')) return true;
      }
    }
    cur = cur.dominatorNode;
  }
  return false;
}