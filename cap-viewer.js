/* ARDUA 3D cap viewer. Plain WebGL, no libraries, no network requests beyond two local files. */
import { buildCap } from './cap-model.js';

var stage = document.getElementById('stage');
var canvas = document.getElementById('capCanvas');
var fallback = document.getElementById('capFallback');
var ui = document.getElementById('stageUi');

function showFallback() {
  if (canvas) canvas.hidden = true;
  if (ui) ui.hidden = true;
  if (fallback) fallback.hidden = false;
}

var VS = [
  'attribute vec3 aPos; attribute vec3 aNrm; attribute vec2 aUv; attribute vec3 aTan;',
  'uniform mat4 uMVP; uniform mat4 uModel;',
  'varying vec3 vP; varying vec3 vN; varying vec2 vUv; varying vec3 vT;',
  'void main(){',
  '  vP = (uModel * vec4(aPos,1.0)).xyz;',
  '  vN = mat3(uModel[0].xyz, uModel[1].xyz, uModel[2].xyz) * aNrm;',
  '  vT = mat3(uModel[0].xyz, uModel[1].xyz, uModel[2].xyz) * aTan;',
  '  vUv = aUv;',
  '  gl_Position = uMVP * vec4(aPos,1.0);',
  '}'
].join('\n');

var FS = [
  '#ifdef GL_FRAGMENT_PRECISION_HIGH',
  'precision highp float;',
  '#else',
  'precision mediump float;',
  '#endif',
  'varying vec3 vP; varying vec3 vN; varying vec2 vUv; varying vec3 vT;',
  'uniform vec3 uCam; uniform vec3 uColor; uniform float uRough; uniform float uSheen; uniform vec3 uTwill; uniform float uLogo; uniform sampler2D uTex;',
  'vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }',
  'void main(){',
  '  vec3 n = normalize(vN);',
  '  vec3 v = normalize(uCam - vP);',
  '  if (dot(n, v) < 0.0) n = -n;',
  '  vec3 base = lin(uColor);',
  '  if (uLogo > 0.5) {',
  '    vec4 t = texture2D(uTex, vUv);',
  '    if (t.a < 0.4) discard;',
  '    float d = 3.0 / 512.0;',
  '    float ax = texture2D(uTex, vUv + vec2(d, 0.0)).a - texture2D(uTex, vUv - vec2(d, 0.0)).a;',
  '    float ay = texture2D(uTex, vUv + vec2(0.0, d)).a - texture2D(uTex, vUv - vec2(0.0, d)).a;',
  '    vec3 tn = normalize(vT); vec3 bn = normalize(cross(n, tn));',
  '    n = normalize(n - (ax * tn + ay * bn) * 1.6);',
  '    float edge = smoothstep(0.4, 0.85, t.a);',
  '    base = lin(t.rgb) * (0.55 + 0.45 * edge) * 0.95;',
  '  } else if (uTwill.x > 0.0) {',
  '    float k0 = max(dot(n, v), 0.0);',
  '    float pat = sin((vUv.x * uTwill.y + vUv.y * uTwill.z) * 6.2831853);',
  '    base *= 1.0 + uTwill.x * pat * k0 * k0;',
  '  }',
  '  vec3 L1 = normalize(vec3(-0.55, 0.85, 0.7));  vec3 c1 = vec3(1.0, 0.97, 0.92) * 1.35;',
  '  vec3 L2 = normalize(vec3(0.8, 0.25, 0.55));   vec3 c2 = vec3(0.55, 0.62, 0.8) * 0.55;',
  '  vec3 L3 = normalize(vec3(0.2, 0.55, -0.85));  vec3 c3 = vec3(0.7, 0.8, 1.0) * 1.15;',
  '  float w = 0.12;',
  '  float d1 = max((dot(n, L1) + w) / (1.0 + w), 0.0);',
  '  float d2 = max((dot(n, L2) + w) / (1.0 + w), 0.0);',
  '  float d3 = max((dot(n, L3) + w) / (1.0 + w), 0.0);',
  '  float hemi = n.y * 0.5 + 0.5;',
  '  vec3 amb = mix(vec3(0.015, 0.015, 0.02), vec3(0.09, 0.095, 0.11), hemi);',
  '  vec3 col = base * (c1 * d1 + c2 * d2 + c3 * d3 + amb * 1.0);',
  '  float ndv = max(dot(n, v), 0.0);',
  '  float sh = 6.0 + 64.0 * (1.0 - uRough);',
  '  float spw = 1.0 - uRough;',
  '  col += c1 * pow(max(dot(n, normalize(L1 + v)), 0.0), sh) * spw * 0.6;',
  '  col += c3 * pow(max(dot(n, normalize(L3 + v)), 0.0), sh) * spw * 0.8;',
  '  float fres = pow(1.0 - ndv, 3.0);',
  '  col += vec3(0.30, 0.31, 0.36) * fres * uSheen * 0.40 * (0.4 + 0.6 * hemi);',
  '  vec3 r = 2.0 * ndv * n - v;',
  '  float ry = smoothstep(-0.1, 0.9, r.y);',
  '  vec3 env = mix(vec3(0.01), vec3(0.28, 0.30, 0.36), ry);',
  '  float soft = pow(max(dot(r, L1), 0.0), 14.0) * 0.6;',
  '  float F = 0.03 + 0.97 * pow(1.0 - ndv, 5.0);',
  '  col += (env + vec3(soft)) * F * (1.0 - uRough) * 0.8;',
  '  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);',
  '  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));',
  '  gl_FragColor = vec4(col, 1.0);',
  '}'
].join('\n');

/* ---------- tiny matrix helpers (column-major) ---------- */
function perspective(fovy, aspect, n, f) {
  var t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
  m[0] = t / aspect; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f);
  return m;
}
function lookAt(e, c, u) {
  var z = norm3([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = norm3(cross3(u, z)), y = cross3(z, x), m = new Float32Array(16);
  m[0] = x[0]; m[4] = x[1]; m[8] = x[2];  m[12] = -dot3(x, e);
  m[1] = y[0]; m[5] = y[1]; m[9] = y[2];  m[13] = -dot3(y, e);
  m[2] = z[0]; m[6] = z[1]; m[10] = z[2]; m[14] = -dot3(z, e);
  m[15] = 1; return m;
}
function mul4(a, b) {
  var o = new Float32Array(16), i, j, k, s;
  for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) { s = 0; for (k = 0; k < 4; k++) s += a[k * 4 + i] * b[j * 4 + k]; o[j * 4 + i] = s; }
  return o;
}
function rotY(a) { var c = Math.cos(a), s = Math.sin(a), m = new Float32Array(16); m[0] = c; m[2] = -s; m[5] = 1; m[8] = s; m[10] = c; m[15] = 1; return m; }
function trans(x, y, z) { var m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; m[12] = x; m[13] = y; m[14] = z; return m; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function norm3(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

function init() {
  if (!stage || !canvas) return;
  var gl = null;
  try { gl = canvas.getContext('webgl', { antialias: true, alpha: true, powerPreference: 'low-power' }) || canvas.getContext('experimental-webgl'); } catch (e) { gl = null; }
  if (!gl) { showFallback(); return; }

  function compile(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog, cap, parts = [], tex = null, texReady = false;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(prog, 0, 'aPos'); gl.bindAttribLocation(prog, 1, 'aNrm'); gl.bindAttribLocation(prog, 2, 'aUv'); gl.bindAttribLocation(prog, 3, 'aTan');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    cap = buildCap();
  } catch (err) { showFallback(); return; }
  gl.useProgram(prog);

  function buf(target, data) { var b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; }
  cap.parts.forEach(function (p) {
    var m = p.mesh;
    parts.push({
      mat: p.mat, n: m.idx.length,
      pos: buf(gl.ARRAY_BUFFER, new Float32Array(m.pos)), nrm: buf(gl.ARRAY_BUFFER, new Float32Array(m.nrm)),
      uv: buf(gl.ARRAY_BUFFER, new Float32Array(m.uv)), tan: buf(gl.ARRAY_BUFFER, new Float32Array(m.tan)),
      idx: buf(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(m.idx))
    });
  });
  var U = {}; ['uMVP', 'uModel', 'uCam', 'uColor', 'uRough', 'uSheen', 'uTwill', 'uLogo', 'uTex'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  var img = new Image();
  img.onload = function () {
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    texReady = true; requestDraw();
  };
  img.src = 'mark-3d.png';

  /* ---------- state ---------- */
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var yaw = 0.5, pitch = 20 * Math.PI / 180, vel = 0, auto = !reduced, dragging = false, lastX = 0, lastY = 0, lastMove = 0, idleUntil = 0;
  var visible = true, raf = 0, last = 0, W = 0, H = 0;
  var AUTO_SPEED = 0.38; /* radians per second, about 16 seconds per turn */

  ui.hidden = false;
  var playBtn = document.getElementById('rotPlay');
  function syncPlay() { playBtn.textContent = auto ? 'Pause' : 'Play'; playBtn.setAttribute('aria-pressed', String(!auto)); }
  syncPlay();

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; }
    W = w; H = h;
  }

  function draw() {
    resize();
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    var aspect = W / H, dist = 7.8 / Math.pow(Math.min(aspect, 1), 0.85);
    var eye = [0, dist * Math.sin(pitch), dist * Math.cos(pitch)];
    var view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
    var proj = perspective(26 * Math.PI / 180, aspect, 1, 30);
    var model = mul4(rotY(yaw), trans(-cap.pivot[0], -cap.pivot[1], -cap.pivot[2]));
    var mvp = mul4(proj, mul4(view, model));
    gl.uniformMatrix4fv(U.uMVP, false, mvp); gl.uniformMatrix4fv(U.uModel, false, model);
    gl.uniform3fv(U.uCam, new Float32Array(eye));
    gl.activeTexture(gl.TEXTURE0); if (tex) gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U.uTex, 0);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], m = p.mat;
      if (m.logo && !texReady) continue;
      gl.uniform3f(U.uColor, m.color[0], m.color[1], m.color[2]);
      gl.uniform1f(U.uRough, m.rough); gl.uniform1f(U.uSheen, m.sheen);
      gl.uniform3f(U.uTwill, m.twill[0], m.twill[1], m.twill[2]); gl.uniform1f(U.uLogo, m.logo ? 1 : 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.pos); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.nrm); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.uv);  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.tan); gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, p.idx);
      gl.drawElements(gl.TRIANGLES, p.n, gl.UNSIGNED_SHORT, 0);
    }
  }

  function needsLoop() { return visible && !document.hidden && (auto || dragging || Math.abs(vel) > 0.002 || performance.now() < idleUntil); }
  function tick(now) {
    raf = 0;
    var dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!dragging) {
      if (Math.abs(vel) > 0.002) { yaw += vel * dt; vel *= Math.pow(0.04, dt); } else vel = 0;
      if (auto && now > idleUntil) yaw += AUTO_SPEED * dt;
    }
    draw();
    if (needsLoop()) raf = requestAnimationFrame(tick);
  }
  function requestDraw() { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } }

  /* ---------- input ---------- */
  canvas.addEventListener('pointerdown', function (e) {
    dragging = true; lastX = e.clientX; lastY = e.clientY; vel = 0; lastMove = performance.now();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    requestDraw();
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY, now = performance.now(), dt = Math.max((now - lastMove) / 1000, 0.008);
    lastX = e.clientX; lastY = e.clientY; lastMove = now;
    var dyaw = dx * 0.011; yaw += dyaw; vel = 0.6 * vel + 0.4 * (dyaw / dt);
    pitch = Math.min(0.78, Math.max(0.1, pitch + dy * 0.006));
  });
  function endDrag() { if (!dragging) return; dragging = false; idleUntil = performance.now() + 2200; vel = Math.max(-6, Math.min(6, vel)); requestDraw(); }
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

  function nudge(dir) { yaw += dir * (Math.PI / 6); idleUntil = performance.now() + 2200; requestDraw(); }
  document.getElementById('rotL').addEventListener('click', function () { nudge(-1); });
  document.getElementById('rotR').addEventListener('click', function () { nudge(1); });
  playBtn.addEventListener('click', function () { auto = !auto; syncPlay(); requestDraw(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) requestDraw(); }, { threshold: 0.05 }).observe(stage);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) requestDraw(); });
  if ('ResizeObserver' in window) new ResizeObserver(function () { requestDraw(); draw(); }).observe(stage); else window.addEventListener('resize', requestDraw);
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); showFallback(); });

  draw(); requestDraw();
}

try { init(); } catch (e) { showFallback(); }
