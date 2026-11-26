/* =========================================================================
   MAIN ENTRY POINT — CANVAS LIFECYCLE, 60FPS RENDER LOOP & BOOTSTRAP
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold;
  const { state, pointer, getFocalCenter } = Manifold;

  let canvas = null;
  let ctx = null;

  function resizeCanvas() {
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(state.width * state.dpr);
    canvas.height = Math.floor(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    if (!pointer.active) {
      const f = getFocalCenter();
      pointer.targetX = f.cx;
      pointer.targetY = f.cy;
    }

    if (Manifold.fields.flow) {
      Manifold.fields.flow.init();
    }
  }

  function animate() {
    state.frame++;
    if (!state.paused) {
      state.time += 0.014;
    }

    // Inertial damped spring pointer physics
    const stiffness = 0.095;
    const damping = 0.78;
    pointer.vx = (pointer.vx + (pointer.targetX - pointer.x) * stiffness) * damping;
    pointer.vy = (pointer.vy + (pointer.targetY - pointer.y) * stiffness) * damping;
    pointer.x += pointer.vx;
    pointer.y += pointer.vy;

    // Smooth alpha crossfade between the 7 mathematical domains
    for (let i = 0; i < 7; i++) {
      state.weights[i] += (state.targetWeights[i] - state.weights[i]) * 0.075;
      if (state.weights[i] < 0.002) state.weights[i] = 0;
    }

    // Clear full viewport with solid archival/obsidian ground
    ctx.fillStyle = state.palette.bg;
    ctx.fillRect(0, 0, state.width, state.height);

    if (state.weights[0] > 0.005) Manifold.fields.scalar.render(ctx, state.weights[0]);
    if (state.weights[1] > 0.005) Manifold.fields.nbody.render(ctx, state.weights[1]);
    if (state.weights[2] > 0.005) Manifold.fields.stochastic.render(ctx, state.weights[2]);
    if (state.weights[3] > 0.005) Manifold.fields.graph.render(ctx, state.weights[3]);
    if (state.weights[4] > 0.005) Manifold.fields.flow.render(ctx, state.weights[4]);
    if (state.weights[5] > 0.005 && Manifold.fields.attractor) Manifold.fields.attractor.render(ctx, state.weights[5]);
    if (state.weights[6] > 0.005 && Manifold.fields.eigenmode) Manifold.fields.eigenmode.render(ctx, state.weights[6]);

    // Precision drafting-plate chrome: archival grain, coordinate rulers & reticle
    if (Manifold.chrome) {
      Manifold.chrome.render(ctx);
    }

    if (state.frame % 6 === 0) {
      Manifold.ui.updateTelemetryReadouts();
    }

    requestAnimationFrame(animate);
  }

  function bindPointerAndViewport() {
    window.addEventListener('mousemove', (e) => {
      pointer.active = true;
      pointer.targetX = e.clientX;
      pointer.targetY = e.clientY;
      const t = e.target;
      pointer.overEditorial = Boolean(
        t && t.closest && t.closest('.editorial-veil, .masthead, .field-dock')
      );
    }, { passive: true });

    window.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length > 0) {
        pointer.active = true;
        pointer.targetX = e.touches[0].clientX;
        pointer.targetY = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches.length > 0) {
        pointer.active = true;
        pointer.targetX = e.touches[0].clientX;
        pointer.targetY = e.touches[0].clientY;
      }
    }, { passive: true });

    window.addEventListener('scroll', () => {
      Manifold.ui.updateScrollTargets();
    }, { passive: true });

    window.addEventListener('resize', () => {
      resizeCanvas();
      Manifold.ui.updateScrollTargets();
    });
  }

  function bootstrap() {
    try {
      canvas = document.getElementById('manifold-canvas');
      ctx = canvas.getContext('2d', { alpha: false });

      Manifold.ui.init();
      resizeCanvas();
      Manifold.fields.nbody.init();
      Manifold.fields.graph.init(true);
      Manifold.fields.flow.init();
      if (Manifold.fields.attractor) Manifold.fields.attractor.init(true);
      if (Manifold.fields.eigenmode) Manifold.fields.eigenmode.init(true);
      Manifold.ui.updateScrollTargets();
      Manifold.ui.updateTelemetryReadouts();
      bindPointerAndViewport();

      if (Manifold.github) {
        Manifold.github.init();
      }

      if (Manifold.audio) {
        Manifold.audio.init();
      }

      animate();
    } catch (err) {
      console.error('Manifold initialization error:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})(window);
