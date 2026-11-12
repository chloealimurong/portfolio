/*
  Animated background for the portfolio.
  - Home page: rain. Streaks fall, then land as rippling ellipses, and some ripples draw a spiral.
    The rain starts as a drizzle and builds the longer you stay.
  - Every other page: dashed lanes of rectangular blocks that stream across the screen like traffic.
  - To force a mode on a page, write <canvas id="rain-canvas" data-mode="rain"> or data-mode="blocks".
  Rain adapted from the sketch by u161812 (OpenProcessing 2939960), rewritten
  in plain canvas so no p5 dependency is needed. Credit the original in your footer.
*/
(function () {
  'use strict';

  var canvas = document.getElementById('rain-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // rain on the home page, blocks everywhere else
  var isHome = /(^|\/)(index\.html)?$/.test(window.location.pathname);
  var mode = canvas.getAttribute('data-mode') || (isHome ? 'rain' : 'blocks');

  // ---- rain ----
  var MAX_DROPS = 28;          // drops on screen once the rain is at full strength
  var START_DROPS = 2;         // drops on screen at the very start
  var RAMP_SECONDS = 90;       // how long it takes to build from a drizzle to full rain
  var START_GAP_MS = 900;      // time between new drops at the start
  var END_GAP_MS = 130;        // time between new drops at full strength
  var SPIRAL_CHANCE = 0.18;    // chance that a ripple also draws a spiral

  // ---- traffic lanes (every page except home) ----
  var MAX_LANES = 6;           // most dashed lanes on screen once things are at full strength
  var START_LANES = 3;         // lanes at the start
  var LANE_SPEED = [60, 260];  // pixels per second, slowest and fastest
  var LANE_ALPHA = [0.1, 0.28];
  var LANE_WIDTH = [5, 16];    // thickness of the blocks, in pixels

  var drops = [];
  var lanes = [];
  var width = 0;
  var height = 0;
  var small = false;
  var running = true;
  var activeMs = 0;            // time spent watching, not counting hidden tabs
  var lastT = 0;
  var spawnTimer = 0;
  var laneTimer = 0, nextLaneIn = 1500;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    small = width < 600;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------------- rain ----------------
  function makeDrop() {
    var ex = rand(0.2, 0.55) * Math.min(width, 900);
    return {
      x: rand(0.05, 0.95) * width,
      y: rand(0.15, 0.9) * height,
      ex: ex,
      ey: ex * 0.45,
      fall: Math.floor(rand(40, 70)),
      vanish: Math.floor(rand(50, 90)),
      weight: rand(2, 5),
      spiral: Math.random() < SPIRAL_CHANCE,
      turns: Math.floor(rand(2, 4)),
      life: 0
    };
  }

  function update(d) {
    d.life += 1;
    return d.life < d.fall + d.vanish;
  }

  function drawSpiral(d, p) {
    var steps = 90;
    var rx = d.ex * p * 0.5;
    var ry = d.ey * p * 0.5;
    ctx.beginPath();
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var a = t * d.turns * Math.PI * 2;
      var px = d.x + Math.cos(a) * rx * t;
      var py = d.y + Math.sin(a) * ry * t;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function draw(d) {
    if (d.life < d.fall) {
      // falling streak: ease in so it accelerates toward the surface
      var p0 = 1 - d.life / d.fall;
      var p1 = Math.pow(p0, 3);
      var p2 = Math.pow(p0 + (p0 * 3) / d.fall, 3);
      var drop = height * 0.9;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y - drop * p1);
      ctx.lineTo(d.x, d.y - drop * p2);
      ctx.stroke();
    } else {
      // landed: ellipse expands and fades
      var p3 = (d.life - d.fall) / d.vanish;
      var p4 = Math.pow(p3, 0.6);
      var alpha = 1 - p4;
      ctx.strokeStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
      ctx.lineWidth = Math.max(0.4, d.weight * alpha);
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, (d.ex * p4) / 2, (d.ey * p4) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      // a second, thinner ring trails the first
      if (p4 > 0.25) {
        ctx.lineWidth = Math.max(0.3, d.weight * alpha * 0.4);
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, (d.ex * p4 * 0.7) / 2, (d.ey * p4 * 0.7) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (d.spiral) {
        ctx.lineWidth = Math.max(0.3, alpha * 1.4);
        drawSpiral(d, p4);
      }
    }
  }

  // ---------------- lanes ----------------
  // a dashed line of rectangles that streams across the screen, like cars on a road.
  // each lane has its own mix of long and short blocks, gaps, speed and direction.
  function makeLane(instant) {
    var pattern = [];
    var n = 3 + Math.floor(Math.random() * 3);              // 3 to 5 blocks per repeat
    for (var i = 0; i < n; i++) {
      pattern.push(rand(30, 170));                          // a block
      pattern.push(rand(50, 220));                          // the gap after it
    }
    var total = pattern.reduce(function (a, b) { return a + b; }, 0);
    return {
      y: rand(0.06, 0.94) * height,
      w: rand(LANE_WIDTH[0], LANE_WIDTH[1]),
      v: (Math.random() < 0.5 ? 1 : -1) * rand(LANE_SPEED[0], LANE_SPEED[1]),
      a: rand(LANE_ALPHA[0], LANE_ALPHA[1]),
      pattern: pattern,
      total: total,
      offset: rand(0, total),
      fade: instant ? 1 : 0
    };
  }

  function drawLane(l) {
    var a = l.a * l.fade;
    var g = ctx.createLinearGradient(0, 0, width, 0);        // fade out toward both screen edges
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.12, 'rgba(255,255,255,' + a.toFixed(3) + ')');
    g.addColorStop(0.88, 'rgba(255,255,255,' + a.toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = l.w;
    ctx.lineCap = 'butt';
    ctx.setLineDash(l.pattern);
    ctx.lineDashOffset = l.offset;
    ctx.beginPath();
    ctx.moveTo(0, l.y);
    ctx.lineTo(width, l.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---------------- main loop ----------------
  function paintBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#0b4fd6');
    g.addColorStop(1, '#0a2a78');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function tick(now) {
    if (!running) return;
    var dt = Math.min(now - (lastT || now), 100);
    lastT = now;
    activeMs += dt;
    spawnTimer += dt;
    laneTimer += dt;

    // 0 to 1, eased so the build-up is gentle at first
    var k = Math.min(1, activeMs / (RAMP_SECONDS * 1000));
    k = k * k * (3 - 2 * k);
    var cap = Math.round(START_DROPS + (MAX_DROPS - START_DROPS) * k);
    var gap = START_GAP_MS + (END_GAP_MS - START_GAP_MS) * k;

    paintBackground();

    if (mode === 'blocks') {
      for (var i = 0; i < lanes.length; i++) {
        var l = lanes[i];
        l.fade = Math.min(1, l.fade + dt / 1500);
        l.offset = (l.offset - (l.v * dt) / 1000) % l.total;   // negative speed runs the other way
        if (l.offset < 0) l.offset += l.total;
        drawLane(l);
      }
      var laneCap = Math.round(START_LANES + (MAX_LANES - START_LANES) * k);
      if (small) laneCap = Math.max(2, Math.round(laneCap / 2));
      if (lanes.length < laneCap && laneTimer >= nextLaneIn) {
        lanes.push(makeLane(false));
        laneTimer = 0;
        nextLaneIn = rand(2500, 6000);
      }
    } else {
      drops = drops.filter(update);
      drops.forEach(draw);
      if (drops.length < cap && spawnTimer >= gap) {
        spawnTimer = 0;
        drops.push(makeDrop());
      }
    }

    requestAnimationFrame(tick);
  }

  function still() {
    // reduced motion: draw one calm frame, no animation
    paintBackground();
    var i, d;
    if (mode === 'blocks') {
      for (i = 0; i < 4; i++) drawLane(makeLane(true));
    } else {
      for (i = 0; i < 9; i++) {
        d = makeDrop();
        d.life = d.fall + Math.floor(d.vanish * rand(0.2, 0.6));
        draw(d);
      }
    }
  }

  window.addEventListener('resize', function () {
    resize();
    if (reduceMotion) still();
  });
  document.addEventListener('visibilitychange', function () {
    if (reduceMotion) return;
    running = !document.hidden;
    if (running) { lastT = 0; requestAnimationFrame(tick); }
  });

  resize();
  if (reduceMotion) {
    still();
  } else {
    // on block pages, start with a few lanes already running so the page isn't empty
    if (mode === 'blocks') for (var s0 = 0; s0 < START_LANES; s0++) lanes.push(makeLane(true));
    requestAnimationFrame(tick);
  }
})();