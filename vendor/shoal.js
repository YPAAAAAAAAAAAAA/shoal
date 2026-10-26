/* shoal — original planted-tank school. Clean-room, no third-party code. */
(function () {
  "use strict";

  var canvas = document.getElementById("tank");
  var stage = document.getElementById("stage");
  var fold = document.getElementById("fold");
  var about = document.getElementById("about");
  var readySent = false;
  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (err) {
    reduceMotion = false;
  }

  function signalReady() {
    if (readySent) return;
    var gb = window.__gbSandbox;
    if (gb && typeof gb.ready === "function") {
      readySent = true;
      gb.ready();
    }
  }

  function showFallback() {
    document.body.classList.add("no-gl");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        signalReady();
      });
    });
  }

  function stopUI(e) {
    e.stopPropagation();
  }

  fold.addEventListener("pointerdown", stopUI);
  fold.addEventListener("pointermove", stopUI);
  fold.addEventListener("pointerup", stopUI);
  about.addEventListener("pointerdown", stopUI);
  about.addEventListener("pointermove", stopUI);
  about.addEventListener("pointerup", stopUI);
  fold.addEventListener("click", function (e) {
    e.stopPropagation();
    var open = about.hasAttribute("hidden");
    if (open) about.removeAttribute("hidden");
    else about.setAttribute("hidden", "");
    fold.setAttribute("aria-expanded", open ? "true" : "false");
  });

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function Geo() {
    this.pos = [];
    this.part = [];
    this.idx = [];
    this.pn = [];
    this.hasN = [];
  }
  Geo.prototype.v = function (x, y, z, part, nx, ny, nz) {
    var i = this.pos.length / 3;
    this.pos.push(x, y, z);
    this.part.push(part);
    if (nx == null) {
      this.pn.push(0, 0, 0);
      this.hasN.push(0);
    } else {
      var len = Math.hypot(nx, ny, nz) || 1;
      this.pn.push(nx / len, ny / len, nz / len);
      this.hasN.push(1);
    }
    return i;
  };
  Geo.prototype.tri = function (a, b, c) {
    this.idx.push(a, b, c);
  };
  Geo.prototype.pack = function () {
    var p = this.pos;
    var idx = this.idx;
    var nrm = new Float32Array(p.length);
    var i, ia, ib, ic, ax, ay, az, bx, by, bz, cx, cy, cz, ux, uy, uz, vx, vy, vz, nx, ny, nz;
    for (i = 0; i < idx.length; i += 3) {
      ia = idx[i] * 3;
      ib = idx[i + 1] * 3;
      ic = idx[i + 2] * 3;
      ax = p[ia]; ay = p[ia + 1]; az = p[ia + 2];
      bx = p[ib]; by = p[ib + 1]; bz = p[ib + 2];
      cx = p[ic]; cy = p[ic + 1]; cz = p[ic + 2];
      ux = bx - ax; uy = by - ay; uz = bz - az;
      vx = cx - ax; vy = cy - ay; vz = cz - az;
      nx = uy * vz - uz * vy;
      ny = uz * vx - ux * vz;
      nz = ux * vy - uy * vx;
      nrm[ia] += nx; nrm[ia + 1] += ny; nrm[ia + 2] += nz;
      nrm[ib] += nx; nrm[ib + 1] += ny; nrm[ib + 2] += nz;
      nrm[ic] += nx; nrm[ic + 1] += ny; nrm[ic + 2] += nz;
    }
    var count = p.length / 3;
    var inter = new Float32Array(count * 7);
    for (i = 0; i < count; i++) {
      if (this.hasN[i]) {
        nx = this.pn[i * 3]; ny = this.pn[i * 3 + 1]; nz = this.pn[i * 3 + 2];
      } else {
        nx = nrm[i * 3]; ny = nrm[i * 3 + 1]; nz = nrm[i * 3 + 2];
        var len = Math.hypot(nx, ny, nz) || 1;
        nx /= len; ny /= len; nz /= len;
      }
      var o = i * 7;
      inter[o] = p[i * 3];
      inter[o + 1] = p[i * 3 + 1];
      inter[o + 2] = p[i * 3 + 2];
      inter[o + 3] = nx;
      inter[o + 4] = ny;
      inter[o + 5] = nz;
      inter[o + 6] = this.part[i];
    }
    return { inter: inter, indices: new Uint16Array(idx) };
  };

  function addOcta(g, cx, cy, cz, r, part) {
    var b = g.pos.length / 3;
    g.v(cx + r, cy, cz, part);
    g.v(cx - r, cy, cz, part);
    g.v(cx, cy + r, cz, part);
    g.v(cx, cy - r, cz, part);
    g.v(cx, cy, cz + r, part);
    g.v(cx, cy, cz - r, part);
    var faces = [
      [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2],
      [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]
    ];
    for (var i = 0; i < faces.length; i++) {
      g.tri(b + faces[i][0], b + faces[i][1], b + faces[i][2]);
    }
  }

  function buildFish() {
    var g = new Geo();
    var rings = 8;
    var around = 8;
    var ringIds = [];
    var i, k, t, s, x, ry, rz, drop, a, y, z, ring;
    for (i = 0; i < rings; i++) {
      t = 0.14 + (i / (rings - 1)) * 0.86;
      s = Math.sin(Math.PI * Math.pow(t, 0.72));
      x = -0.42 + ((t - 0.14) / 0.86) * 1.02;
      ry = 0.025 + 0.30 * Math.pow(Math.max(s, 0), 0.85);
      rz = 0.02 + 0.13 * Math.pow(Math.max(s, 0), 1.0);
      drop = -0.035 * s;
      ring = [];
      for (k = 0; k < around; k++) {
        a = (k / around) * Math.PI * 2;
        y = Math.cos(a) * ry + drop;
        z = Math.sin(a) * rz;
        ring.push(g.v(x, y, z, 0, 0.22, Math.cos(a), Math.sin(a) * (ry / Math.max(rz, 0.02))));
      }
      ringIds.push(ring);
    }
    for (i = 0; i < rings - 1; i++) {
      for (k = 0; k < around; k++) {
        var k2 = (k + 1) % around;
        var a0 = ringIds[i][k];
        var b0 = ringIds[i][k2];
        var c0 = ringIds[i + 1][k];
        var d0 = ringIds[i + 1][k2];
        g.tri(a0, c0, b0);
        g.tri(b0, c0, d0);
      }
    }
    var nose = g.v(0.68, -0.01, 0, 0, 1, 0, 0);
    var last = ringIds[rings - 1];
    for (k = 0; k < around; k++) g.tri(nose, last[k], last[(k + 1) % around]);
    var tailC = g.v(-0.46, 0, 0, 0, -1, 0, 0);
    var first = ringIds[0];
    for (k = 0; k < around; k++) g.tri(tailC, first[(k + 1) % around], first[k]);

    function fin(pts) {
      var ids = [];
      for (var n = 0; n < pts.length; n++) ids.push(g.v(pts[n][0], pts[n][1], pts[n][2], 1, 0, 0.15, 1));
      return ids;
    }
    var caudal = fin([
      [-0.36, 0.05, 0.02],
      [-0.36, -0.04, 0.02],
      [-0.98, 0.40, 0.05],
      [-0.86, 0.16, 0.04],
      [-0.74, 0.0, 0.03],
      [-0.86, -0.16, 0.04],
      [-0.98, -0.36, 0.05]
    ]);
    g.tri(caudal[0], caudal[2], caudal[3]);
    g.tri(caudal[0], caudal[3], caudal[4]);
    g.tri(caudal[0], caudal[4], caudal[1]);
    g.tri(caudal[1], caudal[4], caudal[5]);
    g.tri(caudal[1], caudal[5], caudal[6]);
    var dorsal = fin([
      [-0.12, 0.22, 0.02],
      [0.20, 0.18, 0.02],
      [0.02, 0.50, 0.03]
    ]);
    g.tri(dorsal[0], dorsal[1], dorsal[2]);
    var anal = fin([
      [-0.02, -0.18, 0.02],
      [0.16, -0.14, 0.02],
      [0.04, -0.38, 0.02]
    ]);
    g.tri(anal[0], anal[2], anal[1]);
    var pr = fin([
      [0.2, 0.02, 0.08],
      [0.02, -0.04, 0.1],
      [-0.08, -0.1, 0.28]
    ]);
    g.tri(pr[0], pr[1], pr[2]);
    var pl = fin([
      [0.2, 0.02, -0.08],
      [0.02, -0.04, -0.1],
      [-0.08, -0.1, -0.28]
    ]);
    g.tri(pl[0], pl[2], pl[1]);
    addOcta(g, 0.28, 0.08, 0.11, 0.058, 2);
    addOcta(g, 0.28, 0.08, -0.11, 0.058, 2);
    return g.pack();
  }

  function buildIco() {
    var g = new Geo();
    var t = (1 + Math.sqrt(5)) / 2;
    var raw = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
    ];
    var ids = [];
    for (var i = 0; i < raw.length; i++) {
      var l = Math.hypot(raw[i][0], raw[i][1], raw[i][2]);
      ids.push(g.v(raw[i][0] / l, raw[i][1] / l, raw[i][2] / l, 0));
    }
    var faces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
    ];
    for (i = 0; i < faces.length; i++) g.tri(ids[faces[i][0]], ids[faces[i][1]], ids[faces[i][2]]);
    return g.pack();
  }

  function buildRibbon(halfW, segs) {
    var g = new Geo();
    var ids = [];
    var i, y, w, taper;
    for (i = 0; i <= segs; i++) {
      y = i / segs;
      taper = 1 - y * 0.72;
      w = halfW * taper;
      ids.push(g.v(-w, y, 0, 0));
      ids.push(g.v(w, y, 0, 0));
    }
    for (i = 0; i < segs; i++) {
      var a = ids[i * 2];
      var b = ids[i * 2 + 1];
      var c = ids[i * 2 + 2];
      var d = ids[i * 2 + 3];
      g.tri(a, c, b);
      g.tri(b, c, d);
    }
    return g.pack();
  }

  function buildSand() {
    var g = new Geo();
    var a = g.v(-1, 0, -1, 0);
    var b = g.v(1, 0, -1, 0);
    var c = g.v(1, 0, 1, 0);
    var d = g.v(-1, 0, 1, 0);
    g.tri(a, b, c);
    g.tri(a, c, d);
    return g.pack();
  }

  var VS = [
    "#version 300 es",
    "precision mediump float;",
    "layout(location=0) in vec3 aPos;",
    "layout(location=1) in vec3 aNrm;",
    "layout(location=2) in float aPart;",
    "layout(location=3) in vec4 aI0;",
    "layout(location=4) in vec4 aI1;",
    "layout(location=5) in vec4 aI2;",
    "layout(location=6) in vec4 aI3;",
    "uniform mat4 uVP;",
    "uniform float uTime;",
    "uniform float uKind;",
    "uniform float uFloor;",
    "uniform float uCeil;",
    "out vec3 vWorld;",
    "out vec3 vN;",
    "out vec3 vLocal;",
    "out float vPart;",
    "out float vVariety;",
    "out float vSeed;",
    "out float vFade;",
    "out vec3 vColor;",
    "void main() {",
    "  vLocal = aPos;",
    "  vPart = aPart;",
    "  vVariety = aI2.w;",
    "  vSeed = aI3.x;",
    "  vColor = aI2.xyz;",
    "  vFade = 1.0;",
    "  vec3 p = aPos;",
    "  vec3 n = aNrm;",
    "  if (uKind < 0.5) {",
    "    float tail = clamp(0.42 - aPos.x, 0.0, 1.3);",
    "    float wag = sin(uTime * 6.6 + aI1.w * 6.28318 - aPos.x * 8.0) * tail * 0.22;",
    "    p.z += wag;",
    "    p.y += wag * 0.16;",
    "  } else if (uKind < 1.5) {",
    "    p.y *= 0.42;",
    "    p.x *= 0.72 + 0.55 * fract(aI3.x * 3.17);",
    "    p.z *= 0.68 + 0.60 * fract(aI3.x * 8.91);",
    "  } else if (uKind < 2.5) {",
    "    float h = clamp(aPos.y, 0.0, 1.0);",
    "    p.x += sin(uTime * 1.2 + aI1.w + aPos.y * 3.2) * h * h * 0.28;",
    "    p.z += cos(uTime * 0.85 + aI1.w * 1.6) * h * h * 0.10;",
    "  }",
    "  float sc = aI0.w;",
    "  vec3 world;",
    "  if (uKind > 2.5 && uKind < 3.5) {",
    "    float seed = aI3.x;",
    "    float cycle = 4.2 + fract(seed * 2.17) * 5.8;",
    "    float u = fract(uTime / cycle + seed);",
    "    float fade = smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.78, u);",
    "    vFade = fade;",
    "    sc *= (0.50 + 0.90 * u) * max(fade, 0.001);",
    "    world = vec3(aI0.x + sin(u * 6.28318 + seed * 30.0) * 0.055, mix(uFloor, uCeil, u), aI0.z + cos(u * 5.1 + seed * 12.0) * 0.04);",
    "    p *= sc;",
    "    n = normalize(aNrm);",
    "    world += p;",
    "  } else if (uKind > 3.5) {",
    "    p *= sc;",
    "    world = aI0.xyz + p;",
    "    n = vec3(0.0, 1.0, 0.0);",
    "  } else {",
    "    p *= sc;",
    "    float cr = cos(aI1.z), sr = sin(aI1.z);",
    "    float y1 = cr * p.y - sr * p.z;",
    "    float z1 = sr * p.y + cr * p.z;",
    "    p.y = y1; p.z = z1;",
    "    float ny1 = cr * n.y - sr * n.z;",
    "    float nz1 = sr * n.y + cr * n.z;",
    "    n.y = ny1; n.z = nz1;",
    "    float cp = cos(aI1.y), sp = sin(aI1.y);",
    "    float x2 = cp * p.x - sp * p.y;",
    "    float y2 = sp * p.x + cp * p.y;",
    "    p.x = x2; p.y = y2;",
    "    float nx2 = cp * n.x - sp * n.y;",
    "    float ny2 = sp * n.x + cp * n.y;",
    "    n.x = nx2; n.y = ny2;",
    "    float cy = cos(aI1.x), sy = sin(aI1.x);",
    "    float x3 = cy * p.x + sy * p.z;",
    "    float z3 = -sy * p.x + cy * p.z;",
    "    p.x = x3; p.z = z3;",
    "    float nx3 = cy * n.x + sy * n.z;",
    "    float nz3 = -sy * n.x + cy * n.z;",
    "    n.x = nx3; n.z = nz3;",
    "    world = aI0.xyz + p;",
    "  }",
    "  vWorld = world;",
    "  vN = n;",
    "  gl_Position = uVP * vec4(world, 1.0);",
    "}"
  ].join("\n");

  var FS = [
    "#version 300 es",
    "precision mediump float;",
    "in vec3 vWorld;",
    "in vec3 vN;",
    "in vec3 vLocal;",
    "in float vPart;",
    "in float vVariety;",
    "in float vSeed;",
    "in float vFade;",
    "in vec3 vColor;",
    "uniform vec3 uCam;",
    "uniform vec3 uFog;",
    "uniform float uTime;",
    "uniform float uKind;",
    "out vec4 fragColor;",
    "void main() {",
    "  vec3 N = normalize(vN);",
    "  vec3 V = normalize(uCam - vWorld);",
    "  if (dot(N, V) < 0.0) N = -N;",
    "  vec3 L = normalize(vec3(0.22, 0.90, 0.32));",
    "  float ndl = clamp(dot(N, L) * 0.62 + 0.38, 0.0, 1.0);",
    "  vec3 H = normalize(L + V);",
    "  float spec = pow(max(dot(N, H), 0.0), 28.0);",
    "  vec3 albedo = vColor;",
    "  float alpha = 1.0;",
    "  if (uKind < 0.5) {",
    "    float belly = smoothstep(0.10, -0.32, vLocal.y);",
    "    albedo = mix(vColor, vec3(0.99, 0.95, 0.88), belly * 0.88);",
    "    float v = vVariety;",
    "    float calico = step(1.5, v) * step(v, 2.5);",
    "    float ink = step(2.5, v) * step(v, 3.5);",
    "    float rose = step(3.5, v) * step(v, 4.5);",
    "    float silver = step(5.5, v) * step(v, 6.5);",
    "    float copper = step(6.5, v);",
    "    float wave = sin(vLocal.x * 8.0 + vSeed) * sin(vLocal.y * 6.5 + vSeed * 1.4);",
    "    float wave2 = sin(vLocal.x * 4.5 + vLocal.y * 5.0 + vSeed * 0.7);",
    "    float blotch = smoothstep(0.05, 0.45, wave * 0.5 + 0.5);",
    "    float spot = smoothstep(0.2, 0.55, wave2 * 0.5 + 0.5);",
    "    albedo = mix(albedo, vec3(0.98, 0.55, 0.22), blotch * calico * 0.8);",
    "    albedo = mix(albedo, vColor * 0.38 + vec3(0.12, 0.05, 0.04), spot * (calico + copper) * 0.72);",
    "    albedo = mix(albedo, vec3(0.95, 0.48, 0.16), spot * ink * 0.85);",
    "    float cap = smoothstep(-0.02, 0.18, vLocal.y);",
    "    albedo = mix(albedo, albedo * vec3(0.55, 0.22, 0.24), cap * rose * 0.70);",
    "    float band = 0.5 + 0.5 * sin(vLocal.x * 14.0 + vLocal.y * 4.0);",
    "    albedo = mix(albedo, vec3(0.90, 0.94, 0.92), band * silver * 0.35);",
    "    if (vPart > 1.5) { albedo = vec3(0.03, 0.02, 0.025); spec *= 1.8; }",
    "    else if (vPart > 0.5) { albedo = mix(albedo, vec3(1.0, 0.90, 0.78), 0.42); spec *= 0.30; }",
    "    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.1);",
    "    albedo += vec3(0.35, 0.70, 0.65) * rim * 0.22;",
    "  } else if (uKind > 2.5 && uKind < 3.5) {",
    "    float fres = pow(1.0 - max(dot(N, V), 0.0), 1.5);",
    "    albedo = mix(vec3(0.70, 0.90, 0.88), vec3(1.0), fres);",
    "    alpha = mix(0.12, 0.62, fres) * vFade;",
    "    spec *= 0.8;",
    "  } else if (uKind > 1.5 && uKind < 2.5) {",
    "    float hh = clamp(vLocal.y, 0.0, 1.0);",
    "    albedo = mix(vColor * 0.65, vColor, hh);",
    "    spec *= 0.15;",
    "  } else {",
    "    spec *= 0.22;",
    "  }",
    "  float cau = 0.9 + 0.1 * sin(vWorld.x * 3.2 + uTime * 0.8) * sin(vWorld.z * 2.6 - uTime * 0.6);",
    "  vec3 col = albedo * (ndl * vec3(1.0, 0.97, 0.90) + vec3(0.08, 0.14, 0.15)) * cau;",
    "  float specGain = uKind < 0.5 ? 0.16 : 0.28;",
    "  col += spec * vec3(1.0, 0.96, 0.88) * specGain;",
    "  float dist = length(uCam - vWorld);",
    "  float fog = smoothstep(3.2, 7.2, dist);",
    "  col = mix(col, uFog, fog * 0.55);",
    "  fragColor = vec4(col, alpha);",
    "}"
  ].join("\n");

  var BG_VS = [
    "#version 300 es",
    "precision mediump float;",
    "layout(location=0) in vec2 aPos;",
    "out vec2 vUv;",
    "void main() {",
    "  vUv = aPos * 0.5 + 0.5;",
    "  gl_Position = vec4(aPos, 0.0, 1.0);",
    "}"
  ].join("\n");

  var BG_FS = [
    "#version 300 es",
    "precision mediump float;",
    "in vec2 vUv;",
    "uniform float uTime;",
    "uniform vec2 uPtr;",
    "uniform float uPtrOn;",
    "out vec4 fragColor;",
    "void main() {",
    "  vec2 uv = vUv;",
    "  float y = uv.y;",
    "  vec3 deep = vec3(0.016, 0.075, 0.090);",
    "  vec3 midc = vec3(0.04, 0.34, 0.38);",
    "  vec3 upper = vec3(0.16, 0.64, 0.60);",
    "  vec3 surface = vec3(0.78, 0.95, 0.90);",
    "  vec3 col = mix(deep, midc, smoothstep(0.0, 0.46, y));",
    "  col = mix(col, upper, smoothstep(0.32, 0.78, y));",
    "  col = mix(col, surface, smoothstep(0.80, 1.0, y));",
    "  float c1 = sin(uv.x * 16.0 + uTime * 0.70) * sin(uv.y * 12.0 - uTime * 0.50);",
    "  float c2 = sin((uv.x + uv.y) * 11.0 - uTime * 0.45);",
    "  float cau = pow(max(c1 * c2, 0.0), 1.5);",
    "  col += vec3(0.28, 0.50, 0.44) * cau * smoothstep(0.12, 0.75, y) * 0.38;",
    "  float ray = 0.0;",
    "  for (int i = 0; i < 5; i++) {",
    "    float fi = float(i);",
    "    float x0 = 0.16 + fi * 0.17 + sin(uTime * 0.15 + fi) * 0.03;",
    "    float dx = (uv.x - x0) / (0.05 + y * 0.02);",
    "    ray += exp(-dx * dx);",
    "  }",
    "  col += vec3(0.55, 0.86, 0.76) * ray * pow(y, 1.35) * 0.11;",
    "  vec2 g = vec2(uv.x * 12.0, uv.y * 26.0 - uTime * 0.28);",
    "  vec2 id = floor(g);",
    "  vec2 f = fract(g) - 0.5;",
    "  float h = fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5453);",
    "  f.x += (h - 0.5) * 0.55;",
    "  float mote = smoothstep(0.07, 0.0, length(f)) * step(0.80, h);",
    "  col += vec3(0.85, 0.96, 0.92) * mote * 0.5;",
    "  vec2 q = uv * 2.0 - 1.0;",
    "  q.x *= 0.72;",
    "  col *= mix(0.70, 1.0, smoothstep(1.35, 0.25, dot(q, q)));",
    "  col *= mix(0.62, 1.0, smoothstep(0.0, 0.28, y));",
    "  float pd = length((uv - uPtr) * vec2(0.72, 1.0));",
    "  float ring = smoothstep(0.045, 0.0, abs(pd - 0.055));",
    "  float glow = exp(-pd * pd * 48.0);",
    "  col += vec3(0.65, 0.95, 0.86) * (ring * 0.14 + glow * 0.12) * uPtrOn;",
    "  fragColor = vec4(col, 1.0);",
    "}"
  ].join("\n");

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(log || "shader");
    }
    return sh;
  }

  function program(gl, vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) || "link");
    }
    return p;
  }

  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }
  function norm3(a) {
    var l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  function sub3(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  function lookAt(out, eye, center, up) {
    var zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
    var len = Math.hypot(zx, zy, zz) || 1;
    zx /= len; zy /= len; zz /= len;
    var xx = up[1] * zz - up[2] * zy;
    var xy = up[2] * zx - up[0] * zz;
    var xz = up[0] * zy - up[1] * zx;
    len = Math.hypot(xx, xy, xz) || 1;
    xx /= len; xy /= len; xz /= len;
    var yx = zy * xz - zz * xy;
    var yy = zz * xx - zx * xz;
    var yz = zx * xy - zy * xx;
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
  }

  function perspective(out, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    var nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
  }

  function mulMat(out, a, b) {
    var c, r;
    for (c = 0; c < 4; c++) {
      for (r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[r] * b[c * 4] +
          a[4 + r] * b[c * 4 + 1] +
          a[8 + r] * b[c * 4 + 2] +
          a[12 + r] * b[c * 4 + 3];
      }
    }
  }

  function sceneMetrics() {
    var w = canvas.clientWidth || stage.clientWidth || 390;
    var h = canvas.clientHeight || stage.clientHeight || 844;
    var aspect = Math.max(0.35, w / Math.max(1, h));
    var eye = [0.0, 0.34, 4.35];
    var target = [0.0, -0.12, 0.0];
    var worldUp = [0, 1, 0];
    var f = norm3(sub3(target, eye));
    var r = norm3(cross(f, worldUp));
    var u = cross(r, f);
    var dist = Math.hypot(target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]);
    var halfW = 1.15;
    var halfH = halfW / aspect;
    var vfov = 2 * Math.atan(halfH / dist);
    var floorY = target[1] - halfH * 0.68;
    var yHi = target[1] + halfH * 0.72;
    var yLo = floorY + 0.18;
    if (yHi < yLo + 0.4) yHi = yLo + 0.4;
    return {
      eye: eye, target: target, f: f, r: r, u: u, dist: dist,
      halfW: halfW, halfH: halfH, vfov: vfov, aspect: aspect,
      floorY: floorY, yLo: yLo, yHi: yHi
    };
  }

  function makeVAO(gl, geo, instances, dynamic) {
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, geo.inter, gl.STATIC_DRAW);
    var stride = 28;
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 24);
    var ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);
    var inst = gl.createBuffer();
    var data = new Float32Array(instances * 16);
    gl.bindBuffer(gl.ARRAY_BUFFER, inst);
    gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    for (var i = 0; i < 4; i++) {
      gl.enableVertexAttribArray(3 + i);
      gl.vertexAttribPointer(3 + i, 4, gl.FLOAT, false, 64, i * 16);
      gl.vertexAttribDivisor(3 + i, 1);
    }
    gl.bindVertexArray(null);
    return { vao: vao, inst: inst, data: data, count: geo.indices.length, n: instances };
  }

  function putInst(data, i, x, y, z, sc, yaw, pitch, roll, phase, r, g, b, variety, seed) {
    var o = i * 16;
    data[o] = x; data[o + 1] = y; data[o + 2] = z; data[o + 3] = sc;
    data[o + 4] = yaw; data[o + 5] = pitch; data[o + 6] = roll; data[o + 7] = phase;
    data[o + 8] = r; data[o + 9] = g; data[o + 10] = b; data[o + 11] = variety;
    data[o + 12] = seed; data[o + 13] = 0; data[o + 14] = 0; data[o + 15] = 0;
  }

  var COATS = [
    { rgb: [0.98, 0.58, 0.12], v: 0, w: 18 },
    { rgb: [0.97, 0.36, 0.14], v: 1, w: 16 },
    { rgb: [0.97, 0.78, 0.52], v: 2, w: 12 },
    { rgb: [0.16, 0.11, 0.12], v: 3, w: 8 },
    { rgb: [0.92, 0.32, 0.40], v: 4, w: 12 },
    { rgb: [0.98, 0.74, 0.18], v: 5, w: 14 },
    { rgb: [0.70, 0.78, 0.76], v: 6, w: 8 },
    { rgb: [0.74, 0.34, 0.14], v: 7, w: 10 }
  ];
  var STONES = [
    [0.62, 0.48, 0.32],
    [0.42, 0.34, 0.28],
    [0.70, 0.56, 0.38],
    [0.34, 0.30, 0.27],
    [0.55, 0.40, 0.30]
  ];
  var GREENS = [
    [0.08, 0.40, 0.26],
    [0.14, 0.52, 0.30],
    [0.40, 0.62, 0.24],
    [0.06, 0.30, 0.22]
  ];

  function schoolCount() {
    var coarse = false;
    try { coarse = window.matchMedia("(pointer: coarse)").matches; } catch (err) { coarse = false; }
    var narrow = (stage.clientWidth || window.innerWidth || 390) < 700;
    return (coarse || narrow) ? 84 : 200;
  }

  function angLerp(a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function boot() {
    var gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: true,
      stencil: false,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false
    });
    if (!gl) {
      showFallback();
      return;
    }

    var meshProg = program(gl, VS, FS);
    var bgProg = program(gl, BG_VS, BG_FS);
    var uVP = gl.getUniformLocation(meshProg, "uVP");
    var uTime = gl.getUniformLocation(meshProg, "uTime");
    var uKind = gl.getUniformLocation(meshProg, "uKind");
    var uFloor = gl.getUniformLocation(meshProg, "uFloor");
    var uCeil = gl.getUniformLocation(meshProg, "uCeil");
    var uCam = gl.getUniformLocation(meshProg, "uCam");
    var uFog = gl.getUniformLocation(meshProg, "uFog");
    var bgTime = gl.getUniformLocation(bgProg, "uTime");
    var bgPtr = gl.getUniformLocation(bgProg, "uPtr");
    var bgPtrOn = gl.getUniformLocation(bgProg, "uPtrOn");

    var fishGeo = buildFish();
    var icoGeo = buildIco();
    var kelpGeo = buildRibbon(0.055, 8);
    var bladeGeo = buildRibbon(0.022, 6);
    var sandGeo = buildSand();

    var nFish = schoolCount();
    var fishMesh = makeVAO(gl, fishGeo, nFish, true);
    var gravelMesh = makeVAO(gl, icoGeo, 84, false);
    var bubbleMesh = makeVAO(gl, icoGeo, 42, false);
    var kelpMesh = makeVAO(gl, kelpGeo, 10, false);
    var bladeMesh = makeVAO(gl, bladeGeo, 16, false);
    var sandMesh = makeVAO(gl, sandGeo, 1, false);

    var bgVao = gl.createVertexArray();
    gl.bindVertexArray(bgVao);
    var bgBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bgBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    var rng = mulberry32(0x5a01);
    function bell() {
      return (rng() + rng() + rng() - 1.5) / 1.5;
    }
    var weightSum = 0;
    for (var ci = 0; ci < COATS.length; ci++) weightSum += COATS[ci].w;

    var S = 16;
    var F = new Float32Array(nFish * S);
    var m0 = sceneMetrics();
    var i, coat, pick, acc, shade, sc, yaw0, spd, vx, vy, vz;
    for (i = 0; i < nFish; i++) {
      pick = rng() * weightSum;
      acc = 0;
      coat = COATS[0];
      for (ci = 0; ci < COATS.length; ci++) {
        acc += COATS[ci].w;
        if (pick <= acc) { coat = COATS[ci]; break; }
      }
      shade = 0.9 + rng() * 0.18;
      var o = i * S;
      var yMid = m0.floorY + (m0.yHi - m0.floorY) * 0.58;
      var ySpan = (m0.yHi - m0.yLo) * 0.28;
      var px0 = Math.max(-m0.halfW * 0.7, Math.min(m0.halfW * 0.7, bell() * m0.halfW * 0.62));
      var py0 = yMid + bell() * ySpan;
      py0 = Math.max(m0.yLo + 0.08, Math.min(m0.yHi - 0.28, py0));
      var pz0 = Math.max(-0.55, Math.min(0.4, bell() * 0.48));
      F[o] = px0;
      F[o + 1] = py0;
      F[o + 2] = pz0;
      yaw0 = 0.35 + (rng() - 0.5) * (rng() < 0.72 ? 1.1 : 5.2);
      spd = 0.26 + rng() * 0.24;
      vx = Math.cos(yaw0) * spd;
      vz = -Math.sin(yaw0) * spd;
      vy = (rng() - 0.5) * 0.08;
      F[o + 3] = vx; F[o + 4] = vy; F[o + 5] = vz;
      F[o + 6] = Math.atan2(-vz, vx);
      F[o + 7] = Math.atan2(vy, Math.hypot(vx, vz));
      F[o + 8] = 0;
      F[o + 9] = rng();
      var foreground = rng() < 0.14;
      sc = foreground ? 0.34 + rng() * 0.12 : 0.17 + rng() * 0.12;
      if (foreground) F[o + 2] = Math.min(0.42, F[o + 2] + 0.18);
      F[o + 10] = sc;
      F[o + 11] = coat.rgb[0] * shade;
      F[o + 12] = coat.rgb[1] * shade;
      F[o + 13] = coat.rgb[2] * shade;
      F[o + 14] = coat.v;
      F[o + 15] = rng() * 40 + 1;
    }

    function layoutStatic(m) {
      var gi, stone, col, gs;
      for (gi = 0; gi < gravelMesh.n; gi++) {
        stone = STONES[(rng() * STONES.length) | 0];
        gs = 0.035 + rng() * 0.07;
        if (rng() < 0.12) gs += 0.05;
        putInst(
          gravelMesh.data, gi,
          (rng() * 2 - 1) * m.halfW * 0.98,
          m.floorY + rng() * 0.03,
          (rng() * 2 - 1) * 0.95,
          gs,
          rng() * Math.PI * 2, rng() * 0.4, rng() * 0.5, rng(),
          stone[0], stone[1], stone[2], 1, rng() * 9 + 0.2
        );
      }
      putInst(sandMesh.data, 0, 0, m.floorY - 0.02, 0, 5.5, 0, 0, 0, 0, 0.46, 0.36, 0.26, 4, 1);
      var plants = [
        { mesh: kelpMesh, n: kelpMesh.n },
        { mesh: bladeMesh, n: bladeMesh.n }
      ];
      var spots = [-0.92, -0.84, -0.74, -0.66, 0.66, 0.74, 0.84, 0.92, -0.96, 0.96, -0.58, 0.58];
      var pi = 0;
      for (var group = 0; group < plants.length; group++) {
        var mesh = plants[group].mesh;
        for (gi = 0; gi < mesh.n; gi++) {
          col = GREENS[(rng() * GREENS.length) | 0];
          var sx = spots[pi % spots.length] * m.halfW;
          pi++;
          var height = (group === 0 ? 0.42 + rng() * 0.38 : 0.22 + rng() * 0.28) * Math.min(m.halfH * 0.72, 1.85);
          putInst(
            mesh.data, gi,
            sx + (rng() - 0.5) * 0.12,
            m.floorY,
            -0.35 + rng() * 0.9,
            height,
            rng() * Math.PI * 2, 0, 0, rng() * 6.28,
            col[0], col[1], col[2], 2, rng()
          );
        }
      }
      var vents = [[-0.55, 0.15], [0.42, -0.2], [0.05, 0.4]];
      for (gi = 0; gi < bubbleMesh.n; gi++) {
        var vent = vents[gi % vents.length];
        putInst(
          bubbleMesh.data, gi,
          vent[0] * m.halfW + (rng() - 0.5) * 0.12,
          m.floorY,
          vent[1] + (rng() - 0.5) * 0.1,
          0.03 + rng() * 0.035,
          0, 0, 0, rng(),
          0.85, 0.95, 0.92, 3, rng()
        );
      }
      uploadStatic(gravelMesh);
      uploadStatic(sandMesh);
      uploadStatic(kelpMesh);
      uploadStatic(bladeMesh);
      uploadStatic(bubbleMesh);
    }

    function uploadStatic(mesh) {
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.inst);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.data);
    }
    layoutStatic(m0);

    var view = new Float32Array(16);
    var proj = new Float32Array(16);
    var vp = new Float32Array(16);
    var simTime = 1.7;
    var last = performance.now();
    var touchHold = false;
    var pointerInside = false;
    var steer = 0;
    var ptrU = 0.5;
    var ptrV = 0.55;
    var ray = { ox: 0, oy: 0, oz: 4, dx: 0, dy: 0, dz: -1 };
    var metrics = m0;
    var pixW = 0;
    var pixH = 0;

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      var w = stage.clientWidth || canvas.clientWidth || 1;
      var h = stage.clientHeight || canvas.clientHeight || 1;
      var pw = Math.max(1, Math.round(w * dpr));
      var ph = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      pixW = pw;
      pixH = ph;
    }

    function aim(e) {
      var rect = canvas.getBoundingClientRect();
      var rw = rect.width || 1;
      var rh = rect.height || 1;
      var nx = ((e.clientX - rect.left) / rw) * 2 - 1;
      var ny = -(((e.clientY - rect.top) / rh) * 2 - 1);
      ptrU = (e.clientX - rect.left) / rw;
      ptrV = 1 - (e.clientY - rect.top) / rh;
      var m = metrics;
      var px = m.target[0] + m.r[0] * nx * m.halfW + m.u[0] * ny * m.halfH;
      var py = m.target[1] + m.r[1] * nx * m.halfW + m.u[1] * ny * m.halfH;
      var pz = m.target[2] + m.r[2] * nx * m.halfW + m.u[2] * ny * m.halfH;
      var dx = px - m.eye[0], dy = py - m.eye[1], dz = pz - m.eye[2];
      var len = Math.hypot(dx, dy, dz) || 1;
      ray.ox = m.eye[0]; ray.oy = m.eye[1]; ray.oz = m.eye[2];
      ray.dx = dx / len; ray.dy = dy / len; ray.dz = dz / len;
      steer = 1;
    }

    canvas.addEventListener("pointerdown", function (e) {
      if (e.cancelable) e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* already gone */ }
      touchHold = true;
      pointerInside = true;
      aim(e);
    }, { passive: false });
    canvas.addEventListener("pointermove", function (e) {
      if (touchHold || e.pointerType === "mouse") {
        if (e.cancelable) e.preventDefault();
        pointerInside = true;
        aim(e);
      }
    }, { passive: false });
    function release(e) {
      touchHold = false;
      if (!e || e.pointerType !== "mouse") pointerInside = false;
    }
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerleave", function () {
      if (!touchHold) pointerInside = false;
    });
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    function step(dt) {
      if (!(pointerInside || touchHold)) steer *= Math.exp(-2.8 * dt);
      var m = metrics;
      var xLim = m.halfW * 0.84;
      var zLo = -0.72;
      var zHi = 0.62;
      var yLo = m.yLo;
      var yHi = m.yHi;
      var yMid = m.floorY + (m.yHi - m.floorY) * 0.6;
      var driftX = Math.sin(simTime * 0.22) * m.halfW * 0.18;
      var driftY = yMid + Math.sin(simTime * 0.16) * (yHi - yLo) * 0.06;
      var driftZ = Math.cos(simTime * 0.19) * 0.18;
      var sepR = 0.3;
      var neiR = 0.62;
      var sepR2 = sepR * sepR;
      var neiR2 = neiR * neiR;
      var avoidR = 0.86;
      var avoidR2 = avoidR * avoidR;
      var i, j, o, p, dx, dy, dz, d2, d, inv;
      for (i = 0; i < nFish; i++) {
        o = i * S;
        var x = F[o], y = F[o + 1], z = F[o + 2];
        var vx0 = F[o + 3], vy0 = F[o + 4], vz0 = F[o + 5];
        var cx = 0, cy = 0, cz = 0, cnt = 0;
        var axv = 0, ayv = 0, azv = 0;
        var sx = 0, sy = 0, sz = 0;
        for (j = 0; j < nFish; j++) {
          if (j === i) continue;
          p = j * S;
          dx = x - F[p]; dy = y - F[p + 1]; dz = z - F[p + 2];
          d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < sepR2 && d2 > 1e-8) {
            inv = 1 / Math.sqrt(d2);
            sx += dx * inv; sy += dy * inv; sz += dz * inv;
          }
          if (d2 < neiR2) {
            cx += F[p]; cy += F[p + 1]; cz += F[p + 2];
            axv += F[p + 3]; ayv += F[p + 4]; azv += F[p + 5];
            cnt++;
          }
        }
        var ax = sx * 1.7;
        var ay = sy * 1.7;
        var az = sz * 1.7;
        if (cnt > 0) {
          var invC = 1 / cnt;
          ax += (axv * invC - vx0) * 0.9;
          ay += (ayv * invC - vy0) * 0.9;
          az += (azv * invC - vz0) * 0.9;
          ax += (cx * invC - x) * 0.72;
          ay += (cy * invC - y) * 0.72;
          az += (cz * invC - z) * 0.72;
        }
        var driftK = 0.26 * (1 - steer * 0.8);
        ax += (driftX - x) * driftK;
        ay += (driftY - y) * driftK;
        az += (driftZ - z) * driftK * 0.8;
        if (x > xLim) ax -= (x - xLim) * 4.2;
        if (x < -xLim) ax += (-xLim - x) * 4.2;
        if (y > yHi) ay -= (y - yHi) * 4.2;
        if (y < yLo) ay += (yLo - y) * 4.5;
        if (z > zHi) az -= (z - zHi) * 3.6;
        if (z < zLo) az += (zLo - z) * 3.6;
        if (steer > 0.02) {
          var vxR = x - ray.ox, vyR = y - ray.oy, vzR = z - ray.oz;
          var tHit = vxR * ray.dx + vyR * ray.dy + vzR * ray.dz;
          if (tHit < 0) tHit = 0;
          var qx = ray.ox + ray.dx * tHit;
          var qy = ray.oy + ray.dy * tHit;
          var qz = ray.oz + ray.dz * tHit;
          dx = x - qx; dy = y - qy; dz = z - qz;
          d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < avoidR2) {
            d = Math.sqrt(d2) + 0.045;
            var push = 1 - d / avoidR;
            var s = push * push * 11.0 * steer;
            ax += (dx / d) * s;
            ay += (dy / d) * s;
            az += (dz / d) * s;
            var tx = ray.dy * dz - ray.dz * dy;
            var ty = ray.dz * dx - ray.dx * dz;
            var tz = ray.dx * dy - ray.dy * dx;
            var tl = Math.hypot(tx, ty, tz) + 0.0001;
            var swirl = push * 2.4 * steer;
            ax += (tx / tl) * swirl;
            ay += (ty / tl) * swirl;
            az += (tz / tl) * swirl;
          }
        }
        var sp0 = Math.hypot(vx0, vy0, vz0);
        if (sp0 < 0.16) {
          ax += Math.cos(F[o + 9] * 6.28) * 0.55;
          az += Math.sin(F[o + 9] * 6.28) * 0.35;
        }
        var am = Math.hypot(ax, ay, az);
        if (am > 9) {
          var ak = 9 / am;
          ax *= ak; ay *= ak; az *= ak;
        }
        vx0 += ax * dt; vy0 += ay * dt; vz0 += az * dt;
        var sp = Math.hypot(vx0, vy0, vz0);
        var maxS = 0.58 + steer * 0.38;
        if (sp > maxS) {
          var sk = maxS / sp;
          vx0 *= sk; vy0 *= sk; vz0 *= sk;
          sp = maxS;
        }
        x += vx0 * dt; y += vy0 * dt; z += vz0 * dt;
        var yTop = yHi - 0.26;
        var yBot = yLo + 0.02;
        if (x > xLim) { x = xLim; if (vx0 > 0) vx0 *= -0.25; }
        if (x < -xLim) { x = -xLim; if (vx0 < 0) vx0 *= -0.25; }
        if (y > yTop) { y = yTop; if (vy0 > 0) vy0 *= -0.35; }
        if (y < yBot) { y = yBot; if (vy0 < 0) vy0 *= -0.35; }
        if (z > zHi) { z = zHi; if (vz0 > 0) vz0 *= -0.25; }
        if (z < zLo) { z = zLo; if (vz0 < 0) vz0 *= -0.25; }
        var targetYaw = Math.atan2(-vz0, vx0);
        var horiz = Math.hypot(vx0, vz0) || 0.0001;
        var targetPitch = Math.atan2(vy0, horiz);
        var turn = targetYaw - F[o + 6];
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        var k = 1 - Math.exp(-7 * dt);
        var yaw = angLerp(F[o + 6], targetYaw, k);
        var pitch = F[o + 7] + (targetPitch - F[o + 7]) * k;
        var rollT = Math.max(-0.95, Math.min(0.95, -turn * 1.8));
        var roll = F[o + 8] + (rollT - F[o + 8]) * k;
        F[o] = x; F[o + 1] = y; F[o + 2] = z;
        F[o + 3] = vx0; F[o + 4] = vy0; F[o + 5] = vz0;
        F[o + 6] = yaw; F[o + 7] = pitch; F[o + 8] = roll;
        var id = fishMesh.data;
        var q = i * 16;
        id[q] = x; id[q + 1] = y; id[q + 2] = z; id[q + 3] = F[o + 10];
        id[q + 4] = yaw; id[q + 5] = pitch; id[q + 6] = roll; id[q + 7] = F[o + 9];
        id[q + 8] = F[o + 11]; id[q + 9] = F[o + 12]; id[q + 10] = F[o + 13]; id[q + 11] = F[o + 14];
        id[q + 12] = F[o + 15];
      }
    }

    function drawMesh(mesh, kind) {
      gl.uniform1f(uKind, kind);
      gl.bindVertexArray(mesh.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0, mesh.n);
    }

    function draw() {
      metrics = sceneMetrics();
      var m = metrics;
      perspective(proj, m.vfov, m.aspect, 0.08, 40);
      lookAt(view, m.eye, m.target, [0, 1, 0]);
      mulMat(vp, proj, view);
      gl.viewport(0, 0, pixW, pixH);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.useProgram(bgProg);
      gl.uniform1f(bgTime, simTime);
      gl.uniform2f(bgPtr, ptrU, ptrV);
      gl.uniform1f(bgPtrOn, steer);
      gl.bindVertexArray(bgVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(meshProg);
      gl.uniformMatrix4fv(uVP, false, vp);
      gl.uniform1f(uTime, simTime);
      gl.uniform3f(uCam, m.eye[0], m.eye[1], m.eye[2]);
      gl.uniform3f(uFog, 0.05, 0.32, 0.36);
      gl.uniform1f(uFloor, m.floorY + 0.02);
      gl.uniform1f(uCeil, m.target[1] + m.halfH * 0.78);
      drawMesh(sandMesh, 4);
      drawMesh(gravelMesh, 1);
      drawMesh(kelpMesh, 2);
      drawMesh(bladeMesh, 2);
      gl.bindBuffer(gl.ARRAY_BUFFER, fishMesh.inst);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, fishMesh.data);
      drawMesh(fishMesh, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      drawMesh(bubbleMesh, 3);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.bindVertexArray(null);
    }

    var laidW = m0.halfW;
    var laidFloor = m0.floorY;
    resize();
    metrics = sceneMetrics();
    step(1 / 60);
    draw();
    signalReady();

    function loop(now) {
      var dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      if (dt < 0) dt = 0;
      resize();
      metrics = sceneMetrics();
      if (Math.abs(metrics.floorY - laidFloor) > 0.35 || Math.abs(metrics.halfW - laidW) > 0.2) {
        layoutStatic(metrics);
        laidFloor = metrics.floorY;
        laidW = metrics.halfW;
      }
      var cosmetic = reduceMotion ? 0.28 : 1;
      simTime += dt * cosmetic;
      step(dt);
      draw();
      signalReady();
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  var started = false;
  function start() {
    if (started) return;
    var w = stage.clientWidth;
    var h = stage.clientHeight;
    if (w < 2 || h < 2) {
      requestAnimationFrame(start);
      return;
    }
    started = true;
    try {
      boot();
    } catch (err) {
      console.error(err && err.message ? err.message : err);
      showFallback();
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
