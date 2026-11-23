/**
 * Shared geometry helpers and M0 geometry checks for flowstory.
 */

export const MIN_NODE_GAP = 10;
export const LABEL_PAD_X = 12;
export const LABEL_PAD_Y = 5;
export const EDGE_LABEL_H = 20;

/**
 * Conservative deterministic text width estimate (px) for system sans-serif.
 */
export function estimateTextWidth(text, fontSize = 12) {
  if (!text) return 0;
  return Math.ceil(String(text).length * fontSize * 0.62);
}

export function boxesOverlap(a, b, pad = 0) {
  return (
    a.x < b.x + b.w + pad &&
    a.x + a.w + pad > b.x &&
    a.y < b.y + b.h + pad &&
    a.y + a.h + pad > b.y
  );
}

/**
 * Returns true if segment p1-p2 intersects the interior (or within `pad`) of `box`.
 */
export function segmentIntersectsBox(p1, p2, box, pad = 0) {
  const minX = box.x - pad;
  const maxX = box.x + box.w + pad;
  const minY = box.y - pad;
  const maxY = box.y + box.h + pad;

  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];

  let t0 = 0;
  let t1 = 1;

  const checks = [
    [-dx, p1[0] - minX],
    [dx, maxX - p1[0]],
    [-dy, p1[1] - minY],
    [dy, maxY - p1[1]]
  ];

  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }

  return t0 <= t1;
}

/**
 * Returns true if two segments a1-a2 and b1-b2 properly cross or overlap.
 */
export function segmentsCross(a1, a2, b1, b2) {
  const d1x = a2[0] - a1[0];
  const d1y = a2[1] - a1[1];
  const d2x = b2[0] - b1[0];
  const d2y = b2[1] - b1[1];

  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) {
    // Parallel / collinear: check if they overlap on the same line
    const cross = (b1[0] - a1[0]) * d1y - (b1[1] - a1[1]) * d1x;
    if (Math.abs(cross) > 1e-6) return false;
    const minAx = Math.min(a1[0], a2[0]);
    const maxAx = Math.max(a1[0], a2[0]);
    const minAy = Math.min(a1[1], a2[1]);
    const maxAy = Math.max(a1[1], a2[1]);
    const minBx = Math.min(b1[0], b2[0]);
    const maxBx = Math.max(b1[0], b2[0]);
    const minBy = Math.min(b1[1], b2[1]);
    const maxBy = Math.max(b1[1], b2[1]);
    return maxAx > minBx + 1 && maxBx > minAx + 1 && maxAy > minBy + 1 && maxBy > minAy + 1;
  }

  const t = ((b1[0] - a1[0]) * d2y - (b1[1] - a1[1]) * d2x) / denom;
  const u = ((b1[0] - a1[0]) * d1y - (b1[1] - a1[1]) * d1x) / denom;
  return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
}

/**
 * Returns true if point `pt` lies on the border of `box` within `eps`.
 */
export function isPointOnBoxBorder(pt, box, eps = 2) {
  const [x, y] = pt;
  const inX = x >= box.x - eps && x <= box.x + box.w + eps;
  const inY = y >= box.y - eps && y <= box.y + box.h + eps;
  if (!inX || !inY) return false;

  const onLeft = Math.abs(x - box.x) <= eps;
  const onRight = Math.abs(x - (box.x + box.w)) <= eps;
  const onTop = Math.abs(y - box.y) <= eps;
  const onBottom = Math.abs(y - (box.y + box.h)) <= eps;
  return onLeft || onRight || onTop || onBottom;
}

/**
 * Run all M0 geometry checks on a computed layout.
 * Structured per-view so M2 can plug in view visibility filtering and `view-stable`.
 */
export function checkLayout(spec, layout) {
  const errors = [];
  const viewIds = Array.isArray(spec.views) && spec.views.length > 0
    ? ['default'] // M0 checks the combined layout; M2 will iterate per view
    : ['default'];

  const nodeMap = new Map(layout.nodes.map((n) => [n.id, n]));

  for (const viewId of viewIds) {
    const nodes = layout.nodes;
    const edges = layout.edges;

    // 1. node-overlap
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (boxesOverlap(nodes[i], nodes[j], MIN_NODE_GAP)) {
          errors.push({
            code: 'node-overlap',
            view: viewId,
            nodes: [nodes[i].id, nodes[j].id],
            message: `Nodes '${nodes[i].id}' and '${nodes[j].id}' overlap or are closer than ${MIN_NODE_GAP}px.`
          });
        }
      }
    }

    // 2. edge-detached & 3. edge-through-node
    for (const edge of edges) {
      const pts = edge.pts || [];
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);

      if (pts.length < 2 || !fromNode || !toNode) {
        errors.push({
          code: 'edge-detached',
          view: viewId,
          edge: edge.id,
          message: `Edge '${edge.id}' is missing endpoints or route points.`
        });
        continue;
      }

      if (!isPointOnBoxBorder(pts[0], fromNode) || !isPointOnBoxBorder(pts[pts.length - 1], toNode)) {
        errors.push({
          code: 'edge-detached',
          view: viewId,
          edge: edge.id,
          message: `Edge '${edge.id}' does not start on '${edge.from}' border and end on '${edge.to}' border.`
        });
      }

      for (let s = 0; s < pts.length - 1; s++) {
        const p1 = pts[s];
        const p2 = pts[s + 1];
        for (const node of nodes) {
          if (node.id === edge.from || node.id === edge.to) continue;
          if (segmentIntersectsBox(p1, p2, node, 1)) {
            errors.push({
              code: 'edge-through-node',
              view: viewId,
              edge: edge.id,
              node: node.id,
              message: `Edge '${edge.id}' passes through node '${node.id}'.`
            });
            break;
          }
        }
      }
    }

    // 4. label-off-canvas & 5. label-overlap
    const labelBoxes = [];
    for (const edge of edges) {
      if (!edge.labelBox) continue;
      const lb = edge.labelBox;
      if (
        lb.x < 0 ||
        lb.y < 0 ||
        lb.x + lb.w > layout.canvas.width ||
        lb.y + lb.h > layout.canvas.height
      ) {
        errors.push({
          code: 'label-off-canvas',
          view: viewId,
          edge: edge.id,
          message: `Label for edge '${edge.id}' extends outside the canvas (${layout.canvas.width}x${layout.canvas.height}).`
        });
      }

      for (const node of nodes) {
        if (boxesOverlap(lb, node, 2)) {
          errors.push({
            code: 'label-overlap',
            view: viewId,
            edge: edge.id,
            node: node.id,
            message: `Label for edge '${edge.id}' overlaps node '${node.id}'.`
          });
        }
      }

      for (const prev of labelBoxes) {
        if (boxesOverlap(lb, prev.box, 2)) {
          errors.push({
            code: 'label-overlap',
            view: viewId,
            edges: [edge.id, prev.edgeId],
            message: `Label for edge '${edge.id}' overlaps label for edge '${prev.edgeId}'.`
          });
        }
      }

      labelBoxes.push({ edgeId: edge.id, box: lb });
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}
