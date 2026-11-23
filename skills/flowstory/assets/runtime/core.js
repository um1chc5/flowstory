/* flowstory runtime — core.js: SVG diagram, pan/zoom, spotlight, auto-legend */
(function (global) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  var KIND_META = {
    client:   { label: 'Client',   color: 'var(--kind-client)',   icon: 'M2 3h12v8H2zM5 13h6M8 11v2' },
    service:  { label: 'Service',  color: 'var(--kind-service)',  icon: 'M3 3h10v4H3zM3 9h10v4H3zM5 5h1M5 11h1' },
    external: { label: 'External', color: 'var(--kind-external)', icon: 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM2 8h12M8 2c2 2 2 10 0 12' },
    queue:    { label: 'Queue',    color: 'var(--kind-queue)',    icon: 'M2 5h12M2 11h12M4 5v6M8 5v6M12 5v6' },
    worker:   { label: 'Worker',   color: 'var(--kind-worker)',   icon: 'M8 2v2M8 12v2M2 8h2M12 8h2M4 4l1.5 1.5M10.5 10.5L12 12M12 4l-1.5 1.5M5.5 10.5L4 12M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z' },
    store:    { label: 'Store',    color: 'var(--kind-store)',    icon: 'M3 4c0-1.1 2.2-2 5-2s5 .9 5 2v8c0 1.1-2.2 2-5 2s-5-.9-5-2V4zM3 8c0 1.1 2.2 2 5 2s5-.9 5-2' },
    cache:    { label: 'Cache',    color: 'var(--kind-cache)',    icon: 'M9 2L4 9h4l-1 5 5-7H8l1-5z' },
    function: { label: 'Function', color: 'var(--kind-function)', icon: 'M5 3l-3 5 3 5M11 3l3 5-3 5M9 2l-2 12' },
    user:     { label: 'User',     color: 'var(--kind-user)',     icon: 'M8 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 14c0-2.5 2.2-4 5-4s5 1.5 5 4' }
  };

  function svgEl(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) {
          el.setAttribute(k, attrs[k]);
        }
      }
    }
    return el;
  }

  function resolveKind(kind, customKinds) {
    if (KIND_META[kind]) return KIND_META[kind];
    var custom = customKinds && customKinds[kind];
    if (custom) {
      var base = KIND_META[custom.like] || KIND_META.service;
      return {
        label: custom.label || kind,
        color: custom.color || base.color,
        icon: (KIND_META[custom.icon] && KIND_META[custom.icon].icon) || base.icon
      };
    }
    return KIND_META.service;
  }

  function init() {
    var specEl = document.getElementById('fs-spec');
    var layoutEl = document.getElementById('fs-layout');
    if (!specEl || !layoutEl) return;

    var spec = JSON.parse(specEl.textContent);
    var layout = JSON.parse(layoutEl.textContent);

    var titleEl = document.getElementById('fs-title');
    if (titleEl) titleEl.textContent = spec.title || spec.id;
    document.title = (spec.title || spec.id) + ' — flowstory';

    var viewport = document.getElementById('fs-viewport');
    var world = document.getElementById('fs-world');
    var svg = document.getElementById('fs-svg');
    var nodesLayer = document.getElementById('fs-nodes');
    var legendEl = document.getElementById('fs-legend');
    var zoomLabel = document.getElementById('fs-zoom-label');

    var state = {
      hoverNode: null,
      pinnedNode: null,
      panX: 0,
      panY: 0,
      scale: 1
    };

    var deepDiveEnabled = !(spec.features && spec.features.deepDive === false);
    var sheet = global.FlowstorySheet.createSheet(spec, function () {
      set({ pinnedNode: null });
    });

    // Build adjacency map for spotlight
    var adj = {};
    for (var i = 0; i < layout.nodes.length; i++) {
      adj[layout.nodes[i].id] = {};
    }
    for (var j = 0; j < layout.edges.length; j++) {
      var ed = layout.edges[j];
      if (adj[ed.from]) adj[ed.from][ed.to] = true;
      if (adj[ed.to]) adj[ed.to][ed.from] = true;
    }

    // Set world and SVG dimensions
    var W = layout.canvas.width;
    var H = layout.canvas.height;
    world.style.width = W + 'px';
    world.style.height = H + 'px';
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);

    // SVG defs (markers)
    var defs = svgEl('defs');
    function makeMarker(id, cls) {
      var m = svgEl('marker', {
        id: id,
        viewBox: '0 0 10 10',
        refX: '9',
        refY: '5',
        markerWidth: '7',
        markerHeight: '7',
        orient: 'auto-start-reverse'
      });
      m.appendChild(svgEl('path', { d: 'M 1 1.5 L 9 5 L 1 8.5 z', 'class': cls }));
      return m;
    }
    defs.appendChild(makeMarker('fs-arrow', 'fs-arrow-head'));
    defs.appendChild(makeMarker('fs-arrow-hi', 'fs-arrow-head is-hi'));
    svg.appendChild(defs);

    // Render lanes
    var lanesG = svgEl('g', { 'class': 'fs-lanes' });
    for (var li = 0; li < layout.lanes.length; li++) {
      var lane = layout.lanes[li];
      var lg = svgEl('g', { 'class': 'fs-lane' });
      lg.appendChild(svgEl('rect', {
        x: lane.x,
        y: lane.y,
        width: lane.w,
        height: lane.h,
        rx: 10,
        'class': 'fs-lane-bg'
      }));
      var lt = svgEl('text', {
        x: lane.x + lane.w / 2,
        y: lane.y + 22,
        'text-anchor': 'middle',
        'class': 'fs-lane-label'
      });
      lt.textContent = lane.label || lane.id;
      lg.appendChild(lt);
      lanesG.appendChild(lg);
    }
    svg.appendChild(lanesG);

    // Render groups
    var groupsG = svgEl('g', { 'class': 'fs-groups' });
    for (var gi = 0; gi < (layout.groups || []).length; gi++) {
      var grp = layout.groups[gi];
      var gg = svgEl('g', { 'class': 'fs-group' + (grp.style ? ' is-' + grp.style : '') });
      gg.appendChild(svgEl('rect', {
        x: grp.x,
        y: grp.y,
        width: grp.w,
        height: grp.h,
        rx: 10,
        'class': 'fs-group-box'
      }));
      var gt = svgEl('text', {
        x: grp.x + 12,
        y: grp.y + 18,
        'class': 'fs-group-label'
      });
      gt.textContent = grp.label || grp.id;
      gg.appendChild(gt);
      groupsG.appendChild(gg);
    }
    svg.appendChild(groupsG);

    // Render edges + labels
    var edgesG = svgEl('g', { 'class': 'fs-edges' });
    var edgeEls = [];
    for (var ei = 0; ei < layout.edges.length; ei++) {
      var edge = layout.edges[ei];
      var eg = svgEl('g', {
        'class': 'fs-edge',
        'data-from': edge.from,
        'data-to': edge.to
      });
      var ptsStr = edge.pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
      var path = svgEl('polyline', {
        points: ptsStr,
        fill: 'none',
        'marker-end': 'url(#fs-arrow)',
        'class': 'fs-edge-line'
      });
      eg.appendChild(path);

      if (edge.label && edge.labelBox) {
        var lb = edge.labelBox;
        eg.appendChild(svgEl('rect', {
          x: lb.x,
          y: lb.y,
          width: lb.w,
          height: lb.h,
          rx: 5,
          'class': 'fs-edge-label-bg'
        }));
        var et = svgEl('text', {
          x: lb.x + lb.w / 2,
          y: lb.y + lb.h / 2 + 4,
          'text-anchor': 'middle',
          'class': 'fs-edge-label-text'
        });
        et.textContent = edge.label;
        eg.appendChild(et);
      }

      edgesG.appendChild(eg);
      edgeEls.push({ edge: edge, el: eg, path: path });
    }
    svg.appendChild(edgesG);

    // Render nodes as accessible <button> elements
    var nodeEls = [];
    var usedKinds = {};
    for (var ni = 0; ni < layout.nodes.length; ni++) {
      var node = layout.nodes[ni];
      usedKinds[node.kind] = true;
      var kMeta = resolveKind(node.kind, spec.kinds);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fs-node';
      btn.style.left = node.x + 'px';
      btn.style.top = node.y + 'px';
      btn.style.width = node.w + 'px';
      btn.style.height = node.h + 'px';
      btn.style.setProperty('--node-accent', kMeta.color);
      btn.setAttribute('data-id', node.id);
      btn.setAttribute('aria-label', node.label + (node.sub ? ', ' + node.sub : '') + ' (' + kMeta.label + ')');

      var iconSvg = svgEl('svg', {
        viewBox: '0 0 16 16',
        width: '16',
        height: '16',
        'aria-hidden': 'true',
        'class': 'fs-node-icon'
      });
      iconSvg.appendChild(svgEl('path', {
        d: kMeta.icon,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '1.5',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }));
      btn.appendChild(iconSvg);

      var textWrap = document.createElement('span');
      textWrap.className = 'fs-node-text';
      var lbl = document.createElement('span');
      lbl.className = 'fs-node-label';
      lbl.textContent = node.label;
      textWrap.appendChild(lbl);
      if (node.sub) {
        var sub = document.createElement('span');
        sub.className = 'fs-node-sub';
        sub.textContent = node.sub;
        textWrap.appendChild(sub);
      }
      btn.appendChild(textWrap);

      (function (n, b) {
        b.addEventListener('mouseenter', function () { set({ hoverNode: n.id }); });
        b.addEventListener('mouseleave', function () { set({ hoverNode: null }); });
        b.addEventListener('focus', function () { set({ hoverNode: n.id }); });
        b.addEventListener('blur', function () { set({ hoverNode: null }); });
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          set({ pinnedNode: n.id });
          if (deepDiveEnabled && n.deep && spec.deep && spec.deep[n.deep]) {
            sheet.open(n.deep, b);
          }
        });
      })(node, btn);

      nodesLayer.appendChild(btn);
      nodeEls.push({ node: node, el: btn });
    }

    // Build auto legend from used kinds
    if (legendEl) {
      for (var kKey in usedKinds) {
        if (!Object.prototype.hasOwnProperty.call(usedKinds, kKey)) continue;
        var km = resolveKind(kKey, spec.kinds);
        var item = document.createElement('span');
        item.className = 'fs-legend-item';
        var dot = svgEl('svg', { viewBox: '0 0 16 16', width: '14', height: '14', 'aria-hidden': 'true' });
        dot.style.color = km.color;
        dot.appendChild(svgEl('path', {
          d: km.icon,
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': '1.6',
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round'
        }));
        item.appendChild(dot);
        var txt = document.createElement('span');
        txt.textContent = km.label;
        item.appendChild(txt);
        legendEl.appendChild(item);
      }
    }

    function applyTransform() {
      world.style.transform =
        'translate(' + state.panX + 'px, ' + state.panY + 'px) scale(' + state.scale + ')';
      if (zoomLabel) {
        zoomLabel.textContent = Math.round(state.scale * 100) + '%';
      }
    }

    function applySpotlight() {
      var activeId = state.pinnedNode || state.hoverNode;
      for (var i = 0; i < nodeEls.length; i++) {
        var ne = nodeEls[i];
        if (!activeId) {
          ne.el.classList.remove('is-dim', 'is-focus');
        } else {
          var isConnected = ne.node.id === activeId || Boolean(adj[activeId] && adj[activeId][ne.node.id]);
          ne.el.classList.toggle('is-dim', !isConnected);
          ne.el.classList.toggle('is-focus', ne.node.id === activeId);
        }
      }
      for (var j = 0; j < edgeEls.length; j++) {
        var ee = edgeEls[j];
        if (!activeId) {
          ee.el.classList.remove('is-dim', 'is-hi');
          ee.path.setAttribute('marker-end', 'url(#fs-arrow)');
        } else {
          var hit = ee.edge.from === activeId || ee.edge.to === activeId;
          ee.el.classList.toggle('is-dim', !hit);
          ee.el.classList.toggle('is-hi', hit);
          ee.path.setAttribute('marker-end', hit ? 'url(#fs-arrow-hi)' : 'url(#fs-arrow)');
        }
      }
    }

    function set(patch) {
      for (var k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) {
          state[k] = patch[k];
        }
      }
      applyTransform();
      applySpotlight();
    }

    function fitToScreen() {
      var rect = viewport.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      var pad = 24;
      var sx = (rect.width - pad * 2) / W;
      var sy = (rect.height - pad * 2) / H;
      var s = Math.max(0.2, Math.min(1.35, Math.min(sx, sy)));
      var px = Math.round((rect.width - W * s) / 2);
      var py = Math.round((rect.height - H * s) / 2);
      set({ scale: s, panX: px, panY: py });
    }

    function zoomAt(factor, cx, cy) {
      var rect = viewport.getBoundingClientRect();
      var vx = cx !== undefined ? cx - rect.left : rect.width / 2;
      var vy = cy !== undefined ? cy - rect.top : rect.height / 2;
      var nextScale = Math.max(0.2, Math.min(3, state.scale * factor));
      var ratio = nextScale / state.scale;
      set({
        scale: nextScale,
        panX: vx - (vx - state.panX) * ratio,
        panY: vy - (vy - state.panY) * ratio
      });
    }

    // Pointer pan & pinch-zoom
    var pointers = {};
    var dragging = false;
    var dragStart = null;
    var lastPinchDist = null;

    viewport.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('.fs-node')) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 1) {
        dragging = true;
        dragStart = { x: e.clientX - state.panX, y: e.clientY - state.panY, moved: false };
      } else if (ids.length === 2) {
        dragging = false;
        var p1 = pointers[ids[0]];
        var p2 = pointers[ids[1]];
        lastPinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      }
    });

    window.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 2 && lastPinchDist) {
        var p1 = pointers[ids[0]];
        var p2 = pointers[ids[1]];
        var dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (dist > 0) {
          zoomAt(dist / lastPinchDist, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
          lastPinchDist = dist;
        }
      } else if (dragging && dragStart) {
        var nx = e.clientX - dragStart.x;
        var ny = e.clientY - dragStart.y;
        if (Math.hypot(nx - state.panX, ny - state.panY) > 3) dragStart.moved = true;
        set({ panX: nx, panY: ny });
      }
    });

    function endPointer(e) {
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) lastPinchDist = null;
      if (dragging && dragStart && !dragStart.moved) {
        set({ pinnedNode: null });
      }
      dragging = false;
      dragStart = null;
    }
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);

    viewport.addEventListener('wheel', function (e) {
      e.preventDefault();
      var factor = e.deltaY < 0 ? 1.1 : 0.9;
      zoomAt(factor, e.clientX, e.clientY);
    }, { passive: false });

    // Toolbar buttons
    var btnIn = document.getElementById('fs-zoom-in');
    var btnOut = document.getElementById('fs-zoom-out');
    var btnReset = document.getElementById('fs-zoom-reset');
    var btnFit = document.getElementById('fs-zoom-fit');
    if (btnIn) btnIn.addEventListener('click', function () { zoomAt(1.2); });
    if (btnOut) btnOut.addEventListener('click', function () { zoomAt(0.83); });
    if (btnReset) btnReset.addEventListener('click', function () {
      var rect = viewport.getBoundingClientRect();
      set({
        scale: 1,
        panX: Math.round((rect.width - W) / 2),
        panY: Math.round((rect.height - H) / 2)
      });
    });
    if (btnFit) btnFit.addEventListener('click', fitToScreen);

    // Keyboard navigation
    window.addEventListener('keydown', function (e) {
      if (sheet.isOpen()) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(1.15); }
      else if (e.key === '-') { e.preventDefault(); zoomAt(0.87); }
      else if (e.key === '0') { e.preventDefault(); fitToScreen(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); set({ panX: state.panX + 40 }); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); set({ panX: state.panX - 40 }); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); set({ panY: state.panY + 40 }); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); set({ panY: state.panY - 40 }); }
      else if (e.key === 'Escape') { set({ pinnedNode: null }); }
    });

    window.addEventListener('resize', fitToScreen);
    fitToScreen();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
