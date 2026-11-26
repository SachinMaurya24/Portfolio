/* =========================================================================
   MODE 6: HELMHOLTZ CHLADNI NODAL EIGENMODES (PLATE IV)
   Spectral PDE (∇²u + k²u = 0) with real-time Marching Squares zero-contour
   extraction and resonant particles migrating along -∇|u|² to nodal loci.
   Interactive features:
   - Move pointer to detune modal phase & inject local acoustic perturbation
   - Click canvas to cycle harmonic eigenvalue pairs (n, m)
   - Shift+Click to scatter resonant particles with an acoustic impulse
   - Live (n, m) integer sliders synced with Plate IV controls
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold;
  const { state, pointer, rgba, getFocalCenter } = Manifold;

  const EIGEN_PRESETS = [
    { name: 'MODE (3, 5)', n: 3, m: 5, omega: 0.55 },
    { name: 'MODE (4, 7)', n: 4, m: 7, omega: 0.48 },
    { name: 'MODE (2, 6)', n: 2, m: 6, omega: 0.62 },
    { name: 'MODE (5, 8)', n: 5, m: 8, omega: 0.42 }
  ];

  const GRID_N = 44;
  const PARTICLE_COUNT = 380;
  let presetIndex = 0;
  let particles = [];
  const fieldGrid = new Float32Array((GRID_N + 1) * (GRID_N + 1));

  function seedParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        u: Math.random() * 2 - 1,
        v: Math.random() * 2 - 1,
        vx: 0,
        vy: 0
      });
    }
  }

  function applyPreset(idx, silent) {
    presetIndex = ((idx % EIGEN_PRESETS.length) + EIGEN_PRESETS.length) % EIGEN_PRESETS.length;
    const p = EIGEN_PRESETS[presetIndex];
    state.params.eigenN = p.n;
    state.params.eigenM = p.m;
    if (Manifold.ui && Manifold.ui.syncEigenSliders) {
      Manifold.ui.syncEigenSliders(p.n, p.m);
    }
    if (!silent) {
      Manifold.notify(`HELMHOLTZ EIGENMODE · MODE (${p.n}, ${p.m})`);
    }
  }

  function scatter() {
    for (let i = 0; i < particles.length; i++) {
      particles[i].vx += (Math.random() - 0.5) * 0.08;
      particles[i].vy += (Math.random() - 0.5) * 0.08;
    }
    Manifold.notify('ACOUSTIC IMPULSE · PARTICLES SCATTERED');
  }

  function init(silent) {
    seedParticles();
    if (!silent) {
      Manifold.notify(`EIGENMODE RESET · MODE (${state.params.eigenN}, ${state.params.eigenM})`);
    }
  }

  function handleClick(_x, _y, shiftKey) {
    if (shiftKey) {
      scatter();
    } else {
      applyPreset(presetIndex + 1, false);
    }
  }

  function evalChladni(u, v, n, m, c1, c2, ptrU, ptrV) {
    const pi = Math.PI;
    const base =
      c1 * Math.cos(n * pi * u) * Math.cos(m * pi * v) +
      c2 * Math.cos(m * pi * u) * Math.cos(n * pi * v);

    const du = u - ptrU;
    const dv = v - ptrV;
    const dist2 = du * du + dv * dv;
    const pulse = 0.28 * Math.exp(-dist2 * 14.0) * Math.cos(Math.sqrt(dist2) * 18.0);
    return base + pulse;
  }

  function lerpIso(valA, valB, level) {
    const denom = valB - valA;
    if (Math.abs(denom) < 1e-6) return 0.5;
    return Math.max(0, Math.min(1, (level - valA) / denom));
  }

  function drawIsoContours(ctx, cols, rows, left, top, cellSize, level) {
    ctx.beginPath();
    for (let j = 0; j < rows; j++) {
      const y0 = top + j * cellSize;
      const y1 = y0 + cellSize;
      const rowOff = j * (cols + 1);
      const nextOff = (j + 1) * (cols + 1);

      for (let i = 0; i < cols; i++) {
        const v00 = fieldGrid[rowOff + i];
        const v10 = fieldGrid[rowOff + i + 1];
        const v11 = fieldGrid[nextOff + i + 1];
        const v01 = fieldGrid[nextOff + i];

        let mask = 0;
        if (v00 > level) mask |= 8;
        if (v10 > level) mask |= 4;
        if (v11 > level) mask |= 2;
        if (v01 > level) mask |= 1;

        if (mask === 0 || mask === 15) continue;

        const x0 = left + i * cellSize;
        const x1 = x0 + cellSize;

        const topPt = () => [x0 + lerpIso(v00, v10, level) * cellSize, y0];
        const rightPt = () => [x1, y0 + lerpIso(v10, v11, level) * cellSize];
        const botPt = () => [x0 + lerpIso(v01, v11, level) * cellSize, y1];
        const leftPt = () => [x0, y0 + lerpIso(v00, v01, level) * cellSize];

        const seg = (a, b) => {
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        };

        switch (mask) {
          case 1: case 14: seg(leftPt(), botPt()); break;
          case 2: case 13: seg(botPt(), rightPt()); break;
          case 3: case 12: seg(leftPt(), rightPt()); break;
          case 4: case 11: seg(topPt(), rightPt()); break;
          case 5: seg(leftPt(), topPt()); seg(botPt(), rightPt()); break;
          case 6: case 9: seg(topPt(), botPt()); break;
          case 7: case 8: seg(leftPt(), topPt()); break;
          case 10: seg(leftPt(), botPt()); seg(topPt(), rightPt()); break;
        }
      }
    }
    ctx.stroke();
  }

  function render(ctx, alpha) {
    if (particles.length === 0) seedParticles();

    const w = state.width;
    const h = state.height;
    const ink = state.palette.inkRGB;
    const accent = state.palette.accentRGB;
    const { cx, cy } = getFocalCenter();

    const plateSize = Math.min(w * (w >= 1024 ? 0.44 : 0.76), h * 0.68);
    const half = plateSize * 0.5;
    const left = cx - half;
    const top = cy - half;
    const cellSize = plateSize / GRID_N;

    const n = state.params.eigenN || 3;
    const m = state.params.eigenM || 5;
    const omega = EIGEN_PRESETS[presetIndex].omega;
    const t = state.time * omega;

    // Pointer modulates superposition phase angle
    const ptrU = Math.max(-1.2, Math.min(1.2, (pointer.x - cx) / Math.max(1, half)));
    const ptrV = Math.max(-1.2, Math.min(1.2, (pointer.y - cy) / Math.max(1, half)));
    const c1 = Math.cos(t);
    const c2 = Math.sin(t + ptrU * 0.85);

    // 1. Sample Helmholtz Eigenmode on GRID_N x GRID_N
    for (let j = 0; j <= GRID_N; j++) {
      const v = (j / GRID_N) * 2 - 1;
      const rowOff = j * (GRID_N + 1);
      for (let i = 0; i <= GRID_N; i++) {
        const u = (i / GRID_N) * 2 - 1;
        fieldGrid[rowOff + i] = evalChladni(u, v, n, m, c1, c2, ptrU, ptrV);
      }
    }

    ctx.save();

    // 2. Subtle Membrane Drafting Frame & Boundary Ticks
    ctx.strokeStyle = rgba(ink, alpha * 0.14);
    ctx.lineWidth = 0.75;
    ctx.strokeRect(left, top, plateSize, plateSize);

    for (let k = 0; k <= 8; k++) {
      const pos = (k / 8) * plateSize;
      const tick = k % 2 === 0 ? 6 : 3;
      ctx.beginPath();
      ctx.moveTo(left + pos, top);
      ctx.lineTo(left + pos, top - tick);
      ctx.moveTo(left, top + pos);
      ctx.lineTo(left - tick, top + pos);
      ctx.stroke();
    }

    // 3. Secondary Iso-Amplitude Contours (u = ±0.42)
    ctx.strokeStyle = rgba(ink, alpha * 0.10);
    ctx.lineWidth = 0.65;
    drawIsoContours(ctx, GRID_N, GRID_N, left, top, cellSize, 0.42);
    drawIsoContours(ctx, GRID_N, GRID_N, left, top, cellSize, -0.42);

    // 4. Primary Nodal Zero-Set Contour (u = 0)
    ctx.strokeStyle = rgba(accent, alpha * 0.68);
    ctx.lineWidth = 1.25;
    drawIsoContours(ctx, GRID_N, GRID_N, left, top, cellSize, 0);

    // 5. Resonant Nodal Particles Migrating Along -∇|u|²
    const eps = 0.018;
    let nearNodeCount = 0;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const val = evalChladni(p.u, p.v, n, m, c1, c2, ptrU, ptrV);

      if (!state.paused) {
        const gx = (evalChladni(p.u + eps, p.v, n, m, c1, c2, ptrU, ptrV) - val) / eps;
        const gy = (evalChladni(p.u, p.v + eps, n, m, c1, c2, ptrU, ptrV) - val) / eps;

        const agitate = Math.abs(val) * 0.012;
        p.vx = p.vx * 0.80 - val * gx * 0.0022 + (Math.random() - 0.5) * agitate;
        p.vy = p.vy * 0.80 - val * gy * 0.0022 + (Math.random() - 0.5) * agitate;

        p.u += p.vx;
        p.v += p.vy;

        if (p.u < -1 || p.u > 1) { p.u = Math.max(-1, Math.min(1, p.u)); p.vx *= -0.5; }
        if (p.v < -1 || p.v > 1) { p.v = Math.max(-1, Math.min(1, p.v)); p.vy *= -0.5; }
      }

      const px = cx + p.u * half;
      const py = cy + p.v * half;
      const nearNode = Math.abs(val) < 0.16;
      if (nearNode) nearNodeCount++;
      ctx.fillStyle = nearNode
        ? rgba(ink, alpha * 0.82)
        : rgba(accent, alpha * 0.42);
      ctx.fillRect(px - 1.1, py - 1.1, 2.2, 2.2);
    }

    // 6. Telemetry & Monospace Spectral PDE Annotation
    const kSq = n * n + m * m;
    state.telemetry.eigenKSq = kSq;
    state.telemetry.eigenNodalPct = Math.round((nearNodeCount / PARTICLE_COUNT) * 100);
    state.telemetry.eigenCursorVal = evalChladni(
      Math.max(-1, Math.min(1, ptrU)),
      Math.max(-1, Math.min(1, ptrV)),
      n, m, c1, c2, ptrU, ptrV
    );

    ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillStyle = rgba(ink, alpha * 0.48);
    ctx.fillText(
      `∇²u + k²u = 0   ·   MODE (${n}, ${m})   ·   k²/π² = ${kSq}`,
      left,
      top + plateSize + 22
    );

    ctx.restore();
  }

  Manifold.fields.eigenmode = {
    init,
    reset: () => init(false),
    scatter,
    cyclePreset: () => applyPreset(presetIndex + 1, false),
    handleClick,
    render
  };
})(window);
