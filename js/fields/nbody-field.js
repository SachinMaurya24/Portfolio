/* =========================================================================
   MODE 1: BARNES-HUT N-BODY ORBITAL FIELD (REAL RECURSIVE QUADTREE)
   Interactive features:
   - Click canvas to inject new orbiting star (Shift+Click for massive core)
   - Live Δt (time step) & θ (opening angle) sliders
   - Toggleable recursive quadtree spatial subdivision grid & merger reset
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold;
  const { state, pointer, rgba, getFocalCenter } = Manifold;

  const INITIAL_NBODY_COUNT = 144;
  const MAX_NBODY_COUNT = 240;
  const bodies = [];
  let lastQuadNodeCount = 0;

  function init() {
    bodies.length = 0;
    const { cx, cy } = getFocalCenter();
    const spread = Math.min(state.width, state.height) * 0.24;

    const clusters = [
      { x: cx - spread * 0.62, y: cy - spread * 0.24, vx: 0.42, vy: 0.30, spin: 1 },
      { x: cx + spread * 0.58, y: cy + spread * 0.26, vx: -0.42, vy: -0.30, spin: -1 }
    ];

    for (let i = 0; i < INITIAL_NBODY_COUNT; i++) {
      const cl = clusters[i < INITIAL_NBODY_COUNT / 2 ? 0 : 1];
      const isCore = (i % (INITIAL_NBODY_COUNT / 2) === 0);
      const angle = Math.random() * Math.PI * 2;
      const r = isCore ? 0 : (14 + Math.pow(Math.random(), 0.72) * spread * 0.82);
      const x = cl.x + Math.cos(angle) * r;
      const y = cl.y + Math.sin(angle) * r;

      const orbitalSpeed = isCore ? 0 : Math.sqrt(185 / (r + 18));
      const tx = -Math.sin(angle) * cl.spin * orbitalSpeed;
      const ty = Math.cos(angle) * cl.spin * orbitalSpeed;

      bodies.push({
        x,
        y,
        vx: cl.vx + tx,
        vy: cl.vy + ty,
        mass: isCore ? 14.0 : (0.8 + Math.random() * 1.1),
        isCore,
        trail: []
      });
    }
    state.telemetry.nbodyCount = bodies.length;
  }

  function handleClick(x, y, shiftKey) {
    const { cx, cy } = getFocalCenter();
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.max(16, Math.hypot(dx, dy));
    const speed = Math.sqrt(195 / (r + 16));
    const tx = (-dy / r) * speed;
    const ty = (dx / r) * speed;

    if (bodies.length >= MAX_NBODY_COUNT) {
      // Replace oldest non-core star
      const idx = bodies.findIndex((b) => !b.isCore);
      if (idx !== -1) bodies.splice(idx, 1);
    }

    bodies.push({
      x,
      y,
      vx: tx,
      vy: ty,
      mass: shiftKey ? 12.0 : 1.4,
      isCore: Boolean(shiftKey),
      trail: []
    });

    state.telemetry.nbodyCount = bodies.length;
    Manifold.notify(shiftKey ? 'MASSIVE CORE INJECTED' : `STAR INJECTED (N = ${bodies.length})`);
  }

  class QuadNode {
    constructor(x, y, size) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.mass = 0;
      this.cx = 0;
      this.cy = 0;
      this.body = null;
      this.children = null;
    }

    insert(b, depth = 0) {
      if (depth > 9) {
        const totalM = this.mass + b.mass;
        this.cx = (this.cx * this.mass + b.x * b.mass) / totalM;
        this.cy = (this.cy * this.mass + b.y * b.mass) / totalM;
        this.mass = totalM;
        return;
      }

      if (this.mass === 0 && !this.children) {
        this.body = b;
        this.mass = b.mass;
        this.cx = b.x;
        this.cy = b.y;
        return;
      }

      if (!this.children) {
        this.subdivide();
        const existing = this.body;
        this.body = null;
        if (existing) this.placeInChild(existing, depth + 1);
      }

      this.placeInChild(b, depth + 1);

      const totalM = this.mass + b.mass;
      this.cx = (this.cx * this.mass + b.x * b.mass) / totalM;
      this.cy = (this.cy * this.mass + b.y * b.mass) / totalM;
      this.mass = totalM;
    }

    subdivide() {
      const hs = this.size * 0.5;
      this.children = [
        new QuadNode(this.x, this.y, hs),
        new QuadNode(this.x + hs, this.y, hs),
        new QuadNode(this.x, this.y + hs, hs),
        new QuadNode(this.x + hs, this.y + hs, hs)
      ];
      lastQuadNodeCount += 4;
    }

    placeInChild(b, depth) {
      const midX = this.x + this.size * 0.5;
      const midY = this.y + this.size * 0.5;
      const idx = (b.x >= midX ? 1 : 0) + (b.y >= midY ? 2 : 0);
      this.children[idx].insert(b, depth);
    }

    computeForce(b, theta, G, softening2) {
      if (this.mass === 0 || this.body === b) return { fx: 0, fy: 0 };

      const dx = this.cx - b.x;
      const dy = this.cy - b.y;
      const dist2 = dx * dx + dy * dy + softening2;
      const dist = Math.sqrt(dist2);

      if (!this.children || (this.size / dist) < theta) {
        const f = (G * this.mass) / (dist2 * dist);
        return { fx: dx * f, fy: dy * f };
      }

      let fx = 0, fy = 0;
      for (let i = 0; i < 4; i++) {
        const res = this.children[i].computeForce(b, theta, G, softening2);
        fx += res.fx;
        fy += res.fy;
      }
      return { fx, fy };
    }
  }

  function drawQuadtree(ctx, node, depth, alpha, inkRGB) {
    if (!node || node.mass === 0) return;
    const opacity = alpha * Math.max(0.035, 0.14 - depth * 0.015);
    ctx.strokeStyle = rgba(inkRGB, opacity);
    ctx.lineWidth = 0.6;
    ctx.strokeRect(node.x, node.y, node.size, node.size);

    if (node.children && depth < 6) {
      for (let i = 0; i < 4; i++) {
        drawQuadtree(ctx, node.children[i], depth + 1, alpha, inkRGB);
      }
    }
  }

  function render(ctx, alpha) {
    if (bodies.length === 0) init();

    const { cx, cy } = getFocalCenter();
    const maxSpan = Math.max(state.width, state.height) * 1.15;
    const root = new QuadNode(cx - maxSpan * 0.5, cy - maxSpan * 0.5, maxSpan);
    lastQuadNodeCount = 1;

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (
        b.x >= root.x && b.x <= root.x + root.size &&
        b.y >= root.y && b.y <= root.y + root.size
      ) {
        root.insert(b, 0);
      }
    }
    state.telemetry.nbodyQuadNodes = lastQuadNodeCount;
    state.telemetry.nbodyCount = bodies.length;
    if (state.frame % 10 === 0) {
      Manifold.pushHistory(state.telemetry.nbodyNodesHistory, lastQuadNodeCount, 48);
    }

    if (!state.paused) {
      const dt = 0.34 * state.params.nbodyDt;
      const G = 24.0;
      const theta = state.params.nbodyTheta;
      const softening2 = 340;

      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        const force = root.computeForce(b, theta, G, softening2);

        const bx = cx - b.x;
        const by = cy - b.y;
        const distCenter = Math.hypot(bx, by);
        const maxR = Math.min(state.width, state.height) * 0.42;
        const pull = distCenter > maxR ? 0.00055 * (distCenter - maxR) : 0.00008;

        const px = pointer.x - b.x;
        const py = pointer.y - b.y;
        const pDist2 = px * px + py * py + 1400;
        const pForce = 680 / (pDist2 * Math.sqrt(pDist2));

        b.vx = (b.vx + (force.fx + bx * pull + px * pForce) * dt) * 0.9994;
        b.vy = (b.vy + (force.fy + by * pull + py * pForce) * dt) * 0.9994;
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (state.frame % 2 === 0) {
          b.trail.push({ x: b.x, y: b.y });
          if (b.trail.length > 14) b.trail.shift();
        }
      }
    }

    const ink = state.palette.inkRGB;
    const accent = state.palette.accentRGB;

    if (state.params.nbodyShowQuadtree) {
      drawQuadtree(ctx, root, 0, alpha, ink);
    }

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(b.trail[0].x, b.trail[0].y);
        for (let k = 1; k < b.trail.length; k++) {
          ctx.lineTo(b.trail[k].x, b.trail[k].y);
        }
        ctx.strokeStyle = rgba(b.isCore ? accent : ink, alpha * (b.isCore ? 0.58 : 0.18));
        ctx.lineWidth = b.isCore ? 1.1 : 0.65;
        ctx.stroke();
      }

      ctx.fillStyle = rgba(b.isCore ? accent : ink, alpha * (b.isCore ? 0.94 : 0.68));
      const sz = b.isCore ? 4.4 : (1.5 + b.mass * 0.5);
      ctx.fillRect(b.x - sz * 0.5, b.y - sz * 0.5, sz, sz);
    }

    // Cursor gravitational perturber reticle
    ctx.strokeStyle = rgba(accent, alpha * 0.45);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  Manifold.fields.nbody = {
    init,
    reset: () => {
      init();
      Manifold.notify('GALAXY MERGER RESET');
    },
    handleClick,
    render
  };
})(window);
