/* ARDUA cap model.
   Procedural geometry for a six-panel cap with a curved, stitched visor,
   panel seams, eyelets, a back strap and the embroidered ARDUA mark.
   Pure functions, no dependencies. Y is up, +Z is the front of the cap. */

var RX = 1.0, RZ = 1.12, HY = 0.98;           /* crown half-width, half-depth, height */
var AMAX = 0.98, L0 = 0.86, DROOP = 0.17, SIDE = 0.08, THICK = 0.03; /* visor */

/* ---------- small vector helpers ---------- */
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

/* ---------- mesh helpers ---------- */
function newMesh() { return { pos: [], nrm: [], uv: [], tan: [], idx: [] }; }
function pushVertex(m, p, n, uv, t) {
  m.pos.push(p[0], p[1], p[2]);
  m.nrm.push(n[0], n[1], n[2]);
  m.uv.push(uv[0], uv[1]);
  m.tan.push(t[0], t[1], t[2]);
}
function computeNormals(m) {
  var n = m.pos.length / 3, acc = new Array(n * 3).fill(0), i, a, b, c, pa, pb, pc, fn;
  for (i = 0; i < m.idx.length; i += 3) {
    a = m.idx[i]; b = m.idx[i + 1]; c = m.idx[i + 2];
    pa = [m.pos[a * 3], m.pos[a * 3 + 1], m.pos[a * 3 + 2]];
    pb = [m.pos[b * 3], m.pos[b * 3 + 1], m.pos[b * 3 + 2]];
    pc = [m.pos[c * 3], m.pos[c * 3 + 1], m.pos[c * 3 + 2]];
    fn = cross(sub(pb, pa), sub(pc, pa));
    [a, b, c].forEach(function (k) { acc[k * 3] += fn[0]; acc[k * 3 + 1] += fn[1]; acc[k * 3 + 2] += fn[2]; });
  }
  for (i = 0; i < n; i++) {
    var v = norm([acc[i * 3], acc[i * 3 + 1], acc[i * 3 + 2]]);
    m.nrm[i * 3] = v[0]; m.nrm[i * 3 + 1] = v[1]; m.nrm[i * 3 + 2] = v[2];
  }
}
/* Grid of (nu+1) x (nv+1) vertices. fn(s, t) -> {p, n?, uv?, t?} with s,t in 0..1 */
function gridMesh(nu, nv, fn, wantNormals) {
  var m = newMesh(), i, j, r;
  for (j = 0; j <= nv; j++) {
    for (i = 0; i <= nu; i++) {
      r = fn(i / nu, j / nv);
      pushVertex(m, r.p, r.n || [0, 1, 0], r.uv || [i / nu, j / nv], r.t || [1, 0, 0]);
    }
  }
  for (j = 0; j < nv; j++) {
    for (i = 0; i < nu; i++) {
      var a = j * (nu + 1) + i, b = a + 1, c = a + (nu + 1), d = c + 1;
      m.idx.push(a, c, b, b, c, d);
    }
  }
  if (wantNormals) computeNormals(m);
  return m;
}
function merge(list) {
  var out = newMesh();
  list.forEach(function (m) {
    var off = out.pos.length / 3;
    Array.prototype.push.apply(out.pos, m.pos);
    Array.prototype.push.apply(out.nrm, m.nrm);
    Array.prototype.push.apply(out.uv, m.uv);
    Array.prototype.push.apply(out.tan, m.tan);
    m.idx.forEach(function (k) { out.idx.push(k + off); });
  });
  return out;
}
/* Round tube along a polyline. For a closed loop, repeat the first point at the end. */
function tube(path, radius, radial, closed) {
  var m = newMesh(), n = path.length, T = [], i, k;
  for (i = 0; i < n; i++) {
    var prev, next;
    if (closed && i === 0) prev = path[n - 2]; else prev = path[Math.max(i - 1, 0)];
    if (closed && i === n - 1) next = path[1]; else next = path[Math.min(i + 1, n - 1)];
    T.push(norm(sub(next, prev)));
  }
  var ref = Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  var N = norm(cross(T[0], ref)), B;
  for (i = 0; i < n; i++) {
    if (i > 0) N = norm(sub(N, mul(T[i], dot(N, T[i]))));
    B = cross(T[i], N);
    for (k = 0; k <= radial; k++) {
      var ang = 2 * Math.PI * k / radial, dir = add(mul(N, Math.cos(ang)), mul(B, Math.sin(ang)));
      pushVertex(m, add(path[i], mul(dir, radius)), dir, [i / (n - 1), k / radial], T[i]);
    }
  }
  for (i = 0; i < n - 1; i++) {
    for (k = 0; k < radial; k++) {
      var a = i * (radial + 1) + k, b = a + 1, c = a + (radial + 1), d = c + 1;
      m.idx.push(a, c, b, b, c, d);
    }
  }
  return m;
}
/* Strip joining two equal-length point lists (used for the visor edge). */
function strip(top, bottom) {
  var m = newMesh(), n = top.length, i;
  for (i = 0; i < n; i++) {
    pushVertex(m, top[i], [0, 1, 0], [i / (n - 1), 0], [1, 0, 0]);
    pushVertex(m, bottom[i], [0, 1, 0], [i / (n - 1), 1], [1, 0, 0]);
  }
  for (i = 0; i < n - 1; i++) { var a = i * 2; m.idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  computeNormals(m);
  return m;
}

/* ---------- crown ---------- */
function crownRaw(theta, alpha) {
  var st = Math.sin(theta), ct = Math.max(Math.cos(theta), 0), r = Math.pow(st, 0.62);
  return [RX * r * Math.sin(alpha), HY * Math.pow(ct, 0.82), RZ * r * Math.cos(alpha)];
}
function crownPoint(theta, alpha) {
  var e = 0.002, th = Math.min(Math.max(theta, 0.004), Math.PI / 2 - 0.004);
  var p = crownRaw(theta, alpha);
  var dT = sub(crownRaw(th + e, alpha), crownRaw(th - e, alpha));
  var dA = sub(crownRaw(th, alpha + e), crownRaw(th, alpha - e));
  var n = norm(cross(dA, dT));
  if (dot(n, [p[0], p[1] - 0.3, p[2]]) < 0) n = mul(n, -1);
  return { p: p, n: n, t: norm(dA) };
}
function crownMesh() {
  return gridMesh(128, 48, function (s, t) {
    var c = crownPoint(t * Math.PI / 2, s * 2 * Math.PI);
    return { p: c.p, n: c.n, uv: [s, t], t: c.t };
  });
}
function crownCurve(alpha, offset, steps) {
  var pts = [], i, c;
  for (i = 0; i <= steps; i++) {
    c = crownPoint((i / steps) * Math.PI / 2 * 0.999, alpha);
    pts.push(add(c.p, mul(c.n, offset)));
  }
  return pts;
}

/* ---------- visor ---------- */
function brimPoint(u, v) {
  var a = u * AMAX, sa = Math.sin(a), ca = Math.cos(a);
  var bx = RX * sa * 0.985, bz = RZ * ca * 0.985;
  var d = norm([0.30 * sa / RX, 0, ca / RZ]);
  var len = L0 * (0.34 + 0.66 * Math.pow(Math.max(1 - u * u, 0), 0.55));
  return [bx + d[0] * len * v, 0.02 - DROOP * Math.pow(v, 1.35) - SIDE * u * u * Math.pow(v, 1.2), bz + d[2] * len * v];
}
function brimMeshes() {
  var nu = 72, nv = 28, i;
  var top = gridMesh(nu, nv, function (s, t) {
    return { p: brimPoint(s * 2 - 1, t), uv: [s, t] };
  }, true);
  var bottom = gridMesh(nu, nv, function (s, t) {
    var p = brimPoint(s * 2 - 1, t); p[1] -= THICK; return { p: p, uv: [s, t] };
  }, true);
  var edgeTop = [], edgeBot = [], left = [], leftB = [], right = [], rightB = [], p;
  for (i = 0; i <= nu; i++) { p = brimPoint(i / nu * 2 - 1, 1); edgeTop.push(p); edgeBot.push([p[0], p[1] - THICK, p[2]]); }
  for (i = 0; i <= nv; i++) {
    p = brimPoint(-1, i / nv); left.push(p); leftB.push([p[0], p[1] - THICK, p[2]]);
    p = brimPoint(1, i / nv); right.push(p); rightB.push([p[0], p[1] - THICK, p[2]]);
  }
  var edges = merge([strip(edgeTop, edgeBot), strip(left, leftB), strip(right, rightB)]);
  return { top: top, bottom: bottom, edges: edges };
}
function stitchRows() {
  var rows = [], k, i, pts, v;
  for (k = 0; k < 6; k++) {
    v = 0.965 - k * 0.05; pts = [];
    for (i = 0; i <= 64; i++) {
      var p = brimPoint((i / 64 * 2 - 1) * 0.94, v);
      pts.push([p[0], p[1] + 0.0035, p[2]]);
    }
    rows.push(tube(pts, 0.0042, 6, false));
  }
  return merge(rows);
}

/* ---------- details ---------- */
function seams() {
  var list = [], k;
  for (k = 0; k < 6; k++) list.push(tube(crownCurve(k * Math.PI / 3, 0.005, 90), 0.0085, 8, false));
  return merge(list);
}
function piping() {
  var pts = [], i;
  for (i = 0; i <= 160; i++) { var a = i / 160 * 2 * Math.PI; pts.push([RX * Math.sin(a) * 1.004, 0.006, RZ * Math.cos(a) * 1.004]); }
  return tube(pts, 0.022, 8, true);
}
function button() {
  return gridMesh(24, 16, function (s, t) {
    var a = s * 2 * Math.PI, th = t * Math.PI, st = Math.sin(th), ct = Math.cos(th);
    return { p: [0.075 * st * Math.sin(a), HY + 0.012 + 0.05 * ct, 0.075 * st * Math.cos(a)], n: norm([st * Math.sin(a) / 0.075, ct / 0.05, st * Math.cos(a) / 0.075]), uv: [s, t] };
  });
}
function eyelets() {
  var rings = [], discs = [], k, i, theta = 0.46;
  for (k = 0; k < 6; k++) {
    var alpha = Math.PI / 6 + k * Math.PI / 3;
    var c = crownPoint(theta, alpha), n = c.n, p = add(c.p, mul(n, 0.003));
    var t1 = norm(cross(n, [0, 1, 0])), t2 = cross(n, t1), pts = [];
    for (i = 0; i <= 28; i++) {
      var b = i / 28 * 2 * Math.PI;
      pts.push(add(add(p, mul(add(mul(t1, Math.cos(b)), mul(t2, Math.sin(b))), 0.034)), mul(n, 0.004)));
    }
    rings.push(tube(pts, 0.011, 6, true));
    var d = newMesh();
    pushVertex(d, add(p, mul(n, 0.002)), n, [0.5, 0.5], t1);
    for (i = 0; i <= 18; i++) {
      var q = i / 18 * 2 * Math.PI;
      pushVertex(d, add(add(p, mul(add(mul(t1, Math.cos(q)), mul(t2, Math.sin(q))), 0.03)), mul(n, 0.002)), n, [0.5, 0.5], t1);
      if (i > 0) d.idx.push(0, i, i + 1);
    }
    discs.push(d);
  }
  return { rings: merge(rings), discs: merge(discs) };
}
function strap() {
  return gridMesh(40, 6, function (s, t) {
    var c = crownPoint(1.20 + t * 0.30, Math.PI - 1.0 + s * 2.0);
    return { p: add(c.p, mul(c.n, 0.012)), n: c.n, uv: [s, t], t: c.t };
  });
}
/* Embroidered mark, wrapped onto the front of the crown.
   opts: aspect (width/height of the mark), height (world units), u0,u1,v0,v1 (texture sub-rectangle) */
function logoMesh(o) {
  var theta = 1.0, H = o.height, W = H * o.aspect;
  var dTheta = H / 1.03, dAlpha = W / (RX * Math.sin(theta));
  var top = theta - dTheta / 2;
  return gridMesh(48, 48, function (s, t) {
    var c = crownPoint(top + t * dTheta, (s - 0.5) * dAlpha);
    return { p: add(c.p, mul(c.n, 0.016)), n: c.n, uv: [o.u0 + s * (o.u1 - o.u0), o.v1 - t * (o.v1 - o.v0)], t: c.t };
  });
}

/* ---------- assembly ---------- */
var FABRIC = [0.13, 0.13, 0.145];
function buildCap(o) {
  o = o || {};
  var logoOpts = {
    aspect: o.logoAspect || 1.2225, height: o.logoHeight || 0.42,
    u0: o.u0 === undefined ? 0.0117 : o.u0, u1: o.u1 === undefined ? 0.9883 : o.u1,
    v0: o.v0 === undefined ? 0.1016 : o.v0, v1: o.v1 === undefined ? 0.9004 : o.v1
  };
  var br = brimMeshes(), ey = eyelets();
  var parts = [
    { name: 'crown', mesh: crownMesh(), mat: { color: FABRIC, rough: 0.94, sheen: 0.9, twill: [0.09, 300, 100] } },
    { name: 'seams', mesh: seams(), mat: { color: [0.14, 0.14, 0.155], rough: 0.85, sheen: 0.8, twill: [0, 0, 0] } },
    { name: 'piping', mesh: piping(), mat: { color: [0.09, 0.09, 0.1], rough: 0.8, sheen: 0.5, twill: [0, 0, 0] } },
    { name: 'button', mesh: button(), mat: { color: FABRIC, rough: 0.9, sheen: 0.8, twill: [0, 0, 0] } },
    { name: 'eyeletRings', mesh: ey.rings, mat: { color: [0.12, 0.12, 0.13], rough: 0.7, sheen: 0.4, twill: [0, 0, 0] } },
    { name: 'eyeletHoles', mesh: ey.discs, mat: { color: [0.01, 0.01, 0.012], rough: 1, sheen: 0, twill: [0, 0, 0] } },
    { name: 'visorTop', mesh: br.top, mat: { color: [0.055, 0.055, 0.06], rough: 0.92, sheen: 0.22, twill: [0.08, 110, 100] } },
    { name: 'visorEdge', mesh: br.edges, mat: { color: [0.13, 0.13, 0.145], rough: 0.85, sheen: 0.6, twill: [0, 0, 0] } },
    { name: 'visorUnder', mesh: br.bottom, mat: { color: [0.05, 0.05, 0.055], rough: 0.95, sheen: 0.3, twill: [0, 0, 0] } },
    { name: 'stitches', mesh: stitchRows(), mat: { color: [0.30, 0.30, 0.33], rough: 0.7, sheen: 0.3, twill: [0, 0, 0] } },
    { name: 'logo', mesh: logoMesh(logoOpts), mat: { color: [1, 1, 1], rough: 0.55, sheen: 0.25, twill: [0, 0, 0], logo: true } }
  ];
  return { parts: parts, groundY: -0.54, pivot: [0, 0.22, 0.42] };
}

export { buildCap, RX, RZ, HY };
