/*
  Rain background for the portfolio.
  Streaks fall, then land as rippling ellipses. Some ripples also draw a spiral.
  Adapted from the rain sketch by u161812 (OpenProcessing 2939960), rewritten
  in plain canvas so no p5 dependency is needed. Credit the original in your footer.
*/
(function () {
  'use strict';

  var canvas = document.getElementById('rain-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var MAX_DROPS = 28;
  var SPIRAL_CHANCE = 0.18;
  var drops = [];
  var width = 0;
  var height = 0;
  var frame = 0;
  var running = true;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

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

  function paintBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#0b4fd6');
    g.addColorStop(1, '#0a2a78');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  function tick() {
    if (!running) return;
    frame += 1;
    paintBackground();
    drops = drops.filter(update);
    drops.forEach(draw);
    if (drops.length < MAX_DROPS && frame % 8 === 0) drops.push(makeDrop());
    requestAnimationFrame(tick);
  }

  function still() {
    // reduced motion: draw one calm frame of rings, no animation
    paintBackground();
    for (var i = 0; i < 9; i++) {
      var d = makeDrop();
      d.life = d.fall + Math.floor(d.vanish * rand(0.2, 0.6));
      draw(d);
    }
  }

  window.addEventListener('resize', function () {
    resize();
    if (reduceMotion) still();
  });
  document.addEventListener('visibilitychange', function () {
    if (reduceMotion) return;
    running = !document.hidden;
    if (running) requestAnimationFrame(tick);
  });

  resize();
  if (reduceMotion) still(); else requestAnimationFrame(tick);
})();
