/* =========================================================================
   MODE 3: FUNDAMENTAL MATHEMATICAL FIELD — FOURIER EPICYCLES & LISSAJOUS
   Classical harmonic analysis, polar graticule, osculating tangent/normal
   vectors, and phase-locked epicyclic loci with configurable harmonic depth.
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold;
  const { state, pointer, rgba, getFocalCenter } = Manifold;

  const PRESETS = [
    {
      name: 'LISSAJOUS 3:2',
      label: 'γ(t) = Σ rₖ e^(i ωₖ t)',
      terms: [
        { amp: 0.54, freq: 1, phase: 0 },
        { amp: 0.27, freq: -2, phase: Math.PI / 4 },
        { amp: 0.14, freq: 3, phase: Math.PI / 2 },
        { amp: 0.08, freq: -5, phase: Math.PI / 6 },
        { amp: 0.05, freq: 7, phase: Math.PI / 3 }
      ]
    },
    {
      name: 'GOLDEN RATIO φ',
      label: 'γ(t) = Σ rₖ e^(i φᵏ t)',
      terms: [
        { amp: 0.52, freq: 1, phase: 0 },
        { amp: 0.30, freq: 1.6180339, phase: 0.4 },
        { amp: 0.15, freq: -2.6180339, phase: 1.1 },
        { amp: 0.08, freq: 4.2360679, phase: 0.2 },
        { amp: 0.05, freq: -6.8541019, phase: 1.8 }
      ]
    },
    {
      name: 'HARMONIC ROSE 5:4',
      label: 'r(θ) = a cos(5θ/4) · EPICYCLIC',
      terms: [
        { amp: 0.48, freq: 1, phase: 0 },
        { amp: 0.32, freq: -4, phase: 0 },
        { amp: 0.16, freq: 5, phase: Math.PI / 3 },
        { amp: 0.09, freq: -8, phase: Math.PI / 2 },
        { amp: 0.05, freq: 9, phase: 0 }
      ]
    },
    {
      name: 'CARDIOID / DELTOID',
      label: 'z(t) = 2e^(it) − e^(i2t) + ½e^(-i3t)',
      terms: [
        { amp: 0.50, freq: 1, phase: 0 },
        { amp: 0.29, freq: 2, phase: Math.PI },
        { amp: 0.14, freq: -3, phase: 0 },
        { amp: 0.08, freq: 4, phase: Math.PI / 2 },
        { amp: 0.05, freq: -6, phase: Math.PI / 4 }
      ]
    }
  ];

  let presetIndex = 0;
  let trail = [];
  const MAX_TRAIL = 340;
  let theta = 0;

  function syncTelemetryName() {
    state.telemetry.fourierPresetName = PRESETS[presetIndex].name;
  }

  function init(silent) {
    trail = [];
    theta = 0;
    state.telemetry.fourierRadiusHistory = [];
    syncTelemetryName();
    if (!silent) {
      Manifold.notify(`HARMONIC MODE · ${PRESETS[presetIndex].name}`);
    }
  }

  function setPreset(idx, silent) {
    presetIndex = ((idx % PRESETS.length) + PRESETS.length) % PRESETS.length;
    trail = [];
    state.telemetry.fourierRadiusHistory = [];
    syncTelemetryName();
    if (!silent) {
      Manifold.notify(`HARMONIC PRESET · ${PRESETS[presetIndex].name}`);
    }
  }

  function handleClick() {
    setPreset(presetIndex + 1, false);
  }

  function render(ctx, alpha) {
    const w = state.width;
    const h = state.height;
    const ink = state.palette.inkRGB;
    const accent = state.palette.accentRGB;
    const { cx, cy } = getFocalCenter();

    const baseR = Math.min(w * (w >= 1024 ? 0.24 : 0.38), h * 0.34);
    const preset = PRESETS[presetIndex];
    const harmonicCount = Math.max(1, Math.min(preset.terms.length, state.params.fourierHarmonics || 3));
    const speed = state.params.fourierSpeed || 1.0;

    // Pointer gently modulates phase offset & secondary harmonic tilt
    const normX = Math.max(-1, Math.min(1, (pointer.x - cx) / Math.max(1, w * 0.4)));
    const normY = Math.max(-1, Math.min(1, (pointer.y - cy) / Math.max(1, h * 0.4)));
    const phaseShift = normX * 0.65;
    const ampMod = 1 + normY * 0.12;

    if (!state.paused) {
      theta += 0.016 * speed;
    }

    // 1. Subtle Polar Coordinate Graticule
    ctx.save();
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = rgba(ink, alpha * 0.085);

    const rings = [0.33, 0.66, 1.0];
    for (let i = 0; i < rings.length; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * rings[i], 0, Math.PI * 2);
      ctx.stroke();
    }

    // Cardinal & diagonal axes
    for (let k = 0; k < 8; k++) {
      const ang = (k * Math.PI) / 4;
      const rOut = baseR * 1.12;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * rOut, cy + Math.sin(ang) * rOut);
      ctx.stroke();
    }

    // Degree ticks on outer circle
    ctx.strokeStyle = rgba(ink, alpha * 0.14);
    for (let deg = 0; deg < 72; deg++) {
      const ang = (deg * Math.PI * 2) / 72;
      const inner = deg % 6 === 0 ? baseR * 0.96 : baseR * 0.985;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
      ctx.lineTo(cx + Math.cos(ang) * baseR, cy + Math.sin(ang) * baseR);
      ctx.stroke();
    }

    // 2. Compute Fourier Epicycle Chain (N active harmonics)
    let px = cx;
    let py = cy;
    const joints = [{ x: px, y: py }];

    for (let i = 0; i < harmonicCount; i++) {
      const term = preset.terms[i];
      const r = baseR * term.amp * (i === 1 ? ampMod : 1);
      const ang = theta * term.freq + term.phase + (i > 0 ? phaseShift : 0);

      // Epicycle circle
      ctx.strokeStyle = rgba(ink, alpha * Math.max(0.05, 0.15 - i * 0.022));
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.stroke();

      const nx = px + Math.cos(ang) * r;
      const ny = py + Math.sin(ang) * r;

      // Radius vector
      ctx.strokeStyle = rgba(accent, alpha * Math.max(0.16, 0.44 - i * 0.06));
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      px = nx;
      py = ny;
      joints.push({ x: px, y: py });
    }

    // Record continuous locus trail & telemetry
    const normRadius = Math.hypot(px - cx, py - cy) / Math.max(1, baseR);
    const wrappedTheta = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    state.telemetry.fourierTheta = wrappedTheta;
    state.telemetry.fourierRadius = normRadius;
    state.telemetry.fourierPresetName = preset.name;

    if (!state.paused) {
      trail.push({ x: px, y: py });
      if (trail.length > MAX_TRAIL) trail.shift();
      if (state.frame % 4 === 0) {
        Manifold.pushHistory(state.telemetry.fourierRadiusHistory, normRadius, 48);
      }
    }

    // 3. Draw Harmonic Locus Curve with Progressive Fade
    if (trail.length > 2) {
      for (let i = 1; i < trail.length; i++) {
        const t = i / trail.length;
        ctx.strokeStyle = rgba(accent, alpha * (0.06 + t * 0.72));
        ctx.lineWidth = 0.8 + t * 0.9;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
    }

    // 4. Tangent & Normal Vectors at P(t)
    if (trail.length > 3) {
      const pPrev = trail[trail.length - 3];
      const dx = px - pPrev.x;
      const dy = py - pPrev.y;
      const len = Math.hypot(dx, dy) || 1;
      const tx = (dx / len) * 34;
      const ty = (dy / len) * 34;

      // Tangent vector T(t)
      ctx.strokeStyle = rgba(ink, alpha * 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + tx, py + ty);
      ctx.stroke();

      // Normal vector N(t)
      ctx.strokeStyle = rgba(accent, alpha * 0.45);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - ty * 0.7, py + tx * 0.7);
      ctx.stroke();
    }

    // 5. Epicycle Joint Dots & Tracing Tip
    for (let i = 0; i < joints.length - 1; i++) {
      ctx.fillStyle = rgba(ink, alpha * 0.45);
      ctx.beginPath();
      ctx.arc(joints[i].x, joints[i].y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = rgba(accent, alpha * 0.95);
    ctx.beginPath();
    ctx.arc(px, py, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // 6. Subtle Monospace Mathematical Annotation
    ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
    ctx.fillStyle = rgba(ink, alpha * 0.45);
    ctx.fillText(
      `${preset.label}   N = ${harmonicCount}   θ = ${wrappedTheta.toFixed(2)} rad`,
      cx - baseR,
      cy + baseR + 28
    );

    ctx.restore();
  }

  Manifold.fields.graph = {
    init,
    reset: () => init(false),
    setPreset,
    cyclePreset: () => setPreset(presetIndex + 1, false),
    clearTrail: () => { trail = []; },
    handleClick,
    render
  };
})(window);
