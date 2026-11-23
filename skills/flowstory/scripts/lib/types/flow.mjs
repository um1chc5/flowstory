/**
 * Flow diagram layout:
 * 1. Lanes -> columns, rows -> y positions, manual x/y respected
 * 2. Group boxes (bottom-up for nested groups)
 * 3. Orthogonal edge routing (A* on sparse channel grid, port spreading, manual pts as obstacles)
 * 4. Greedy label placement (highest-degree edges first)
 */
import {
  estimateTextWidth,
  boxesOverlap,
  segmentIntersectsBox,
  segmentsCross,
  LABEL_PAD_X,
  EDGE_LABEL_H
} from '../geometry.mjs';

const CANVAS_PAD_X = 48;
const CANVAS_PAD_Y = 36;
const LANE_HEADER_H = 38;
const LANE_PAD_X = 24;
const LANE_GAP = 64;
const ROW_PITCH = 108;
const NODE_H_SINGLE = 46;
const NODE_H_SUB = 60;
const NODE_MIN_W = 152;
const PORT_STUB = 14;
const NODE_CLEARANCE = 6;

class MinHeap {
  constructor() {
    this.data = [];
  }
  push(item) {
    this.data.push(item);
    let i = this.data.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].f <= this.data[i].f) break;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
      i = p;
    }
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      let i = 0;
      const n = this.data.length;
      while (true) {
        let best = i;
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        if (l < n && this.data[l].f < this.data[best].f) best = l;
        if (r < n && this.data[r].f < this.data[best].f) best = r;
        if (best === i) break;
        [this.data[i], this.data[best]] = [this.data[best], this.data[i]];
        i = best;
      }
    }
    return top;
  }
  get size() {
    return this.data.length;
  }
}

function dedupeCoords(arr, minDiff = 2) {
  const sorted = [...arr].sort((a, b) => a - b);
  const out = [];
  for (const v of sorted) {
    if (out.length === 0 || v - out[out.length - 1] >= minDiff) {
      out.push(v);
    }
  }
  return out;
}

function computeNodeSizes(spec) {
  const sizes = new Map();
  for (const n of spec.nodes) {
    const labelW = estimateTextWidth(n.label || n.id, 13);
    const subW = n.sub ? estimateTextWidth(n.sub, 11) : 0;
    const w = Math.max(NODE_MIN_W, Math.max(labelW, subW) + 54);
    const baseH = n.sub ? NODE_H_SUB : NODE_H_SINGLE;
    const span = typeof n.span === 'number' && n.span > 1 ? n.span : 1;
    const h = span > 1 ? Math.round((span - 1) * ROW_PITCH + baseH) : baseH;
    sizes.set(n.id, { w, h });
  }
  return sizes;
}

function chooseSide(fromNode, toNode) {
  if (fromNode.id === toNode.id) return { fromSide: 'right', toSide: 'bottom' };
  const fc = { x: fromNode.x + fromNode.w / 2, y: fromNode.y + fromNode.h / 2 };
  const tc = { x: toNode.x + toNode.w / 2, y: toNode.y + toNode.h / 2 };
  const dx = tc.x - fc.x;
  const dy = tc.y - fc.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { fromSide: 'right', toSide: 'left' } : { fromSide: 'left', toSide: 'right' };
  }
  return dy >= 0 ? { fromSide: 'bottom', toSide: 'top' } : { fromSide: 'top', toSide: 'bottom' };
}

function assignPorts(edges, nodeMap) {
  // Group edge ends by (nodeId, side)
  const buckets = new Map();
  const edgeSides = new Map();

  for (const e of edges) {
    const fn = nodeMap.get(e.from);
    const tn = nodeMap.get(e.to);
    if (!fn || !tn) continue;
    const { fromSide, toSide } = chooseSide(fn, tn);
    edgeSides.set(e.id, { fromSide, toSide });

    const fk = `${fn.id}:${fromSide}`;
    if (!buckets.has(fk)) buckets.set(fk, []);
    buckets.get(fk).push({ edgeId: e.id, role: 'from', other: tn, side: fromSide, node: fn });

    const tk = `${tn.id}:${toSide}`;
    if (!buckets.has(tk)) buckets.set(tk, []);
    buckets.get(tk).push({ edgeId: e.id, role: 'to', other: fn, side: toSide, node: tn });
  }

  const ports = new Map(); // edgeId -> { fromPt, fromStub, toPt, toStub }
  for (const e of edges) ports.set(e.id, {});

  for (const items of buckets.values()) {
    const { side, node } = items[0];
    const isHoriz = side === 'left' || side === 'right';
    items.sort((a, b) => {
      const ac = isHoriz ? a.other.y + a.other.h / 2 : a.other.x + a.other.w / 2;
      const bc = isHoriz ? b.other.y + b.other.h / 2 : b.other.x + b.other.w / 2;
      if (ac !== bc) return ac - bc;
      return a.edgeId.localeCompare(b.edgeId);
    });

    const n = items.length;
    const len = isHoriz ? node.h : node.w;
    const margin = Math.min(12, Math.max(4, Math.floor(len * 0.14)));
    const usable = Math.max(4, len - 2 * margin);

    items.forEach((item, idx) => {
      const offset = n === 1 ? len / 2 : margin + (usable * idx) / (n - 1);
      let pt, stub;
      if (side === 'left') {
        pt = [Math.round(node.x), Math.round(node.y + offset)];
        stub = [Math.round(node.x - PORT_STUB), pt[1]];
      } else if (side === 'right') {
        pt = [Math.round(node.x + node.w), Math.round(node.y + offset)];
        stub = [Math.round(node.x + node.w + PORT_STUB), pt[1]];
      } else if (side === 'top') {
        pt = [Math.round(node.x + offset), Math.round(node.y)];
        stub = [pt[0], Math.round(node.y - PORT_STUB)];
      } else {
        pt = [Math.round(node.x + offset), Math.round(node.y + node.h)];
        stub = [pt[0], Math.round(node.y + node.h + PORT_STUB)];
      }
      const entry = ports.get(item.edgeId);
      if (item.role === 'from') {
        entry.fromPt = pt;
        entry.fromStub = stub;
      } else {
        entry.toPt = pt;
        entry.toStub = stub;
      }
    });
  }

  return ports;
}

function simplifyPolyline(pts) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const sameX = Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - c[0]) < 0.5;
    const sameY = Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - c[1]) < 0.5;
    if (!sameX && !sameY) {
      out.push(b);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function buildChannelGrid(nodes, lanes, ports, canvasW, canvasH) {
  const xs = [16, canvasW - 16];
  const ys = [16, canvasH - 16];

  for (const l of lanes) {
    xs.push(l.x - LANE_GAP / 2, l.x + l.w + LANE_GAP / 2);
  }
  for (const n of nodes) {
    xs.push(n.x - PORT_STUB, n.x + n.w + PORT_STUB);
    ys.push(n.y - PORT_STUB, n.y + n.h + PORT_STUB);
    ys.push(n.y + n.h / 2);
  }
  // Midpoints between vertically adjacent nodes in same lane or overall
  const sortedY = [...new Set(nodes.map((n) => n.y))].sort((a, b) => a - b);
  for (let i = 0; i < sortedY.length - 1; i++) {
    ys.push(Math.round((sortedY[i] + sortedY[i + 1]) / 2));
  }

  for (const p of ports.values()) {
    if (p.fromStub) {
      xs.push(p.fromStub[0]);
      ys.push(p.fromStub[1]);
    }
    if (p.toStub) {
      xs.push(p.toStub[0]);
      ys.push(p.toStub[1]);
    }
  }

  return {
    xs: dedupeCoords(xs, 3),
    ys: dedupeCoords(ys, 3)
  };
}

function nearestIndex(arr, val) {
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const d = Math.abs(arr[i] - val);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

function routeEdgeAStar(edge, port, nodes, routedSegments, grid) {
  const { xs, ys } = grid;
  const nx = xs.length;
  const ny = ys.length;

  const sIx = nearestIndex(xs, port.fromStub[0]);
  const sIy = nearestIndex(ys, port.fromStub[1]);
  const tIx = nearestIndex(xs, port.toStub[0]);
  const tIy = nearestIndex(ys, port.toStub[1]);

  const obstacles = nodes.map((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    w: n.w,
    h: n.h
  }));

  function segBlocked(p1, p2) {
    for (const obs of obstacles) {
      if (segmentIntersectsBox(p1, p2, obs, NODE_CLEARANCE)) {
        return true;
      }
    }
    return false;
  }

  function segPenalty(p1, p2) {
    let pen = 0;
    for (const seg of routedSegments) {
      if (segmentsCross(p1, p2, seg[0], seg[1])) {
        pen += 220;
      }
      // Collinear overlap penalty
      const horiz1 = Math.abs(p1[1] - p2[1]) < 1;
      const horiz2 = Math.abs(seg[0][1] - seg[1][1]) < 1;
      if (horiz1 && horiz2 && Math.abs(p1[1] - seg[0][1]) < 2) {
        const min1 = Math.min(p1[0], p2[0]);
        const max1 = Math.max(p1[0], p2[0]);
        const min2 = Math.min(seg[0][0], seg[1][0]);
        const max2 = Math.max(seg[0][0], seg[1][0]);
        if (max1 > min2 + 2 && max2 > min1 + 2) pen += 320;
      } else if (!horiz1 && !horiz2 && Math.abs(p1[0] - seg[0][0]) < 2) {
        const min1 = Math.min(p1[1], p2[1]);
        const max1 = Math.max(p1[1], p2[1]);
        const min2 = Math.min(seg[0][1], seg[1][1]);
        const max2 = Math.max(seg[0][1], seg[1][1]);
        if (max1 > min2 + 2 && max2 > min1 + 2) pen += 320;
      }
    }
    return pen;
  }

  // State key: ((iy * nx + ix) * 3 + dir) where dir: 0=none, 1=H, 2=V
  const totalStates = nx * ny * 3;
  const gScore = new Float64Array(totalStates).fill(Infinity);
  const parent = new Int32Array(totalStates).fill(-1);
  const closed = new Uint8Array(totalStates);

  const startKey = (sIy * nx + sIx) * 3 + 0;
  gScore[startKey] = 0;

  const heap = new MinHeap();
  const h0 = Math.abs(xs[tIx] - xs[sIx]) + Math.abs(ys[tIy] - ys[sIy]);
  heap.push({ key: startKey, f: h0 });

  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 2],
    [0, -1, 2]
  ];

  let goalKey = -1;
  while (heap.size > 0) {
    const cur = heap.pop();
    if (closed[cur.key]) continue;
    closed[cur.key] = 1;

    const dir = cur.key % 3;
    const cell = (cur.key - dir) / 3;
    const ix = cell % nx;
    const iy = (cell - ix) / nx;

    if (ix === tIx && iy === tIy) {
      goalKey = cur.key;
      break;
    }

    const p1 = [xs[ix], ys[iy]];
    for (const [dx, dy, ndir] of dirs) {
      const nix = ix + dx;
      const niy = iy + dy;
      if (nix < 0 || nix >= nx || niy < 0 || niy >= ny) continue;
      const nkey = (niy * nx + nix) * 3 + ndir;
      if (closed[nkey]) continue;

      const p2 = [xs[nix], ys[niy]];
      if (segBlocked(p1, p2)) continue;

      const dist = Math.abs(p2[0] - p1[0]) + Math.abs(p2[1] - p1[1]);
      const bend = dir !== 0 && dir !== ndir ? 45 : 0;
      const pen = segPenalty(p1, p2);
      const ng = gScore[cur.key] + dist + bend + pen;

      if (ng < gScore[nkey]) {
        gScore[nkey] = ng;
        parent[nkey] = cur.key;
        const h = Math.abs(xs[tIx] - p2[0]) + Math.abs(ys[tIy] - p2[1]);
        heap.push({ key: nkey, f: ng + h });
      }
    }
  }

  if (goalKey === -1) {
    // Fallback orthogonal route
    const midX = Math.round((port.fromStub[0] + port.toStub[0]) / 2);
    return simplifyPolyline([
      port.fromPt,
      port.fromStub,
      [midX, port.fromStub[1]],
      [midX, port.toStub[1]],
      port.toStub,
      port.toPt
    ]);
  }

  const pathPts = [];
  let k = goalKey;
  while (k !== -1) {
    const d = k % 3;
    const cell = (k - d) / 3;
    const ix = cell % nx;
    const iy = (cell - ix) / nx;
    pathPts.push([xs[ix], ys[iy]]);
    k = parent[k];
  }
  pathPts.reverse();

  return simplifyPolyline([port.fromPt, port.fromStub, ...pathPts, port.toStub, port.toPt]);
}

function placeEdgeLabels(edges, nodes, routedEdges) {
  const degree = new Map();
  for (const n of nodes) degree.set(n.id, 0);
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) || 0) + 1);
    degree.set(e.to, (degree.get(e.to) || 0) + 1);
  }

  const order = [...routedEdges].sort((a, b) => {
    const da = (degree.get(a.from) || 0) + (degree.get(a.to) || 0);
    const db = (degree.get(b.from) || 0) + (degree.get(b.to) || 0);
    if (db !== da) return db - da;
    return (b.label || '').length - (a.label || '').length;
  });

  const placedLabels = [];
  const allSegments = [];
  for (const re of routedEdges) {
    for (let i = 0; i < re.pts.length - 1; i++) {
      allSegments.push({ edgeId: re.id, p1: re.pts[i], p2: re.pts[i + 1] });
    }
  }

  let maxRight = 0;
  let maxBottom = 0;

  for (const re of order) {
    if (!re.label) continue;
    const w = estimateTextWidth(re.label, 11) + LABEL_PAD_X;
    const h = EDGE_LABEL_H;

    if (Array.isArray(re.labelAt) && re.labelAt.length === 2) {
      const box = {
        x: Math.round(re.labelAt[0] - w / 2),
        y: Math.round(re.labelAt[1] - h / 2),
        w,
        h
      };
      re.labelBox = box;
      placedLabels.push({ edgeId: re.id, box });
      continue;
    }

    // Build segment list sorted by length descending
    const segs = [];
    for (let i = 0; i < re.pts.length - 1; i++) {
      const p1 = re.pts[i];
      const p2 = re.pts[i + 1];
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      if (len >= 12) segs.push({ p1, p2, len });
    }
    segs.sort((a, b) => b.len - a.len);

    const candidates = [];
    const offsets = [0, -16, 16, -32, 32, -48, 48, -64, 64];
    const fracs = [0.5, 0.35, 0.65];

    for (let si = 0; si < segs.length; si++) {
      const seg = segs[si];
      const isHoriz = Math.abs(seg.p1[1] - seg.p2[1]) < Math.abs(seg.p1[0] - seg.p2[0]);
      for (const frac of fracs) {
        const bx = seg.p1[0] + (seg.p2[0] - seg.p1[0]) * frac;
        const by = seg.p1[1] + (seg.p2[1] - seg.p1[1]) * frac;
        for (const off of offsets) {
          const cx = isHoriz ? bx : bx + off;
          const cy = isHoriz ? by + off : by;
          candidates.push({
            box: { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h },
            prefPenalty: si * 15 + Math.abs(frac - 0.5) * 30 + Math.abs(off) * 0.6
          });
        }
      }
    }

    if (candidates.length === 0) {
      const p = re.pts[0];
      candidates.push({
        box: { x: Math.round(p[0] - w / 2), y: Math.round(p[1] - h / 2), w, h },
        prefPenalty: 0
      });
    }

    let best = candidates[0];
    let bestScore = Infinity;

    for (const cand of candidates) {
      let score = cand.prefPenalty;
      const b = cand.box;

      if (b.x < 4 || b.y < 4) score += 1e5;
      for (const node of nodes) {
        if (boxesOverlap(b, node, 4)) score += 1e6;
      }
      for (const pl of placedLabels) {
        if (boxesOverlap(b, pl.box, 4)) score += 1e6;
      }
      for (const seg of allSegments) {
        if (seg.edgeId === re.id) continue;
        if (segmentIntersectsBox(seg.p1, seg.p2, b, 2)) score += 80;
      }

      if (score < bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    re.labelBox = best.box;
    placedLabels.push({ edgeId: re.id, box: best.box });
    maxRight = Math.max(maxRight, best.box.x + best.box.w);
    maxBottom = Math.max(maxBottom, best.box.y + best.box.h);
  }

  return { maxRight, maxBottom };
}

function computeGroupBoxes(spec, nodeMap) {
  if (!Array.isArray(spec.groups) || spec.groups.length === 0) return [];
  const rawGroups = new Map(spec.groups.map((g) => [g.id, g]));
  const computed = new Map();

  function resolveGroup(gId, visiting = new Set()) {
    if (computed.has(gId)) return computed.get(gId);
    if (visiting.has(gId)) return null;
    visiting.add(gId);

    const g = rawGroups.get(gId);
    if (!g) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const nid of g.nodes || []) {
      const n = nodeMap.get(nid);
      if (!n) continue;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
    }

    for (const cgid of g.groups || []) {
      const cg = resolveGroup(cgid, visiting);
      if (!cg) continue;
      minX = Math.min(minX, cg.x);
      minY = Math.min(minY, cg.y);
      maxX = Math.max(maxX, cg.x + cg.w);
      maxY = Math.max(maxY, cg.y + cg.h);
    }

    if (!Number.isFinite(minX)) {
      const box = { id: g.id, label: g.label || g.id, style: g.style, x: 0, y: 0, w: 0, h: 0 };
      computed.set(gId, box);
      return box;
    }

    const padX = 16;
    const padTop = 28;
    const padBot = 14;
    const box = {
      id: g.id,
      label: g.label || g.id,
      style: g.style || null,
      x: Math.round(minX - padX),
      y: Math.round(minY - padTop),
      w: Math.round(maxX - minX + padX * 2),
      h: Math.round(maxY - minY + padTop + padBot)
    };
    computed.set(gId, box);
    return box;
  }

  return spec.groups.map((g) => resolveGroup(g.id)).filter(Boolean);
}

export function layoutFlow(spec) {
  const sizes = computeNodeSizes(spec);
  const hasGroups = Array.isArray(spec.groups) && spec.groups.length > 0;
  const groupTopExtra = hasGroups ? 24 : 0;

  // Compute lane widths from widest node in each lane
  const laneMaxNodeW = new Map();
  for (const l of spec.lanes) {
    const headerW = estimateTextWidth(l.label || l.id, 12) + 24;
    laneMaxNodeW.set(l.id, Math.max(NODE_MIN_W, headerW));
  }
  for (const n of spec.nodes) {
    const s = sizes.get(n.id);
    laneMaxNodeW.set(n.lane, Math.max(laneMaxNodeW.get(n.lane) || NODE_MIN_W, s.w));
  }

  const lanes = [];
  let curX = CANVAS_PAD_X;
  for (const l of spec.lanes) {
    const w = laneMaxNodeW.get(l.id) + LANE_PAD_X * 2;
    lanes.push({
      id: l.id,
      label: l.label || l.id,
      x: curX,
      w
    });
    curX += w + LANE_GAP;
  }
  const laneMap = new Map(lanes.map((l) => [l.id, l]));

  // Place nodes
  const nodes = spec.nodes.map((n) => {
    const lane = laneMap.get(n.lane);
    const { w, h } = sizes.get(n.id);
    const defaultCx = lane.x + lane.w / 2;
    const defaultCy = CANVAS_PAD_Y + LANE_HEADER_H + groupTopExtra + n.row * ROW_PITCH + h / 2;
    const cx = typeof n.x === 'number' ? n.x : defaultCx;
    const cy = typeof n.y === 'number' ? n.y : defaultCy;

    return {
      id: n.id,
      kind: n.kind,
      lane: n.lane,
      row: n.row,
      label: n.label || n.id,
      sub: n.sub || '',
      deep: n.deep || null,
      x: Math.round(cx - w / 2),
      y: Math.round(cy - h / 2),
      w,
      h
    };
  });
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Compute groups
  const groups = computeGroupBoxes(spec, nodeMap);

  // Initial canvas bounds
  let maxX = lanes.length > 0 ? lanes[lanes.length - 1].x + lanes[lanes.length - 1].w + CANVAS_PAD_X : 600;
  let maxY = 260;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + n.w + CANVAS_PAD_X);
    maxY = Math.max(maxY, n.y + n.h + CANVAS_PAD_Y + 24);
  }
  for (const g of groups) {
    maxX = Math.max(maxX, g.x + g.w + CANVAS_PAD_X);
    maxY = Math.max(maxY, g.y + g.h + CANVAS_PAD_Y);
  }

  // Assign ports and build channel grid
  const ports = assignPorts(spec.edges, nodeMap);
  const grid = buildChannelGrid(nodes, lanes, ports, maxX, maxY);

  // Record manual pts as initial obstacles
  const routedSegments = [];
  for (const e of spec.edges) {
    if (Array.isArray(e.pts) && e.pts.length >= 2) {
      for (let i = 0; i < e.pts.length - 1; i++) {
        routedSegments.push([e.pts[i], e.pts[i + 1]]);
      }
    }
  }

  // Route edges
  const routedEdges = spec.edges.map((e) => {
    let pts;
    if (Array.isArray(e.pts) && e.pts.length >= 2) {
      pts = e.pts.map((p) => [Math.round(p[0]), Math.round(p[1])]);
    } else {
      const port = ports.get(e.id);
      pts = routeEdgeAStar(e, port, nodes, routedSegments, grid);
      for (let i = 0; i < pts.length - 1; i++) {
        routedSegments.push([pts[i], pts[i + 1]]);
      }
    }
    for (const p of pts) {
      maxX = Math.max(maxX, p[0] + CANVAS_PAD_X);
      maxY = Math.max(maxY, p[1] + CANVAS_PAD_Y);
    }
    return {
      id: e.id,
      from: e.from,
      to: e.to,
      label: e.label || '',
      labelAt: e.labelAt || null,
      pts,
      labelBox: null
    };
  });

  // Place labels greedily
  const labelBounds = placeEdgeLabels(spec.edges, nodes, routedEdges);
  maxX = Math.max(maxX, labelBounds.maxRight + CANVAS_PAD_X);
  maxY = Math.max(maxY, labelBounds.maxBottom + CANVAS_PAD_Y);

  // Set lane heights to span the canvas
  const laneTop = CANVAS_PAD_Y;
  const laneH = Math.round(maxY - CANVAS_PAD_Y * 2);
  for (const l of lanes) {
    l.y = laneTop;
    l.h = laneH;
  }

  return {
    type: spec.type,
    canvas: {
      width: Math.round(maxX),
      height: Math.round(maxY)
    },
    lanes,
    groups,
    nodes,
    edges: routedEdges
  };
}
