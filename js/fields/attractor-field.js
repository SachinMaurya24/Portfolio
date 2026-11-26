/* =========================================================================
   MODE 5: 3D STRANGE ATTRACTORS & PHASE-SPACE MANIFOLD (PLATE III)
   Real-time RK4 integration of chaotic dynamical systems with dual
   epsilon-perturbed trajectories demonstrating Lyapunov divergence.
   Interactive features:
   - Move pointer to orbit 3D phase-space camera (yaw / pitch)
   - Click canvas to cycle Strange Attractor (Lorenz, Aizawa, Thomas, Halvorsen)
   - Shift+Click to re-seed an epsilon-perturbed twin pair (delta_0 = 1e-3)
   - Live Rayleigh parameter ρ & integration speed controls
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold;
  const { state, pointer, rgba, getFocalCenter } = Manifold;

  const ATTRACTORS = [
    {
      name: 'LORENZ-63',
      eq: 'dx/dt = σ(y−x), dy/dt = x(ρ−z)−y, dz/dt = xy−βz',
      dt: 0.0065,
      stepsPerFrame: 3,
      scale: 6.2,
      center: [0, 0, 25],
      init: [1.1, 1.2, 20.0],
      deriv(x, y, z, rhoParam) {
        const sigma = 10;
        const rho = rhoParam || 28;
        const beta = 8 / 3;
        return [
          sigma * (y - x),
          x * (rho - z) - y,
          x * y - beta * z
        ];
      }
    },
    {
      name: 'AIZAWA TORUS',
      eq: 'dz/dt = c + az − z³/3 − (x²+y²)(1+ez) + fzx³',
      dt: 0.012,
      stepsPerFrame: 3,
      scale: 92,
      center: [0, 0, 0.7],
      init: [0.1, 0.0, 0.0],
      deriv(x, y, z) {
        const a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1;
        const r2 = x * x + y * y;
        return [
          (z - b) * x - d * y,
          d * x + (z - b) * y,
          c + a * z - (z * z * z) / 3 - r2 * (1 + e * z) + f * z * x * x * x
        ];
      }
    },
    {
      name: 'THOMAS CYCLIC',
      eq: 'dx/dt = sin(y)−bx, dy/dt = sin(z)−by, dz/dt = sin(x)−bz',
      dt: 0.055,
      stepsPerFrame: 3,
      scale: 48,
      center: [0, 0, 0],
      init: [1.1, 1.1, -0.01],
      deriv(x, y, z) {
        const b = 0.19;
        return [
          Math.sin(y) - b * x,
          Math.sin(z) - b * y,
          Math.sin(x) - b * z
        ];
      }
    },
    {
      name: 'HALVORSEN',
      eq: 'dx/dt = −ax − 4y − 4z − y²   (a = 1.4)',
      dt: 0.0045,
      stepsPerFrame: 3,
      scale: 16.5,
      center: [0, 0, 0],
      init: [-1.48, -1.51, 2.04],
      deriv(x, y, z) {
        const a = 1.4;
        return [
          -a * x - 4 * y - 4 * z - y * y,
          -a * y - 4 * z - 4 * x - z * z,
          -a * z - 4 * x - 4 * y - x * x
        ];
      }
    }
  ];

  const MAX_TRAIL = 520;
  const EPSILON_0 = 1e-3;
  let presetIndex = 0;
  let primary = { x: 0, y: 0, z: 0 };
  let shadow = { x: 0, y: 0, z: 0 };
  let primaryTrail = [];
  let shadowTrail = [];
  let integratedTime = 0;
  let yaw = 0.6;
  let pitch = 0.35;

  function rk4Step(p, dt, deriv, rhoParam) {
    const k1 = deriv(p.x, p.y, p.z, rhoParam);
    const k2 = deriv(p.x + 0.5 * dt * k1[0], p.y + 0.5 * dt * k1[1], p.z + 0.5 * dt * k1[2], rhoParam);
    const k3 = deriv(p.x + 0.5 * dt * k2[0], p.y + 0.5 * dt * k2[1], p.z + 0.5 * dt * k2[2], rhoParam);
    const k4 = deriv(p.x + dt * k3[0], p.y + dt * k3[1], p.z + dt * k3[2], rhoParam);

    p.x += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    p.y += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    p.z += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
  }

  function seedPair(silent) {
    const att = ATTRACTORS[presetIndex];
    const rhoParam = state.params.attractorRho || 28.0;
    const jitter = silent ? 0 : (Math.random() - 0.5) * 0.25;
    primary = {
      x: att.init[0] + jitter,
      y: att.init[1] - jitter,
      z: att.init[2]
    };
    shadow = {
      x: primary.x + EPSILON_0,
      y: primary.y,
      z: primary.z
    };
    primaryTrail = [];
    shadowTrail = [];
    integratedTime = 0;
    state.telemetry.attractorLyapHistory = [];
    state.telemetry.attractorName = att.name;
    state.params.attractorPreset = presetIndex;

    // Warm-up 180 steps so the manifold is immediately rich on first view
    for (let i = 0; i < 180; i++) {
      rk4Step(primary, att.dt, att.deriv, rhoParam);
      rk4Step(shadow, att.dt, att.deriv, rhoParam);
      integratedTime += att.dt;
      if (i % 2 === 0) {
        primaryTrail.push({ x: primary.x, y: primary.y, z: primary.z });
        shadowTrail.push({ x: shadow.x, y: shadow.y, z: shadow.z });
      }
    }
  }

  function setPreset(idx, silent) {
    presetIndex = ((idx % ATTRACTORS.length) + ATTRACTORS.length) % ATTRACTORS.length;
    seedPair(true);
    if (!silent) {
      Manifold.notify(`ATTRACTOR · ${ATTRACTORS[presetIndex].name}`);
    }
    if (Manifold.ui && Manifold.ui.syncAttractorPills) {
      Manifold.ui.syncAttractorPills(presetIndex);
    }
  }

  function init(silent) {
    seedPair(silent);
    if (!silent) {
      Manifold.notify(`ATTRACTOR RESET · ${ATTRACTORS[presetIndex].name}`);
    }
  }

  function handleClick(_x, _y, shiftKey) {
    if (shiftKey) {
      seedPair(false);
      Manifold.notify('PERTURBED PAIR RE-SEEDED · δ₀ = 10⁻³');
    } else {
      setPreset(presetIndex + 1, false);
    }
  }

  function project3D(pt, att, cx, cy, baseScale, cosY, sinY, cosP, sinP) {
    const vx = (pt.x - att.center[0]) * att.scale * baseScale;
    const vy = (pt.y - att.center[1]) * att.scale * baseScale;
    const vz = (pt.z - att.center[2]) * att.scale * baseScale;

    const x1 = vx * cosY - vy * sinY;
    const y1 = vx * sinY + vy * cosY;
    const z1 = vz;

    const y2 = y1 * cosP - z1 * sinP;
    const z2 = y1 * sinP + z1 * cosP;

    const fov = 560;
    const persp = fov / (fov + y2 + 120);
    return {
      sx: cx + x1 * persp,
      sy: cy - z2 * persp,
      depth: y2,
      persp
    };
  }

  function render(ctx, alpha) {
    if (primaryTrail.length === 0) seedPair(true);

    const w = state.width;
    const h = state.height;
    const ink = state.palette.inkRGB;
    const accent = state.palette.accentRGB;
    const { cx, cy } = getFocalCenter();
    const att = ATTRACTORS[presetIndex];
    const baseScale = Math.min(w, h) / 760;
    const rhoParam = state.params.attractorRho || 28.0;
    const speedScale = state.params.attractorSpeed || 1.0;

    // Advance RK4 integration
    if (!state.paused) {
      const effDt = att.dt * speedScale;
      for (let s = 0; s < att.stepsPerFrame; s++) {
        rk4Step(primary, effDt, att.deriv, rhoParam);
        rk4Step(shadow, effDt, att.deriv, rhoParam);
        integratedTime += effDt;
        // Guard against divergence if user pushes rho extreme
        if (!Number.isFinite(primary.x) || Math.abs(primary.x) > 500) {
          seedPair(true);
          break;
        }
        primaryTrail.push({ x: primary.x, y: primary.y, z: primary.z });
        shadowTrail.push({ x: shadow.x, y: shadow.y, z: shadow.z });
        if (primaryTrail.length > MAX_TRAIL) primaryTrail.shift();
        if (shadowTrail.length > MAX_TRAIL) shadowTrail.shift();
      }
      yaw += 0.0032 * speedScale;
    }

    // Pointer-driven camera orbit offset
    const normX = Math.max(-1, Math.min(1, (pointer.x - cx) / Math.max(1, w * 0.45)));
    const normY = Math.max(-1, Math.min(1, (pointer.y - cy) / Math.max(1, h * 0.45)));
    const effYaw = yaw + normX * 1.15;
    const effPitch = pitch + normY * 0.65;
    const cosY = Math.cos(effYaw);
    const sinY = Math.sin(effYaw);
    const cosP = Math.cos(effPitch);
    const sinP = Math.sin(effPitch);

    ctx.save();

    // 1. Subtle 3D Phase-Space Axes & Bounding Graticule
    const axisSpan = 210 * baseScale;
    const projRaw = (vx, vy, vz) => {
      const x1 = vx * cosY - vy * sinY;
      const y1 = vx * sinY + vy * cosY;
      const y2 = y1 * cosP - vz * sinP;
      const z2 = y1 * sinP + vz * cosP;
      const persp = 560 / (560 + y2 + 120);
      return { sx: cx + x1 * persp, sy: cy - z2 * persp };
    };

    const origin = projRaw(0, 0, 0);
    const axX = projRaw(axisSpan, 0, 0);
    const axY = projRaw(0, axisSpan, 0);
    const axZ = projRaw(0, 0, axisSpan);

    ctx.strokeStyle = rgba(ink, alpha * 0.11);
    ctx.lineWidth = 0.7;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(origin.sx, origin.sy); ctx.lineTo(axX.sx, axX.sy);
    ctx.moveTo(origin.sx, origin.sy); ctx.lineTo(axY.sx, axY.sy);
    ctx.moveTo(origin.sx, origin.sy); ctx.lineTo(axZ.sx, axZ.sy);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '9px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillStyle = rgba(ink, alpha * 0.28);
    ctx.fillText('x', axX.sx + 4, axX.sy);
    ctx.fillText('y', axY.sx + 4, axY.sy);
    ctx.fillText('z', axZ.sx + 4, axZ.sy);

    // 2. Render Shadow (Perturbed) Trajectory Ribbon
    if (shadowTrail.length > 2) {
      let prev = project3D(shadowTrail[0], att, cx, cy, baseScale, cosY, sinY, cosP, sinP);
      for (let i = 1; i < shadowTrail.length; i++) {
        const cur = project3D(shadowTrail[i], att, cx, cy, baseScale, cosY, sinY, cosP, sinP);
        const t = i / shadowTrail.length;
        ctx.strokeStyle = rgba(accent, alpha * (0.04 + t * 0.42));
        ctx.lineWidth = 0.55 + t * 0.65;
        ctx.beginPath();
        ctx.moveTo(prev.sx, prev.sy);
        ctx.lineTo(cur.sx, cur.sy);
        ctx.stroke();
        prev = cur;
      }
    }

    // 3. Render Primary Trajectory Ribbon
    let headProj = null;
    if (primaryTrail.length > 2) {
      let prev = project3D(primaryTrail[0], att, cx, cy, baseScale, cosY, sinY, cosP, sinP);
      for (let i = 1; i < primaryTrail.length; i++) {
        const cur = project3D(primaryTrail[i], att, cx, cy, baseScale, cosY, sinY, cosP, sinP);
        const t = i / primaryTrail.length;
        const depthFade = Math.max(0.35, Math.min(1.15, cur.persp));
        ctx.strokeStyle = rgba(ink, alpha * (0.06 + t * 0.76) * depthFade);
        ctx.lineWidth = (0.7 + t * 1.15) * depthFade;
        ctx.beginPath();
        ctx.moveTo(prev.sx, prev.sy);
        ctx.lineTo(cur.sx, cur.sy);
        ctx.stroke();
        prev = cur;
      }
      headProj = prev;
    }

    // 4. Trajectory Heads, Velocity Tangent & Lyapunov Divergence Chord
    const shadowHead = project3D(shadow, att, cx, cy, baseScale, cosY, sinY, cosP, sinP);
    if (headProj) {
      ctx.strokeStyle = rgba(accent, alpha * 0.48);
      ctx.lineWidth = 0.85;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(headProj.sx, headProj.sy);
      ctx.lineTo(shadowHead.sx, shadowHead.sy);
      ctx.stroke();
      ctx.setLineDash([]);

      const vel = att.deriv(primary.x, primary.y, primary.z, rhoParam);
      const vLen = Math.hypot(vel[0], vel[1], vel[2]) || 1;
      const stepScale = 2.6 / att.scale;
      const tipPt = {
        x: primary.x + (vel[0] / vLen) * stepScale * 18,
        y: primary.y + (vel[1] / vLen) * stepScale * 18,
        z: primary.z + (vel[2] / vLen) * stepScale * 18
      };
      const tipProj = project3D(tipPt, att, cx, cy, baseScale, cosY, sinY, cosP, sinP);

      ctx.strokeStyle = rgba(accent, alpha * 0.85);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(headProj.sx, headProj.sy);
      ctx.lineTo(tipProj.sx, tipProj.sy);
      ctx.stroke();

      ctx.fillStyle = rgba(ink, alpha * 0.95);
      ctx.beginPath();
      ctx.arc(headProj.sx, headProj.sy, 3.0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = rgba(accent, alpha * 0.95);
      ctx.beginPath();
      ctx.arc(shadowHead.sx, shadowHead.sy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Monospace Phase-Space Telemetry Annotation & Shared Telemetry State
    const delta = Math.hypot(
      primary.x - shadow.x,
      primary.y - shadow.y,
      primary.z - shadow.z
    );
    const logSep = Math.log(Math.max(1e-4, delta / EPSILON_0));
    const lyap = integratedTime > 0.1 ? logSep / integratedTime : 0;

    state.telemetry.attractorName = att.name;
    state.telemetry.attractorDelta = delta;
    state.telemetry.attractorLyap = lyap;
    state.telemetry.attractorTime = integratedTime;
    if (!state.paused && state.frame % 8 === 0) {
      Manifold.pushHistory(state.telemetry.attractorLyapHistory, logSep, 48);
    }

    ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillStyle = rgba(ink, alpha * 0.48);
    const labelX = Math.max(20, cx - 185 * baseScale);
    const labelY = Math.min(h - 28, cy + 205 * baseScale);
    ctx.fillText(
      `${att.name}  ·  ${att.eq}`,
      labelX,
      labelY
    );
    ctx.fillStyle = rgba(accent, alpha * 0.72);
    ctx.fillText(
      `δ(t) = ${delta.toFixed(3)}   λ_eff ≈ ${lyap.toFixed(3)}   t = ${integratedTime.toFixed(1)}`,
      labelX,
      labelY + 15
    );

    ctx.restore();
  }

  Manifold.fields.attractor = {
    init,
    reset: () => init(false),
    reseed: () => {
      seedPair(false);
      Manifold.notify('PERTURBED PAIR RE-SEEDED · δ₀ = 10⁻³');
    },
    setPreset,
    handleClick,
    render
  };
})(window);
