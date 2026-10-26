/* shoal — original canvas school. Clean-room, no third-party code. */
(function () {
  "use strict";

  var canvas = document.getElementById("tank");
  var decor = document.getElementById("decor");
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
      requestAnimationFrame(signalReady);
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

  var COATS = [
    ["#f2a03a", "#fff1d4"],
    ["#ef5c28", "#ffe3cc"],
    ["#f0c48a", "#fff8ee"],
    ["#2c2628", "#e4d4cc"],
    ["#e24d62", "#ffdfe3"],
    ["#e6be22", "#fff4c4"],
    ["#c5d2ce", "#f5fffb"],
    ["#b86a34", "#f6dcc4"]
  ];

  function makeSprite(body, belly) {
    var c = document.createElement("canvas");
    c.width = 96;
    c.height = 48;
    var g = c.getContext("2d");
    g.translate(52, 24);
    g.beginPath();
    g.moveTo(-14, 0);
    g.lineTo(-40, -12);
    g.quadraticCurveTo(-28, 0, -40, 12);
    g.closePath();
    g.fillStyle = body;
    g.fill();
    g.beginPath();
    g.ellipse(2, 1, 26, 10.5, 0, 0, 6.283185);
    g.fill();
    g.beginPath();
    g.ellipse(4, 4.5, 15, 5.5, 0, 0, 6.283185);
    g.fillStyle = belly;
    g.fill();
    g.beginPath();
    g.moveTo(-4, -7);
    g.quadraticCurveTo(4, -18, 12, -6);
    g.closePath();
    g.fillStyle = body;
    g.fill();
    g.beginPath();
    g.arc(18, -1, 2.7, 0, 6.283185);
    g.fillStyle = "#f6f1e8";
    g.fill();
    g.beginPath();
    g.arc(18.8, -1, 1.35, 0, 6.283185);
    g.fillStyle = "#1a120e";
    g.fill();
    return c;
  }

  function schoolCount() {
    var coarse = false;
    try {
      coarse = window.matchMedia("(pointer: coarse)").matches;
    } catch (err) {
      coarse = false;
    }
    var narrow = (stage.clientWidth || window.innerWidth || 390) < 700;
    return (coarse || narrow) ? 28 : 40;
  }

  function boot() {
    var ctx = canvas.getContext("2d", { alpha: true });
    var bg = decor.getContext("2d", { alpha: false });
    if (!ctx || !bg) {
      showFallback();
      return;
    }

    var sprites = [];
    var si;
    for (si = 0; si < COATS.length; si++) sprites.push(makeSprite(COATS[si][0], COATS[si][1]));

    var nFish = schoolCount();
    var STR = 8;
    var F = new Float32Array(nFish * STR);
    var order = new Int32Array(nFish);
    var CELL = 72;
    var MAX_CELLS = 2048;
    var head = new Int32Array(MAX_CELLS);
    var next = new Int32Array(nFish);
    var cols = 1;
    var rows = 1;

    var BUBBLES = 8;
    var bub = new Float32Array(BUBBLES * 4);

    var cssW = 1;
    var cssH = 1;
    var dpr = 1;
    var pixW = 0;
    var pixH = 0;
    var simTime = 0;
    var last = performance.now();
    var touchHold = false;
    var pointerInside = false;
    var steer = 0;
    var ptrX = 0;
    var ptrY = 0;
    var rng = mulberry32(0x51a1);

    function paintDecor() {
      var pr = mulberry32(0xc0ffee);
      var w = cssW;
      var h = cssH;
      bg.setTransform(dpr, 0, 0, dpr, 0, 0);
      var sky = bg.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#e7fff6");
      sky.addColorStop(0.12, "#7fe0cf");
      sky.addColorStop(0.38, "#149aa4");
      sky.addColorStop(0.72, "#0a6272");
      sky.addColorStop(1, "#042833");
      bg.fillStyle = sky;
      bg.fillRect(0, 0, w, h);

      bg.save();
      bg.globalAlpha = 0.16;
      var ray;
      for (ray = 0; ray < 5; ray++) {
        var x0 = w * (0.12 + ray * 0.18);
        bg.fillStyle = ray % 2 ? "#d9fff4" : "#fff8e4";
        bg.beginPath();
        bg.moveTo(x0, 0);
        bg.lineTo(x0 + w * 0.05, 0);
        bg.lineTo(x0 + w * 0.16, h * 0.78);
        bg.lineTo(x0 - w * 0.04, h * 0.78);
        bg.closePath();
        bg.fill();
      }
      bg.restore();

      var sandY = h * 0.835;
      bg.fillStyle = "#d7b98a";
      bg.beginPath();
      bg.moveTo(0, h);
      bg.lineTo(0, sandY + 8);
      var sx;
      for (sx = 0; sx <= 8; sx++) {
        var px = (w * sx) / 8;
        var py = sandY + Math.sin(sx * 1.3) * h * 0.012;
        bg.lineTo(px, py);
      }
      bg.lineTo(w, h);
      bg.closePath();
      bg.fill();
      bg.fillStyle = "#c4a06e";
      bg.fillRect(0, sandY + h * 0.045, w, h);

      var pebble;
      for (pebble = 0; pebble < 18; pebble++) {
        var pxp = pr() * w;
        var pyp = sandY + 6 + pr() * h * 0.05;
        var prd = 3 + pr() * 7;
        bg.fillStyle = pr() < 0.5 ? "#8d7352" : "#a88a64";
        bg.beginPath();
        bg.ellipse(pxp, pyp, prd, prd * 0.72, pr() * 1.2, 0, 6.283185);
        bg.fill();
      }

      function kelp(x, base, height, lean, color) {
        bg.strokeStyle = color;
        bg.lineWidth = 3.2;
        bg.lineCap = "round";
        bg.beginPath();
        bg.moveTo(x, base);
        bg.bezierCurveTo(x + lean, base - height * 0.35, x - lean * 0.6, base - height * 0.7, x + lean * 0.35, base - height);
        bg.stroke();
        bg.lineWidth = 1.6;
        var leaf;
        for (leaf = 1; leaf <= 3; leaf++) {
          var ly = base - height * (0.25 * leaf);
          var side = leaf % 2 ? 1 : -1;
          bg.beginPath();
          bg.moveTo(x + lean * (0.15 * leaf), ly);
          bg.quadraticCurveTo(x + side * 16, ly - 10, x + side * 8, ly - 22);
          bg.stroke();
        }
      }
      var plant;
      var greens = ["#0e6a48", "#178a52", "#0b5340", "#3d8f3a"];
      for (plant = 0; plant < 7; plant++) {
        var edge = plant < 4 ? pr() * w * 0.22 : w * (0.78 + pr() * 0.2);
        kelp(edge, sandY + 4, h * (0.18 + pr() * 0.16), (pr() - 0.5) * 36, greens[plant % 4]);
      }

      var vig = bg.createRadialGradient(w * 0.5, h * 0.35, w * 0.2, w * 0.5, h * 0.45, w * 0.85);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,18,22,0.28)");
      bg.fillStyle = vig;
      bg.fillRect(0, 0, w, h);
    }

    function placeFish() {
      var i;
      var heading = -0.35;
      var yTop = cssH * 0.08;
      var yBot = cssH * 0.78;
      for (i = 0; i < nFish; i++) {
        var o = i * STR;
        var ang = heading + (rng() - 0.5) * 0.9;
        var spd = 42 + rng() * 36;
        F[o] = cssW * (0.22 + rng() * 0.56);
        F[o + 1] = yTop + rng() * (yBot - yTop);
        F[o + 2] = Math.cos(ang) * spd;
        F[o + 3] = Math.sin(ang) * spd;
        F[o + 4] = ang;
        F[o + 5] = rng();
        F[o + 6] = 0.42 + rng() * 0.38;
        F[o + 7] = (rng() * COATS.length) | 0;
        order[i] = i;
      }
      for (i = 0; i < BUBBLES; i++) {
        var b = i * 4;
        bub[b] = rng() * cssW;
        bub[b + 1] = cssH * (0.4 + rng() * 0.45);
        bub[b + 2] = 2 + rng() * 3.2;
        bub[b + 3] = 18 + rng() * 28;
      }
    }

    function resize() {
      var w = stage.clientWidth || canvas.clientWidth || 1;
      var h = stage.clientHeight || canvas.clientHeight || 1;
      if (w < 2 || h < 2) return false;
      var next = Math.min(window.devicePixelRatio || 1, 1.25);
      if (w * next > 960) next = 960 / w;
      if (h * next > 960) next = 960 / h;
      var pw = Math.max(1, Math.round(w * next));
      var ph = Math.max(1, Math.round(h * next));
      if (pw === pixW && ph === pixH) {
        cssW = w;
        cssH = h;
        dpr = next;
        return false;
      }
      cssW = w;
      cssH = h;
      dpr = next;
      pixW = pw;
      pixH = ph;
      canvas.width = pw;
      canvas.height = ph;
      decor.width = pw;
      decor.height = ph;
      paintDecor();
      return true;
    }

    function aim(e) {
      var rect = canvas.getBoundingClientRect();
      var rw = rect.width || 1;
      var rh = rect.height || 1;
      ptrX = ((e.clientX - rect.left) / rw) * cssW;
      ptrY = ((e.clientY - rect.top) / rh) * cssH;
      steer = 1;
    }

    canvas.addEventListener("pointerdown", function (e) {
      if (e.cancelable) e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
      touchHold = true;
      pointerInside = true;
      aim(e);
    }, { passive: false });
    canvas.addEventListener("pointermove", function (e) {
      if (touchHold || e.pointerType === "mouse") {
        if (e.cancelable && touchHold) e.preventDefault();
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

    function buildGrid() {
      cols = Math.max(1, Math.ceil(cssW / CELL));
      rows = Math.max(1, Math.ceil(cssH / CELL));
      if (cols * rows > MAX_CELLS) {
        cols = Math.max(1, Math.floor(Math.sqrt(MAX_CELLS * (cssW / Math.max(1, cssH)))));
        rows = Math.max(1, Math.floor(MAX_CELLS / cols));
      }
      var ncell = cols * rows;
      var c;
      for (c = 0; c < ncell; c++) head[c] = -1;
      var i;
      for (i = 0; i < nFish; i++) {
        var o = i * STR;
        var cx = (F[o] / CELL) | 0;
        var cy = (F[o + 1] / CELL) | 0;
        if (cx < 0) cx = 0;
        else if (cx >= cols) cx = cols - 1;
        if (cy < 0) cy = 0;
        else if (cy >= rows) cy = rows - 1;
        var cell = cy * cols + cx;
        next[i] = head[cell];
        head[cell] = i;
      }
    }

    function step(dt) {
      if (!(pointerInside || touchHold)) steer *= Math.exp(-3.1 * dt);
      var yTop = cssH * 0.06;
      var yBot = cssH * 0.80;
      var xLo = 16;
      var xHi = cssW - 16;
      var driftX = cssW * (0.5 + Math.sin(simTime * 0.21) * 0.18);
      var driftY = cssH * (0.42 + Math.sin(simTime * 0.16) * 0.08);
      var sepR = 28;
      var neiR = 96;
      var sepR2 = sepR * sepR;
      var neiR2 = neiR * neiR;
      var avoidR = Math.min(cssW, cssH) * 0.22;
      if (avoidR < 78) avoidR = 78;
      var avoidR2 = avoidR * avoidR;
      buildGrid();
      var i;
      for (i = 0; i < nFish; i++) {
        var o = i * STR;
        var x = F[o];
        var y = F[o + 1];
        var vx = F[o + 2];
        var vy = F[o + 3];
        var cx = (x / CELL) | 0;
        var cy = (y / CELL) | 0;
        if (cx < 0) cx = 0;
        else if (cx >= cols) cx = cols - 1;
        if (cy < 0) cy = 0;
        else if (cy >= rows) cy = rows - 1;
        var sx = 0, sy = 0, axv = 0, ayv = 0, gx = 0, gy = 0, cnt = 0;
        var oy, ox, j, p, dx, dy, d2, inv;
        for (oy = -1; oy <= 1; oy++) {
          var yy = cy + oy;
          if (yy < 0 || yy >= rows) continue;
          for (ox = -1; ox <= 1; ox++) {
            var xx = cx + ox;
            if (xx < 0 || xx >= cols) continue;
            j = head[yy * cols + xx];
            while (j >= 0) {
              if (j !== i) {
                p = j * STR;
                dx = x - F[p];
                dy = y - F[p + 1];
                d2 = dx * dx + dy * dy;
                if (d2 < sepR2 && d2 > 0.01) {
                  inv = 1 / Math.sqrt(d2);
                  sx += dx * inv;
                  sy += dy * inv;
                }
                if (d2 < neiR2) {
                  gx += F[p];
                  gy += F[p + 1];
                  axv += F[p + 2];
                  ayv += F[p + 3];
                  cnt++;
                }
              }
              j = next[j];
            }
          }
        }
        var ax = sx * 140;
        var ay = sy * 140;
        if (cnt > 0) {
          inv = 1 / cnt;
          ax += (axv * inv - vx) * 1.15;
          ay += (ayv * inv - vy) * 1.15;
          ax += (gx * inv - x) * 0.85;
          ay += (gy * inv - y) * 0.85;
        }
        ax += (driftX - x) * 0.35;
        ay += (driftY - y) * 0.35;
        var phase = F[o + 5];
        ax += Math.cos(simTime * 0.8 + phase * 6.283185) * 18;
        ay += Math.sin(simTime * 0.63 + phase * 4.1) * 14;
        if (x > xHi) ax -= (x - xHi) * 6;
        if (x < xLo) ax += (xLo - x) * 6;
        if (y > yBot) ay -= (y - yBot) * 6;
        if (y < yTop) ay += (yTop - y) * 6;
        if (steer > 0.03) {
          dx = x - ptrX;
          dy = y - ptrY;
          d2 = dx * dx + dy * dy;
          if (d2 < avoidR2) {
            var d = Math.sqrt(d2) + 8;
            var push = (1 - d / avoidR) * steer;
            ax += (dx / d) * push * 980;
            ay += (dy / d) * push * 980;
            ax += (-dy / d) * push * 260;
            ay += (dx / d) * push * 260;
          }
        }
        vx += ax * dt;
        vy += ay * dt;
        var sp = Math.hypot(vx, vy);
        var maxS = 92 + steer * 70;
        if (sp > maxS) {
          var sk = maxS / sp;
          vx *= sk;
          vy *= sk;
          sp = maxS;
        } else if (sp < 34 && sp > 0.001) {
          var mk = 34 / sp;
          vx *= mk;
          vy *= mk;
        }
        x += vx * dt;
        y += vy * dt;
        if (x > xHi) { x = xHi; if (vx > 0) vx *= -0.35; }
        if (x < xLo) { x = xLo; if (vx < 0) vx *= -0.35; }
        if (y > yBot) { y = yBot; if (vy > 0) vy *= -0.35; }
        if (y < yTop) { y = yTop; if (vy < 0) vy *= -0.35; }
        var target = Math.atan2(vy, vx);
        var turn = target - F[o + 4];
        while (turn > 3.141593) turn -= 6.283185;
        while (turn < -3.141593) turn += 6.283185;
        var yaw = F[o + 4] + turn * (1 - Math.exp(-7 * dt));
        F[o] = x;
        F[o + 1] = y;
        F[o + 2] = vx;
        F[o + 3] = vy;
        F[o + 4] = yaw;
      }
      var b;
      for (b = 0; b < BUBBLES; b++) {
        var q = b * 4;
        bub[q + 1] -= bub[q + 3] * dt;
        bub[q] += Math.sin(simTime + b) * 8 * dt;
        if (bub[q + 1] < cssH * 0.04) {
          bub[q + 1] = cssH * 0.82;
          bub[q] = (b * 97 + simTime * 13) % Math.max(1, cssW);
        }
      }
    }

    function sortOrder() {
      var i, j, v, s;
      for (i = 0; i < nFish; i++) order[i] = i;
      for (i = 1; i < nFish; i++) {
        v = order[i];
        s = F[v * STR + 6];
        j = i - 1;
        while (j >= 0 && F[order[j] * STR + 6] > s) {
          order[j + 1] = order[j];
          j--;
        }
        order[j + 1] = v;
      }
    }

    function draw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pixW, pixH);
      sortOrder();
      var i;
      for (i = 0; i < nFish; i++) {
        var id = order[i];
        var o = id * STR;
        var sc = F[o + 6];
        var yaw = F[o + 4] + Math.sin(simTime * 7.2 + F[o + 5] * 6.283185) * 0.16;
        var c = Math.cos(yaw);
        var s = Math.sin(yaw);
        var m = dpr * sc;
        ctx.setTransform(m * c, m * s, -m * s, m * c, dpr * F[o], dpr * F[o + 1]);
        ctx.drawImage(sprites[F[o + 7] | 0], -52, -24);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = "rgba(226, 255, 246, 0.38)";
      ctx.lineWidth = 1.25;
      var b;
      for (b = 0; b < BUBBLES; b++) {
        var q = b * 4;
        ctx.beginPath();
        ctx.arc(bub[q], bub[q + 1], bub[q + 2], 0, 6.283185);
        ctx.stroke();
      }
      if (steer > 0.08) {
        ctx.beginPath();
        ctx.arc(ptrX, ptrY, 16 + (1 - steer) * 14, 0, 6.283185);
        ctx.strokeStyle = "rgba(214, 255, 242, " + (0.28 + steer * 0.35) + ")";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    resize();
    placeFish();
    var warm;
    for (warm = 0; warm < 6; warm++) step(1 / 60);
    simTime = 0.4;
    draw();
    signalReady();

    function loop(now) {
      var dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      if (dt < 0) dt = 0;
      if (reduceMotion) dt *= 0.35;
      resize();
      simTime += dt;
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
      showFallback();
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
