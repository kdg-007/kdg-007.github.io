/* ThinkIt Flowchart hierarchy, stage H1: pure presentation projection.
 * Canonical Flowchart nodes, edges and predecessor lists are NEVER rewritten.
 * Existing outlineParentId is the only hierarchy relation. `collapsed` is a
 * pre-existing optional node field; absent means expanded for legacy files.
 * No DOM, I/O, layout, cloud, autosave, or other diagram mode dependencies.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ThinkItFlowHierarchy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function plan(page, options = {}) {
    if (!page || page.mode !== 'flow' || !Array.isArray(page.nodes) || !Array.isArray(page.edges)) {
      throw new Error('Flowchart hierarchy requires a Flowchart page with nodes and edges');
    }
    const nodesById = new Map(), childrenById = new Map(), roots = [];
    for (const node of page.nodes) {
      if (!node || typeof node.id !== 'string' || !node.id || nodesById.has(node.id)) {
        throw new Error('Missing or duplicate Flowchart node ID');
      }
      nodesById.set(node.id, node);
      childrenById.set(node.id, []);
    }
    for (const node of page.nodes) {
      const parentId = node.outlineParentId ?? null;
      if (parentId === null) roots.push(node);
      else {
        const children = childrenById.get(parentId);
        if (!children) throw new Error('Missing Flowchart outline parent: ' + parentId);
        children.push(node);
      }
    }

    const customCollapse = options.collapsedIds;
    if (customCollapse !== undefined && Object.prototype.toString.call(customCollapse) !== '[object Set]') {
      throw new Error('collapsedIds must be a Set of node IDs');
    }
    if (customCollapse) for (const id of customCollapse) {
      if (!nodesById.has(id)) throw new Error('Unknown collapsed Flowchart node: ' + id);
    }
    const effectiveCollapsed = new Set();
    for (const node of page.nodes) {
      if (childrenById.get(node.id).length && (customCollapse ? customCollapse.has(node.id) : node.collapsed === true)) {
        effectiveCollapsed.add(node.id);
      }
    }

    // Iterative parent-first traversal, avoiding recursion for deep imported WBS.
    const walk = [], stack = roots.slice().reverse(), seen = new Set();
    const proxyById = new Map(), visible = new Set();
    while (stack.length) {
      const node = stack.pop();
      if (seen.has(node.id)) throw new Error('Circular Flowchart hierarchy');
      seen.add(node.id);
      walk.push(node);
      const parentId = node.outlineParentId ?? null;
      const hidden = parentId !== null && (!visible.has(parentId) || effectiveCollapsed.has(parentId));
      if (!hidden) visible.add(node.id);
      proxyById.set(node.id, hidden ? proxyById.get(parentId) : node.id);
      const kids = childrenById.get(node.id);
      for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
    }
    if (seen.size !== page.nodes.length) throw new Error('Circular Flowchart hierarchy');

    const descendantCount = new Map(page.nodes.map(node => [node.id, 0]));
    for (let i = walk.length - 1; i >= 0; i--) {
      const node = walk[i], parentId = node.outlineParentId ?? null;
      if (parentId !== null) descendantCount.set(parentId,
        descendantCount.get(parentId) + descendantCount.get(node.id) + 1);
    }
    const edgeViews = [], suppressedEdgeIds = [], edgeIds = new Set();
    for (const original of page.edges) {
      if (!original || typeof original.id !== 'string' || !original.id || edgeIds.has(original.id)) {
        throw new Error('Missing or duplicate Flowchart edge ID');
      }
      edgeIds.add(original.id);
      if (original.from == null && original.to == null && original.start && original.end) {
        edgeViews.push({...original}); // free annotation arrow
        continue;
      }
      if (!nodesById.has(original.from) || !nodesById.has(original.to)) {
        throw new Error('Flowchart edge has a missing canonical endpoint: ' + original.id);
      }
      const from = proxyById.get(original.from), to = proxyById.get(original.to);
      const projected = from !== original.from || to !== original.to;
      // Connections wholly inside a collapsed container remain in page.edges.
      if (projected && from === to) {
        suppressedEdgeIds.push(original.id);
        continue;
      }
      edgeViews.push(projected ? {
        ...original, from, to,
        fromPort: from !== original.from ? 'auto' : original.fromPort,
        toPort: to !== original.to ? 'auto' : original.toPort,
        displayProjection: {canonicalFrom: original.from, canonicalTo: original.to}
      } : {...original});
    }
    return {
      visibleNodeIds: page.nodes.filter(n => visible.has(n.id)).map(n => n.id),
      hiddenNodeIds: page.nodes.filter(n => !visible.has(n.id)).map(n => n.id),
      proxyById, descendantCount, effectiveCollapsed, edgeViews, suppressedEdgeIds
    };
  }
  return Object.freeze({plan});
});
