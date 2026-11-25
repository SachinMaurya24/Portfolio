/* =========================================================================
   MODE 2: STOCHASTIC DIFFUSION & KERNEL DENSITY ENVELOPE
   dX_t = -κ X_t dt + σ dW_t with live Gaussian KDE
   Interactive features:
   - Click canvas to inject a decaying localized volatility impulse
   - Live σ (volatility) & κ (mean-reversion) sliders + reseed ensemble
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold;
  const { state, pointer, rgba } = Manifold;

  const STOCH_PATHS = 36;
  const STOCH_STEPS = 88;
  const impulses = []; // { x, y, strength }

  function gaussianRand() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  const stochInnov = Array.from({ length: STOCH_PATHS }, () => new Float32Array(STOCH_STEPS));

  function reseed(silent) {
    for (let p = 0; p < STOCH_PATHS; p++) {
      const row = stochInnov[p];
      for (let k = 0; k < STOCH_STEPS; k++) {
        row[k] = gaussianRand();
      }
    }
    impulses.length = 0;
    if (!silent) Manifold.notify('WIENER ENSEMBLE RESEEDED');
  }

  reseed(true);

  function handleClick(x, y) {
    impulses.push({ x, y, strength: 2.2 });
    if (impulses.length > 5) impulses.shift();
    Manifold.notify('VOLATILITY IMPULSE INJECTED');
  }

  function render(ctx, alpha) {
    const w = state.width;
    const h = state.height;
    const isDesktop = w >= 1024;
    const xStart = isDesktop ? w * 0.40 : w * 0.08;
    const xEnd = w * 0.86;
    const kdeBaseX = xEnd + 14;
    const kdeMaxW = Math.min(115, w * 0.11);
    const yMid = h * 0.50;
    const yScale = h * 0.15;

    const ink = state.palette.inkRGB;
    const accent = state.palette.accentRGB;
    const sigma = state.params.stochSigma;
    const kappa = state.params.stochKappa;
    const ds = 0.055;
    const sqrtDs = Math.sqrt(ds);

    if (!state.paused) {
      const relax = 0.018;
      const inject = Math.sqrt(2 * relax);
      for (let p = 0; p < STOCH_PATHS; p++) {
        const row = stochInnov[p];
        for (let k = 0; k < STOCH_STEPS; k++) {
          row[k] = row[k] * (1 - relax) + inject * gaussianRand() * 0.45;
        }
      }

      // Decay user-injected volatility impulses
      for (let i = impulses.length - 1; i >= 0; i--) {
        impulses[i].strength *= 0.978;
        if (impulses[i].strength < 0.05) impulses.splice(i, 1);
      }
    }

    // 1. Subtle coordinate grid hairlines
    ctx.lineWidth = 0.65;
    ctx.strokeStyle = rgba(ink, alpha * 0.12);
    ctx.beginPath();
    ctx.moveTo(xStart, yMid);
    ctx.lineTo(xEnd, yMid);
    for (let tTick = 0; tTick <= 4; tTick++) {
      const tx = xStart + ((xEnd - xStart) * tTick) / 4;
      ctx.moveTo(tx, h * 0.14);
      ctx.lineTo(tx, h * 0.86);
    }
    ctx.stroke();

    // Reference dispersion envelopes (±1σ, ±2σ dashed hairlines)
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = rgba(ink, alpha * 0.11);
    [1, -1, 2, -2].forEach((mult) => {
      const yRef = yMid + mult * sigma * yScale * 0.65;
      ctx.beginPath();
      ctx.moveTo(xStart, yRef);
      ctx.lineTo(xEnd, yRef);
      ctx.stroke();
    });
    ctx.restore();

    // Render decaying click-impulse rings
    for (let i = 0; i < impulses.length; i++) {
      const imp = impulses[i];
      const rad = 18 + (2.2 - imp.strength) * 28;
      ctx.strokeStyle = rgba(accent, alpha * Math.min(0.65, imp.strength * 0.28));
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(imp.x, imp.y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Integrate & Render 36 Stochastic Trajectories
    const terminals = new Float32Array(STOCH_PATHS);
    const dx = (xEnd - xStart) / (STOCH_STEPS - 1);

    for (let p = 0; p < STOCH_PATHS; p++) {
      const row = stochInnov[p];
      const isHighlight = (p === 0 || p === 12 || p === 24);
      let val = 0;

      ctx.beginPath();
      ctx.moveTo(xStart, yMid);

      for (let k = 1; k < STOCH_STEPS; k++) {
        const px = xStart + k * dx;
        const pyPrev = yMid - val * yScale;

        const dCursor = Math.hypot(px - pointer.x, pyPrev - pointer.y);
        let localShock = Math.exp(-(dCursor * dCursor) / 14000) * 1.15;

        for (let m = 0; m < impulses.length; m++) {
          const imp = impulses[m];
          const di = Math.hypot(px - imp.x, pyPrev - imp.y);
          localShock += Math.exp(-(di * di) / 11000) * imp.strength;
        }

        const effSigma = sigma + localShock;
        val += (-kappa * val) * ds + effSigma * row[k] * sqrtDs;
        const py = yMid - val * yScale;
        ctx.lineTo(px, py);
      }

      terminals[p] = val;
      ctx.strokeStyle = isHighlight
        ? rgba(accent, alpha * 0.72)
        : rgba(ink, alpha * 0.22);
      ctx.lineWidth = isHighlight ? 1.15 : 0.7;
      ctx.stroke();
    }

    // 3. Empirical Terminal Statistics & Real-Time Gaussian KDE Envelope
    let sum = 0;
    for (let p = 0; p < STOCH_PATHS; p++) sum += terminals[p];
    const mean = sum / STOCH_PATHS;

    let varSum = 0;
    for (let p = 0; p < STOCH_PATHS; p++) {
      const d = terminals[p] - mean;
      varSum += d * d;
    }
    const std = Math.sqrt(varSum / STOCH_PATHS);
    state.telemetry.stochEmpMean = mean;
    state.telemetry.stochEmpStd = std;

    ctx.strokeStyle = rgba(ink, alpha * 0.25);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(kdeBaseX, h * 0.14);
    ctx.lineTo(kdeBaseX, h * 0.86);
    ctx.stroke();

    const bandwidth = Math.max(0.18, 0.35 * std + 0.12);
    const samples = 72;
    const yTop = h * 0.14;
    const yBot = h * 0.86;
    const densities = new Float32Array(samples);
    let maxDens = 1e-5;

    for (let s = 0; s < samples; s++) {
      const py = yTop + ((yBot - yTop) * s) / (samples - 1);
      const v = (yMid - py) / yScale;
      let dens = 0;
      for (let p = 0; p < STOCH_PATHS; p++) {
        const z = (v - terminals[p]) / bandwidth;
        dens += Math.exp(-0.5 * z * z);
      }
      densities[s] = dens;
      if (dens > maxDens) maxDens = dens;
    }

    ctx.beginPath();
    for (let s = 0; s < samples; s++) {
      const py = yTop + ((yBot - yTop) * s) / (samples - 1);
      const px = kdeBaseX + (densities[s] / maxDens) * kdeMaxW;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = rgba(accent, alpha * 0.82);
    ctx.lineWidth = 1.25;
    ctx.stroke();

    const yMean = yMid - mean * yScale;
    ctx.strokeStyle = rgba(accent, alpha * 0.75);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(kdeBaseX - 6, yMean);
    ctx.lineTo(kdeBaseX + kdeMaxW * 0.9, yMean);
    ctx.stroke();
  }

  Manifold.fields.stochastic = {
    reseed,
    reset: () => reseed(false),
    handleClick,
    render
  };
})(window);
