const fs = require('fs');
const { utils } = require('@memlab/core');

// Accumulated component info across all leakFilter calls.
const _collected = [];

module.exports = {
  leakFilter: function (node, snapshot) {
    // 1. Primary identification: Use memlab's built-in Fiber identification
    let isFiber = utils.isFiberNode(node);
    
    // 2. Fallback identification: Check by shape (useful if constructor names are mangled)
    let hasMemoizedState = false;
    let hasElementType = false;
    let hasReturn = false;
    let elementTypeNode = null;

    // Use forEachReference for better performance on large snapshots
    node.forEachReference((edge) => {
      const name = edge.name_or_index;
      if (name === 'memoizedState') hasMemoizedState = true;
      if (name === 'return') hasReturn = true;
      if (name === 'elementType' || name === 'type') {
        hasElementType = true;
        elementTypeNode = edge.toNode;
      }
    });

    const isFiberShape = hasMemoizedState && hasElementType && hasReturn;
    
    if (!isFiber && !isFiberShape) {
      return false;
    }

    // 3. Extract Component Name
    let componentName = "Unknown Component";
    const fiberInfo = utils.extractFiberNodeInfo(node);
    if (fiberInfo && fiberInfo.includes(' ')) {
      componentName = fiberInfo.split(' ').slice(1).join(' ');
    } else if (elementTypeNode && elementTypeNode.name && elementTypeNode.name !== 'null') {
      componentName = elementTypeNode.name;
    }

    // 4. Extract Source File (Chunk Name)
    let chunkName = "Unknown Chunk File";
    if (elementTypeNode) {
      // Traverse V8 internals to find the script name
      let targetFunc = elementTypeNode;
      
      // If it's a memo or forwardRef, elementType points to an object, dive into .type
      if (elementTypeNode.type === 'object') {
        elementTypeNode.forEachReference(edge => {
          if (edge.name_or_index === 'type' || edge.name_or_index === 'render') {
            targetFunc = edge.toNode;
          }
        });
      }

      targetFunc.forEachReference(funcEdge => {
        if (funcEdge.name_or_index === 'shared') {
          const sharedFunctionInfo = funcEdge.toNode;
          sharedFunctionInfo.forEachReference(sharedEdge => {
            if (sharedEdge.name_or_index === 'script_or_debug_info' || sharedEdge.name_or_index === 'script') {
              const scriptNode = sharedEdge.toNode;
              scriptNode.forEachReference(scriptEdge => {
                if (scriptEdge.name_or_index === 'name' && scriptEdge.toNode.type === 'string') {
                  chunkName = scriptEdge.toNode.name;
                }
              });
            }
          });
        }
      });
    }

    // fs.appendFileSync('debug_filter.txt', `Node: ${node.name}, isFiber: ${isFiber}, shape: ${isFiberShape}, component: ${componentName}, chunk: ${chunkName}\n`);

    if (chunkName === "Unknown Chunk File" && componentName === "Unknown Component") {
      return false;
    }

    // 5. Collect the results
    const info = {
      componentName,
      chunkName,
      retainedSize: node.retainedSize || 0,
      hookTypes: [],
      componentStack: null,
    };
    
    _collected.push(info);
    return true;
  },
  _collected
};

