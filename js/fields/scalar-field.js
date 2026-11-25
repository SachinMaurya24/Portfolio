/* =========================================================================
   MODE 0: SCALAR POTENTIAL & GRADIENT FIELD (∇f) + MARCHING SQUARES
   Interactive features:
   - Click canvas to place persistent gravity wells (Shift+Click for peak)
   - Toggleable steepest-descent streamline tracers along -∇f
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold;
  const { state, pointer, rgba } = Manifold;

  const scalarData = {
    cols: 0,
    rows: 0,
    values: new Float32Array(0),
    wells: [], // { nx, ny, sign } normalized to viewport [0..1]
    tracers: []
  };

  const MAX_WELLS = 6;
  const TRACER_COUNT = 42;

  function initTracers() {
    scalarData.tracers.length = 0;
    for (let i = 0; i < TRACER_COUNT; i++) {
      scalarData.tracers.push(spawnTracer());
    }
  }

  function spawnTracer() {
    const isDesktop = state.width >= 1024;
    const x = isDesktop
      ? (Math.random() < 0.72 ? state.width * (0.38 + Math.random() * 0.60) : Math.random() * state.width)
      : Math.random() * state.width;
    const y = Math.random() * state.height;
    return {
      x,
      y,
      life: Math.floor(Math.random() * 90),
      maxLife: 110 + Math.floor(Math.random() * 80),
      trail: []
    };
  }

  function evalScalarPotential(px, py, t) {
    const w = state.width;
    const h = state.height;
    const scale = Math.min(w, h) * 0.5;
    const u = (px - w * 0.58) / scale;
    const v = (py - h * 0.50) / scale;

    // Smooth slowly drifting harmonic manifold
    const h1 = 0.62 * Math.sin(2.15 * u + 0.24 * t) * Math.cos(1.85 * v - 0.17 * t);
    const h2 = 0.44 * Math.cos(1.45 * u - 1.65 * v + 0.19 * t);

    // Two drifting Gaussian hills/basins
    const c1x = 0.42 * Math.cos(0.16 * t);
    const c1y = 0.34 * Math.sin(0.21 * t);
    const g1 = 0.68 * Math.exp(-((u - c1x) * (u - c1x) + (v - c1y) * (v - c1y)) / 0.42);

    const c2x = -0.58 + 0.28 * Math.sin(0.14 * t);
    const c2y = -0.25 + 0.30 * Math.cos(0.18 * t);
    const g2 = -0.58 * Math.exp(-((u - c2x) * (u - c2x) + (v - c2y) * (v - c2y)) / 0.48);

    // Live cursor gravitational perturbation: -M / sqrt(r^2 + eps^2)
    const du = (px - pointer.x) / scale;
    const dv = (py - pointer.y) / scale;
    const r2 = du * du + dv * dv;
    let totalWell = -state.params.scalarWellStrength / Math.sqrt(r2 + 0.022);

    // User-placed persistent singularities (wells & peaks)
    for (let i = 0; i < scalarData.wells.length; i++) {
      const well = scalarData.wells[i];
      const wu = (px - well.nx * w) / scale;
      const wv = (py - well.ny * h) / scale;
      const wr2 = wu * wu + wv * wv;
      totalWell += (well.sign * 0.36) / Math.sqrt(wr2 + 0.024);
    }

    return h1 + h2 + g1 + g2 + totalWell;
  }

  function evalGradient(px, py, t) {
    const eps = 3.0;
    const fx1 = evalScalarPotential(px + eps, py, t);
    const fx0 = evalScalarPotential(px - eps, py, t);
    const fy1 = evalScalarPotential(px, py + eps, t);
    const fy0 = evalScalarPotential(px, py - eps, t);
    return {
      gx: (fx1 - fx0) / (2 * eps),
      gy: (fy1 - fy0) / (2 * eps)
    };
  }

  function handleClick(x, y, shiftKey) {
    const nx = x / state.width;
    const ny = y / state.height;

    // Clicking near an existing well removes it
    for (let i = 0; i < scalarData.wells.length; i++) {
      const w = scalarData.wells[i];
      if (Math.hypot(w.nx * state.width - x, w.ny * state.height - y) < 22) {
        scalarData.wells.splice(i, 1);
        state.telemetry.scalarWellsCount = scalarData.wells.length;
        Manifold.notify('SINGULARITY REMOVED');
        return;
      }
    }

    if (scalarData.wells.length >= MAX_WELLS) {
      scalarData.wells.shift();
    }
    const sign = shiftKey ? 1 : -1;
    scalarData.wells.push({ nx, ny, sign });
    state.telemetry.scalarWellsCount = scalarData.wells.length;
    Manifold.notify(shiftKey ? 'POTENTIAL PEAK PLACED (+M)' : 'GRAVITY WELL PLACED (-M)');
  }

  function clearWells() {
    scalarData.wells.length = 0;
    state.telemetry.scalarWellsCount = 0;
    Manifold.notify('FIELD SINGULARITIES CLEARED');
  }

  function render(ctx, alpha) {
    if (scalarData.tracers.length === 0) initTracers();

    const w = state.width;
    const h = state.height;
    const cs = w < 640 ? 26 : 22;
    const cols = Math.ceil(w / cs) + 1;
    const rows = Math.ceil(h / cs) + 1;
    const total = cols * rows;

    if (scalarData.values.length !== total) {
      scalarData.values = new Float32Array(total);
    }
    scalarData.cols = cols;
    scalarData.rows = rows;

    const vals = scalarData.values;
    const t = state.time;

    for (let j = 0; j < rows; j++) {
      const py = j * cs;
      const rowOff = j * cols;
      for (let i = 0; i < cols; i++) {
        vals[rowOff + i] = evalScalarPotential(i * cs, py, t);
      }
    }

    // 1. Marching Squares Iso-Contour Extraction
    const levels = 15;
    const minL = -2.25;
    const maxL = 1.45;
    const stepL = (maxL - minL) / (levels - 1);
    const ink = state.palette.inkRGB;
    const accent = state.palette.accentRGB;

    const lerpPt = (v1, v2, level) => {
      const denom = v2 - v1;
      if (Math.abs(denom) < 1e-6) return 0.5;
      return (level - v1) / denom;
    };

    for (let lv = 0; lv < levels; lv++) {
      const level = minL + lv * stepL;
      const isIndexContour = (lv % 4 === 0);
      const isDeepWellContour = (lv <= 2);

      ctx.beginPath();
      for (let j = 0; j < rows - 1; j++) {
        const y0 = j * cs;
        const y1 = y0 + cs;
        const r0 = j * cols;
        const r1 = r0 + cols;

        for (let i = 0; i < cols - 1; i++) {
          const v0 = vals[r0 + i];
          const v1 = vals[r0 + i + 1];
          const v2 = vals[r1 + i + 1];
          const v3 = vals[r1 + i];

          let mask = 0;
          if (v0 >= level) mask |= 8;
          if (v1 >= level) mask |= 4;
          if (v2 >= level) mask |= 2;
          if (v3 >= level) mask |= 1;

          if (mask === 0 || mask === 15) continue;

          const x0 = i * cs;
          const x1 = x0 + cs;

          const topX = x0 + lerpPt(v0, v1, level) * cs;
          const rightY = y0 + lerpPt(v1, v2, level) * cs;
          const botX = x0 + lerpPt(v3, v2, level) * cs;
          const leftY = y0 + lerpPt(v0, v3, level) * cs;

          switch (mask) {
            case 1: case 14:
              ctx.moveTo(x0, leftY); ctx.lineTo(botX, y1); break;
            case 2: case 13:
              ctx.moveTo(botX, y1); ctx.lineTo(x1, rightY); break;
            case 3: case 12:
              ctx.moveTo(x0, leftY); ctx.lineTo(x1, rightY); break;
            case 4: case 11:
              ctx.moveTo(topX, y0); ctx.lineTo(x1, rightY); break;
            case 5:
              ctx.moveTo(x0, leftY); ctx.lineTo(topX, y0);
              ctx.moveTo(botX, y1); ctx.lineTo(x1, rightY); break;
            case 6: case 9:
              ctx.moveTo(topX, y0); ctx.lineTo(botX, y1); break;
            case 7: case 8:
              ctx.moveTo(x0, leftY); ctx.lineTo(topX, y0); break;
            case 10:
              ctx.moveTo(x0, leftY); ctx.lineTo(botX, y1);
              ctx.moveTo(topX, y0); ctx.lineTo(x1, rightY); break;
          }
        }
      }

      if (isDeepWellContour) {
        ctx.strokeStyle = rgba(accent, alpha * 0.44);
        ctx.lineWidth = 0.9;
      } else if (isIndexContour) {
        ctx.strokeStyle = rgba(ink, alpha * 0.28);
        ctx.lineWidth = 1.05;
      } else {
        ctx.strokeStyle = rgba(ink, alpha * 0.12);
        ctx.lineWidth = 0.65;
      }
      ctx.stroke();
    }

    // 2. Orderly Sparse Lattice of Gradient Flow Vectors (-∇f)
    const vStep = w < 640 ? 70 : 62;
    ctx.lineWidth = 0.8;

    for (let y = vStep * 0.6; y < h; y += vStep) {
      for (let x = vStep * 0.6; x < w; x += vStep) {
        const { gx, gy } = evalGradient(x, y, t);
        const mag = Math.hypot(gx, gy);
        if (mag < 1e-5) continue;

        const dx = -gx / mag;
        const dy = -gy / mag;
        const len = Math.min(20, 4.5 + Math.log1p(mag * 420) * 6.2);
        const ex = x + dx * len;
        const ey = y + dy * len;

        const wellProximity = Math.min(1, mag * 140);
        const col = wellProximity > 0.58 ? accent : ink;
        const vAlpha = alpha * (0.14 + wellProximity * 0.34);

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        const ah = 3.2;
        ctx.moveTo(ex - dx * ah - dy * (ah * 0.55), ey - dy * ah + dx * (ah * 0.55));
        ctx.lineTo(ex, ey);
        ctx.lineTo(ex - dx * ah + dy * (ah * 0.55), ey - dy * ah - dx * (ah * 0.55));
        ctx.strokeStyle = rgba(col, vAlpha);
        ctx.stroke();
      }
    }

    // 3. Steepest-Descent Streamline Tracers (-∇f particles)
    if (state.params.scalarStreamlines) {
      for (let i = 0; i < scalarData.tracers.length; i++) {
        const tr = scalarData.tracers[i];
        if (!state.paused) {
          const { gx, gy } = evalGradient(tr.x, tr.y, t);
          const mag = Math.hypot(gx, gy);
          if (mag > 1e-5) {
            const step = Math.min(3.4, 0.9 + mag * 140);
            tr.x -= (gx / mag) * step;
            tr.y -= (gy / mag) * step;
          }
          tr.trail.push({ x: tr.x, y: tr.y });
          if (tr.trail.length > 16) tr.trail.shift();
          tr.life++;

          if (
            tr.life > tr.maxLife ||
            tr.x < -10 || tr.x > w + 10 ||
            tr.y < -10 || tr.y > h + 10 ||
            mag < 0.00025
          ) {
            scalarData.tracers[i] = spawnTracer();
            continue;
          }
        }

        if (tr.trail.length > 1) {
          const fade = Math.sin((tr.life / tr.maxLife) * Math.PI);
          ctx.beginPath();
          ctx.moveTo(tr.trail[0].x, tr.trail[0].y);
          for (let k = 1; k < tr.trail.length; k++) {
            ctx.lineTo(tr.trail[k].x, tr.trail[k].y);
          }
          ctx.strokeStyle = rgba(accent, alpha * 0.36 * fade);
          ctx.lineWidth = 0.85;
          ctx.stroke();
        }
      }
    }

    // 4. Render User-Placed Singularities (Wells & Peaks)
    ctx.font = '9px "IBM Plex Mono", monospace';
    for (let i = 0; i < scalarData.wells.length; i++) {
      const well = scalarData.wells[i];
      const wx = well.nx * w;
      const wy = well.ny * h;
      const col = well.sign < 0 ? accent : ink;

      ctx.strokeStyle = rgba(col, alpha * 0.72);
      ctx.lineWidth = 0.9;
      ctx.strokeRect(wx - 5, wy - 5, 10, 10);
      ctx.fillStyle = rgba(col, alpha * 0.75);
      ctx.fillText(well.sign < 0 ? `-M${i + 1}` : `+M${i + 1}`, wx + 8, wy - 4);
    }

    // 5. Crosshair reticle at pointer gravitational well
    ctx.strokeStyle = rgba(accent, alpha * 0.45);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(pointer.x - 8, pointer.y);
    ctx.lineTo(pointer.x + 8, pointer.y);
    ctx.moveTo(pointer.x, pointer.y - 8);
    ctx.lineTo(pointer.x, pointer.y + 8);
    ctx.stroke();
  }

  Manifold.fields.scalar = {
    evalScalarPotential,
    evalGradient,
    handleClick,
    clearWells,
    reset: clearWells,
    render
  };
})(window);
