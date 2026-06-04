'use strict';

// Accumulated component info across all leakFilter calls.
// Runner reads this after run() completes — Node module cache keeps the
// same array reference between leak_filter.js and runner.js imports.
const _collected = [];

/**
 * Find a single outgoing edge (reference) on a heap node by property name.
 * Returns the edge, or null if not found.
 */
function findEdge(node, edgeName) {
  for (const edge of node.references) {
    if (edge.name_or_index === edgeName) return edge;
  }
  return null;
}

/**
 * Given a leaked FiberNode heap node, extract everything useful:
 *   - componentName   : React display name (handles memo/forwardRef too)
 *   - retainedSize    : bytes retained in memory
 *   - location        : V8 source location of the component function
 *   - hookTypes       : hook names from React dev-mode _debugHookTypes
 *   - componentStack  : Error.stack string from React dev-mode _debugStack
 */
function extractFiberInfo(fiberNode) {
  const info = {
    nodeId: fiberNode.id,
    componentName: null,
    retainedSize: fiberNode.retainedSize || 0,
    location: null,
    hookTypes: [],
    componentStack: null,
  };

  // ── 1. Component name + V8 source location ───────────────────────────
  // A FiberNode's 'type' edge points to the component function (or a
  // memo/forwardRef wrapper object). 'elementType' is the same for most
  // cases; we prefer 'type' and fall back to 'elementType'.
  const typeEdge = findEdge(fiberNode, 'type') || findEdge(fiberNode, 'elementType');
  if (typeEdge && typeEdge.toNode) {
    const typeNode = typeEdge.toNode;

    // Valid component names start with an uppercase letter.
    // V8 heap node names like 'null', 'Object', 'true', or empty strings are
    // primitives / host nodes, not component function names.
    const isValidName = (n) =>
      typeof n === 'string' && n.length > 0 && /^[A-Z]/.test(n);

    // Plain function / class component — typeNode.name is the display name
    if (isValidName(typeNode.name)) {
      info.componentName = typeNode.name;
    } else {
      // React.memo wraps a function at .type; React.forwardRef puts it at .render
      const innerEdge = findEdge(typeNode, 'render') || findEdge(typeNode, 'type');
      if (innerEdge && innerEdge.toNode && isValidName(innerEdge.toNode.name)) {
        info.componentName = innerEdge.toNode.name;
      }
    }

    // V8 stores function source location on the function closure node.
    // script_id, line, and column are 0-based integers from V8.
    if (typeNode.location) {
      info.location = {
        script_id: typeNode.location.script_id,
        line: typeNode.location.line,
        column: typeNode.location.column,
      };
    }
  }

  // ── 2. Hook types from _debugHookTypes (React dev-mode array) ────────
  // React attaches an array of hook-type strings to every fiber in dev mode.
  // Each element is a string like 'useState', 'useEffect', 'useRef', etc.
  const hookTypesEdge = findEdge(fiberNode, '_debugHookTypes');
  if (hookTypesEdge && hookTypesEdge.toNode) {
    for (const hookEdge of hookTypesEdge.toNode.references) {
      // Only numeric indices are array elements (skip 'length' and internal edges).
      // Only keep names that look like real React hooks (start with 'use').
      if (
        typeof hookEdge.name_or_index === 'number' &&
        hookEdge.toNode &&
        typeof hookEdge.toNode.name === 'string' &&
        hookEdge.toNode.name.startsWith('use')
      ) {
        info.hookTypes.push(hookEdge.toNode.name);
      }
    }
  }

  // ── 3. Component stack from _debugStack Error.stack ──────────────────
  // React (dev mode) attaches an Error object to every fiber at creation
  // time. Its .stack property is a V8 stack trace that includes the real
  // source URL and line number from Turbopack/webpack, which is invaluable
  // for pointing developers directly to the file.
  const debugStackEdge = findEdge(fiberNode, '_debugStack');
  if (debugStackEdge && debugStackEdge.toNode) {
    const errorNode = debugStackEdge.toNode;
    const stackEdge = findEdge(errorNode, 'stack');
    if (stackEdge && stackEdge.toNode) {
      info.componentStack = stackEdge.toNode.name || null;
    }
  }

  return info;
}

module.exports = {
  /**
   * The accumulated list of extracted fiber infos. Populated during leakFilter
   * calls; read by runner.js after run() resolves.
   */
  _collected,

  /**
   * Memlab calls this for every unreleased heap node after the 'back' action.
   * Pure predicate — no I/O, no side effects beyond pushing to _collected.
   *
   * Docs: https://facebook.github.io/memlab/docs/api/core/src/interfaces/IScenario/#leakfilter
   *
   * @param {IHeapNode} node
   * @returns {boolean}
   */
  leakFilter(node) {
    // Only consider objects whose V8 class name contains 'FiberNode'
    if (typeof node.name !== 'string' || !node.name.includes('FiberNode')) {
      return false;
    }

    // Locate the 'type' edge — it determines the component kind
    const typeEdge = findEdge(node, 'type') || findEdge(node, 'elementType');
    if (!typeEdge || !typeEdge.toNode) return false;

    // Skip host-component fibers: their 'type' is a string node ('div', 'h1', …)
    // We only want user-defined function/class components.
    if (typeEdge.toNode.type === 'string') return false;

    const info = extractFiberInfo(node);

    // Only report fibers where we successfully resolved a component name
    if (!info.componentName) return false;

    _collected.push(info);
    console.log('🚨 BINGO!');
    return true;
  },

  // Exported so runner.js can call it for standalone post-processing if needed
  extractFiberInfo,
};
