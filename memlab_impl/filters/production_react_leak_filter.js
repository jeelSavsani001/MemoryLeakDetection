// module.exports = {
//   leakFilter: function (node, snapshot) {
//     let hasMemoizedState = false;
//     let hasElementType = false;
//     let hasReturn = false;
    
//     let componentName = "Unknown Minified Component";
//     let chunkName = "Unknown Chunk File"; // 🔍 NEW: Placeholder for the file name

//     // 1. Scan the shape of the object
//     for (const edge of node.references) {
//       if (edge.name_or_index === 'memoizedState') hasMemoizedState = true;
//       if (edge.name_or_index === 'return') hasReturn = true;
      
//       if (edge.name_or_index === 'elementType') {
//         hasElementType = true;
//         const componentNode = edge.toNode;
        
//         // Get the minified component name (e.g., 't' or 'n')
//         if (componentNode.name && componentNode.name !== 'null') {
//           componentName = componentNode.name; 
//         }

//         // 🔍 NEW: Dive into the V8 Closure to extract the Script File Name
//         for (const funcEdge of componentNode.references) {
//           if (funcEdge.name_or_index === 'shared') {
//             const sharedFunctionInfo = funcEdge.toNode;
            
//             for (const sharedEdge of sharedFunctionInfo.references) {
//               if (sharedEdge.name_or_index === 'script_or_debug_info' || sharedEdge.name_or_index === 'script') {
//                 const scriptNode = sharedEdge.toNode;
                
//                 for (const scriptEdge of scriptNode.references) {
//                   // The 'name' property on a Script node holds the actual URL/Filename
//                   if (scriptEdge.name_or_index === 'name') {
//                     chunkName = scriptEdge.toNode.name;
//                     break;
//                   }
//                 }
//               }
//             }
//           }
//         }
//       }
//     }

//     // 2. The Ultimate React Signature
//     const isFiberShape = hasMemoizedState && hasElementType && hasReturn;

//     if (!isFiberShape || chunkName === "Unknown Chunk File") {
//       return false; // Throw it out, it's just random V8 noise
//     }

//     // 3. Print the results including the Webpack Chunk!
//     console.error(`\n🚨 BINGO! Leaked Component: <${componentName}>`);
//     console.error(`   📂 Found in Webpack Chunk: ${chunkName}`);
//     console.error(`--------------------------------------------------`);
    
//     return true; 
//   }
// };

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
        
        // 🛡️ GATEKEEPER 1: Ignore HTML Primitives
        // If elementType is a pure string ('div', 'span'), it's not our custom component.
        if (componentNode.type === 'string') {
          return false; 
        }

        if (componentNode.name && componentNode.name !== 'null') {
          componentName = componentNode.name; 
        }

        // Dive into the V8 Closure to extract the Script File Name
        for (const funcEdge of componentNode.references) {
          if (funcEdge.name_or_index === 'shared') {
            const sharedFunctionInfo = funcEdge.toNode;
            
            for (const sharedEdge of sharedFunctionInfo.references) {
              if (sharedEdge.name_or_index === 'script_or_debug_info' || sharedEdge.name_or_index === 'script') {
                const scriptNode = sharedEdge.toNode;
                
                for (const scriptEdge of scriptNode.references) {
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

    const isFiberShape = hasMemoizedState && hasElementType && hasReturn;
    if (!isFiberShape || chunkName === "Unknown Chunk File") {
      return false; 
    }

    // // 🛡️ GATEKEEPER 2: Victim vs. Culprit Check
    // // If this Fiber is just a 'child' or 'sibling' of another leaked Fiber, skip it.
    // // We only want the top-level culprit that started the leak.
    // let isHeldByAnotherFiber = false;
    // for (const retainer of node.referrers) {
    //   // If the incoming edge is a standard React tree traversal, it's a victim.
    //   if (retainer.name_or_index === 'child' || retainer.name_or_index === 'sibling') {
    //     isHeldByAnotherFiber = true;
    //     break;
    //   }
    // }

    // if (isHeldByAnotherFiber) {
    //   return false; // Throw out the victims, let's find the root cause!
    // }

    // 🛡️ GATEKEEPER 2: Victim vs. Culprit Check (Upgraded)
    let isHeldByAnotherFiber = false;
    
    // The complete list of React's internal Fiber pointers
    const reactInternalEdges = [
      'child', 
      'sibling', 
      'return', 
      'alternate', 
      '_debugOwner',
      'dependencies',
      'stateNode'
    ];

    for (const referrer of node.referrers) {
      // If the incoming edge is ANY standard React internal pointer, it is a victim or a ghost.
      if (reactInternalEdges.includes(referrer.name_or_index)) {
        isHeldByAnotherFiber = true;
        break;
      }
    }

    if (isHeldByAnotherFiber) {
      return false; // Throw out the ghosts and victims!
    } 
    // 3. Print the results!
    console.error(`\n🚨 BINGO! Leaked Component: <${componentName}>`);
    console.error(`   📂 Found in Webpack Chunk: ${chunkName}`);
    console.error(`--------------------------------------------------`);
    
    return true; 
  }
};