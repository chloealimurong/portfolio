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
  var SPIRAL_CHANCE = 0;       // chance that a ripple also draws a spiral (0 = off)
  var RINGS = 6;               // concentric rings per ripple

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
    bakeSky();
  }

  // ---------------- rain ----------------
  function makeDrop() {
    var ex = rand(0.2, 0.55) * Math.min(width, 900);
    return {
      x: rand(0.05, 0.95) * width,
      y: rand(0.15, 0.9) * height,
      ex: ex,
      ey: ex * 0.94,
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
      var hy = d.y - drop * p1, ty = d.y - drop * p2 - 26;   // head (lower) and tail (higher)
      // streak: fades in from the tail, blue edge so it shows on the light sky, white core
      var sg = ctx.createLinearGradient(0, ty, 0, hy);
      sg.addColorStop(0, 'rgba(40,110,190,0)');
      sg.addColorStop(1, 'rgba(40,110,190,0.45)');
      ctx.strokeStyle = sg; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(d.x, ty); ctx.lineTo(d.x, hy); ctx.stroke();
      var wg = ctx.createLinearGradient(0, ty, 0, hy);
      wg.addColorStop(0, 'rgba(255,255,255,0)');
      wg.addColorStop(1, 'rgba(255,255,255,0.95)');
      ctx.strokeStyle = wg; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(d.x, ty); ctx.lineTo(d.x, hy); ctx.stroke();
      ctx.lineCap = 'butt';
    } else {
      // landed: a water ripple spreads across the glass and fades
      var p3 = (d.life - d.fall) / d.vanish;
      var p4 = Math.pow(p3, 0.6);
      var a = 1 - p4;
      var rx = (d.ex * p4) / 2, ry = (d.ey * p4) / 2;
      if (rx < 1) return;

      // soft lens: the water bulges and catches light toward the bottom
      var lens = ctx.createRadialGradient(d.x, d.y + ry * 0.35, 0, d.x, d.y, rx);
      lens.addColorStop(0, 'rgba(255,255,255,' + (0.16 * a).toFixed(3) + ')');
      lens.addColorStop(0.7, 'rgba(255,255,255,' + (0.05 * a).toFixed(3) + ')');
      lens.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lens;
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // concentric rings, fainter and thinner toward the center
      for (var k = 0; k < RINGS; k++) {
        var f = 1 - k / RINGS, lw = Math.max(0.5, d.weight * 0.7 * f * a);
        // a thin blue line just outside each ring, so the white rings read against the light sky
        ctx.strokeStyle = 'rgba(40,110,190,' + (a * 0.16 * f).toFixed(3) + ')';
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, rx * f + lw, ry * f + lw, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,' + (a * (0.35 + 0.6 * f)).toFixed(3) + ')';
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, rx * f, ry * f, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // bright crescent along the bottom of the outer ring
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.9 * a).toFixed(3) + ')';
      ctx.lineWidth = Math.max(0.6, d.weight * 1.4 * a);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, rx * 0.97, ry * 0.97, 0, Math.PI * 0.12, Math.PI * 0.88);
      ctx.stroke();

      // a faint blue shadow along the top edge gives the ring depth
      ctx.strokeStyle = 'rgba(30,96,180,' + (0.32 * a).toFixed(3) + ')';
      ctx.lineWidth = Math.max(0.4, d.weight * 0.7 * a);
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, rx * 1.02, ry * 1.02, 0, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.lineCap = 'butt';

      // small specular glint near the top left
      ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * a).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(d.x - rx * 0.38, d.y - ry * 0.42, rx * 0.07, ry * 0.035, -0.6, 0, Math.PI * 2);
      ctx.fill();

      if (d.spiral) {
        ctx.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        ctx.lineWidth = Math.max(0.3, a * 1.4);
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
  // The sky, clouds and glass "screen" don't move, so they are painted once per resize
  // onto an offscreen canvas and copied in each frame.
  var sky = document.createElement('canvas'), skyCtx = sky.getContext('2d');
  function bakeSky() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    sky.width = width * dpr; sky.height = height * dpr;
    var c = skyCtx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // baby-blue sky
    var g = c.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#dcefff');
    g.addColorStop(0.55, '#b3dbf8');
    g.addColorStop(1, '#93c7f1');
    c.fillStyle = g;
    c.fillRect(0, 0, width, height);
    // clouds made of same-size dots, kept mostly toward the edges so the middle stays calm
    var DOT_R = small ? 2 : 2.6;          // every dot in every cloud is this radius
    var DOT_GAP = DOT_R * 3.2;            // spacing of the dot grid
    var clouds = small ? 4 : 7;
    c.fillStyle = 'rgba(255,255,255,0.75)';
    for (var i = 0; i < clouds; i++) {
      var side = Math.random() < 0.5;
      var cx = side ? rand(-0.05, 0.3) * width : rand(0.7, 1.05) * width;
      var cy = rand(0.05, 0.95) * height;
      var size = rand(60, 160) * (small ? 0.6 : 1);
      // a cloud is a few overlapping round "puffs"; a dot is drawn wherever it falls inside one
      var puffs = [];
      for (var j = 0; j < 6; j++) {
        puffs.push({ x: cx + rand(-1.2, 1.2) * size, y: cy + rand(-0.35, 0.35) * size, r: size * rand(0.4, 0.75) });
      }
      var x0 = cx - 2.2 * size, x1 = cx + 2.2 * size, y0 = cy - 1.3 * size, y1 = cy + 1.3 * size;
      for (var y = Math.floor(y0 / DOT_GAP) * DOT_GAP; y < y1; y += DOT_GAP) {
        for (var x = Math.floor(x0 / DOT_GAP) * DOT_GAP; x < x1; x += DOT_GAP) {
          // how deep inside the cloud this point is: 1 at a puff's center, 0 at its edge
          var depth = 0;
          for (var k = 0; k < puffs.length; k++) {
            var pf = puffs[k], dd = Math.hypot(x - pf.x, y - pf.y) / pf.r;
            if (dd < 1) depth = Math.max(depth, 1 - dd);
          }
          // solid in the middle, thinning out toward the edges
          if (depth > 0 && Math.random() < Math.min(1, depth * 2.5)) {
            c.beginPath(); c.arc(x, y, DOT_R, 0, Math.PI * 2); c.fill();
          }
        }
      }
    }
    // the glass screen: a diagonal sheen...
    var sheen = c.createLinearGradient(0, 0, width, height);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.35, 'rgba(255,255,255,0.14)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0.02)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sheen;
    c.fillRect(0, 0, width, height);
    // ...and white, misty edges
    var vg = c.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.hypot(width, height) * 0.62);
    vg.addColorStop(0, 'rgba(255,255,255,0)');
    vg.addColorStop(1, 'rgba(255,255,255,0.7)');
    c.fillStyle = vg;
    c.fillRect(0, 0, width, height);
  }
  function paintBackground() {
    ctx.drawImage(sky, 0, 0, width, height);
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