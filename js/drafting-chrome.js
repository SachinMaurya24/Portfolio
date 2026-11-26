/* =========================================================================
   PRECISION DRAFTING-PLATE CHROME
   - Procedural archival paper / matte obsidian micro-grain (offscreen tile)
   - Viewport coordinate margin rulers with live vernier cursor marker
   - Smart open-canvas crosshair reticle with active-field local readout
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold;
  const { state, pointer, rgba } = Manifold;

  const grainPatterns = {
    obsidian: null,
    archival: null
  };

  function buildGrainPattern(ctx, themeName) {
    const tile = document.createElement('canvas');
    const size = 128;
    tile.width = size;
    tile.height = size;
    const tctx = tile.getContext('2d');
    const img = tctx.createImageData(size, size);
    const data = img.data;

    // Deterministic LCG so grain never shimmers across reloads
    let seed = themeName === 'obsidian' ? 1337 : 4242;
    const isDark = themeName === 'obsidian';

    for (let i = 0; i < data.length; i += 4) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const n = (seed >>> 24) & 255;
      if (isDark) {
        // Subtle warm-mineral speckling on deep obsidian
        const v = n > 140 ? 235 : 15;
        data[i] = v;
        data[i + 1] = v - 3;
        data[i + 2] = v - 8;
        data[i + 3] = n > 195 ? 10 : (n < 50 ? 8 : 0);
      } else {
        // Fine cotton-rag fiber grain on archival paper
        const v = n > 130 ? 40 : 120;
        data[i] = v;
        data[i + 1] = v - 4;
        data[i + 2] = v - 10;
        data[i + 3] = n > 190 ? 11 : (n < 45 ? 7 : 0);
      }
    }

    tctx.putImageData(img, 0, 0);
    return ctx.createPattern(tile, 'repeat');
  }

  function renderGrain(ctx) {
    const theme = state.theme;
    if (!grainPatterns[theme]) {
      grainPatterns[theme] = buildGrainPattern(ctx, theme);
    }
    const pat = grainPatterns[theme];
    if (!pat) return;

    ctx.save();
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.restore();
  }

  function renderMarginRulers(ctx) {
    const w = state.width;
    const h = state.height;
    if (w < 640) return; // Keep mobile viewports uncluttered

    const ink = state.palette.inkRGB;
    const accent = state.palette.accentRGB;
    const topOffset = 48; // Below sticky masthead
    const step = 16;

    ctx.save();
    ctx.lineWidth = 0.75;

    // 1. Left Edge Vertical Coordinate Ruler
    ctx.strokeStyle = rgba(ink, 0.14);
    ctx.beginPath();
    for (let y = topOffset + 8; y < h - 12; y += step) {
      const idx = Math.round((y - topOffset) / step);
      const len = idx % 5 === 0 ? 8 : 4;
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(len, y + 0.5);
    }
    ctx.stroke();

    // 2. Bottom Edge Horizontal Coordinate Ruler
    ctx.beginPath();
    for (let x = 16; x < w - 16; x += step) {
      const idx = Math.round(x / step);
      const len = idx % 5 === 0 ? 8 : 4;
      ctx.moveTo(x + 0.5, h);
      ctx.lineTo(x + 0.5, h - len);
    }
    ctx.stroke();

    // 3. Origin Cross-Ticks at viewport centerlines
    const midX = Math.round(w * 0.5) + 0.5;
    const midY = Math.round(h * 0.5) + 0.5;
    ctx.strokeStyle = rgba(ink, 0.28);
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(12, midY);
    ctx.moveTo(midX, h);
    ctx.lineTo(midX, h - 12);
    ctx.stroke();

    // 4. Live Vernier Cursor Markers on Both Rulers
    if (pointer.active) {
      const py = Math.max(topOffset + 4, Math.min(h - 4, pointer.y));
      const px = Math.max(4, Math.min(w - 4, pointer.x));

      ctx.strokeStyle = rgba(accent, 0.85);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      // Left ruler vernier
      ctx.moveTo(0, py);
      ctx.lineTo(13, py);
      // Bottom ruler vernier
      ctx.moveTo(px, h);
      ctx.lineTo(px, h - 13);
      ctx.stroke();

      // Tiny normalized coordinate tags near vernier ticks
      const scale = Math.min(w, h) * 0.5;
      const nx = (px - w * 0.5) / scale;
      const ny = -(py - h * 0.5) / scale;
      ctx.font = '8.5px "IBM Plex Mono", ui-monospace, monospace';
      ctx.fillStyle = rgba(accent, 0.72);
      ctx.fillText(`${ny >= 0 ? '+' : ''}${ny.toFixed(2)}`, 16, py + 3);
      if (px > 70 && px < w - 340) {
        ctx.fillText(`${nx >= 0 ? '+' : ''}${nx.toFixed(2)}`, px + 4, h - 16);
      }
    }

    ctx.restore();
  }

  function getReticleReadout() {
    const mode = Manifold.getActiveMode();
    const t = state.telemetry;

    if (mode === 0 && Manifold.fields.scalar) {
      const fVal = Manifold.fields.scalar.evalScalarPotential(pointer.x, pointer.y, state.time);
      const { gx, gy } = Manifold.fields.scalar.evalGradient(pointer.x, pointer.y, state.time);
      const gNorm = Math.hypot(gx, gy) * 100;
      return `f = ${fVal >= 0 ? '+' : ''}${fVal.toFixed(2)}  |∇f| = ${gNorm.toFixed(2)}`;
    }
    if (mode === 1) {
      return `N = ${t.nbodyCount}  Q = ${t.nbodyQuadNodes}  θ = ${state.params.nbodyTheta.toFixed(2)}`;
    }
    if (mode === 2) {
      return `σ = ${state.params.stochSigma.toFixed(2)}  μ = ${t.stochEmpMean >= 0 ? '+' : ''}${t.stochEmpMean.toFixed(2)}`;
    }
    if (mode === 3) {
      return `θ = ${t.fourierTheta.toFixed(2)} rad  N = ${state.params.fourierHarmonics}`;
    }
    if (mode === 4) {
      return `λ = ${state.params.flowLambda.toFixed(2)}×  ${t.flowMeanLatency.toFixed(1)} ms`;
    }
    if (mode === 5) {
      return `δ = ${t.attractorDelta.toFixed(2)}  λ ≈ ${t.attractorLyap.toFixed(2)}`;
    }
    if (mode === 6) {
      return `u(x,y) = ${t.eigenCursorVal >= 0 ? '+' : ''}${t.eigenCursorVal.toFixed(2)}  (${state.params.eigenN},${state.params.eigenM})`;
    }
    return '';
  }

  function renderCursorReticle(ctx) {
    if (!pointer.active) return;
    if (pointer.overEditorial && !state.inspectField) return;
    if (state.width < 640) return;

    const px = pointer.x;
    const py = pointer.y;
    const ink = state.palette.inkRGB;
    const accent = state.palette.accentRGB;

    ctx.save();

    // Delicate broken-center crosshair (1px hairline)
    const gap = 6;
    const arm = 14;
    ctx.strokeStyle = rgba(accent, 0.55);
    ctx.lineWidth = 0.85;
    ctx.beginPath();
    ctx.moveTo(px - arm, py); ctx.lineTo(px - gap, py);
    ctx.moveTo(px + gap, py); ctx.lineTo(px + arm, py);
    ctx.moveTo(px, py - arm); ctx.lineTo(px, py - gap);
    ctx.moveTo(px, py + gap); ctx.lineTo(px, py + arm);
    ctx.stroke();

    // Precision center pixel dot
    ctx.fillStyle = rgba(accent, 0.9);
    ctx.fillRect(px - 1, py - 1, 2, 2);

    // Compact live telemetry readout beside reticle
    const readout = getReticleReadout();
    if (readout) {
      ctx.font = '9px "IBM Plex Mono", ui-monospace, monospace';
      const textW = ctx.measureText(readout).width;
      const flipLeft = px + 18 + textW > state.width - 20;
      const tx = flipLeft ? px - 18 - textW : px + 18;
      const ty = py - 10 < 64 ? py + 18 : py - 10;

      ctx.fillStyle = rgba(ink, 0.62);
      ctx.fillText(readout, tx, ty);
    }

    ctx.restore();
  }

  function render(ctx) {
    renderGrain(ctx);
    renderMarginRulers(ctx);
    renderCursorReticle(ctx);
  }

  Manifold.chrome = { render };
})(window);
