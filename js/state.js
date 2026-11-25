/* =========================================================================
   SHARED MANIFOLD STATE, THEME PALETTES & INERTIAL POINTER PHYSICS
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = (global.Manifold = global.Manifold || {});

  Manifold.PALETTES = {
    obsidian: {
      bg: '#0A0B0D',
      inkRGB: [234, 232, 227],
      mutedRGB: [138, 137, 132],
      accentRGB: [201, 184, 150]
    },
    archival: {
      bg: '#F6F4EE',
      inkRGB: [20, 21, 23],
      mutedRGB: [104, 102, 96],
      accentRGB: [142, 47, 36]
    }
  };

  Manifold.MODE_META = [
    {
      id: 0,
      short: '∇f',
      label: '§ 00 FIELD',
      hint: 'Click canvas to place gravity well · Shift+Click for peak'
    },
    {
      id: 1,
      short: 'I',
      label: '§ 01 PLATE I · N-BODY',
      hint: 'Click canvas to inject star · Shift+Click for massive core'
    },
    {
      id: 2,
      short: 'II',
      label: '§ 01 PLATE II · STOCHASTIC',
      hint: 'Click canvas to inject volatility impulse · Move pointer to perturb'
    },
    {
      id: 3,
      short: 'III',
      label: '§ 01 PLATE III · HARMONICS',
      hint: 'Click canvas to cycle harmonic epicycles (3:2, φ, 5:4, Cardioid)'
    },
    {
      id: 4,
      short: 'IV',
      label: '§ 01 PLATE IV · SYSTEMS',
      hint: 'Click any switch node to toggle manual fault & observe failover routing'
    },
    {
      id: 5,
      short: 'V',
      label: '§ 01 PLATE III · ATTRACTOR',
      hint: 'Click canvas to cycle Strange Attractors · Shift+Click to re-seed δ₀ = 10⁻³'
    },
    {
      id: 6,
      short: 'VI',
      label: '§ 01 PLATE IV · EIGENMODES',
      hint: 'Click canvas to cycle Helmholtz modes (n,m) · Shift+Click for acoustic impulse'
    }
  ];

  Manifold.rgba = function (rgb, a) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.max(0, Math.min(1, a)).toFixed(4)})`;
  };

  let savedTheme = 'obsidian';
  try {
    const stored = localStorage.getItem('manifold-theme');
    if (stored === 'archival' || stored === 'obsidian') savedTheme = stored;
  } catch (_) {
    // Ignore storage access errors under strict privacy modes
  }

  Manifold.state = {
    theme: savedTheme,
    palette: Manifold.PALETTES[savedTheme],
    inspectField: false,
    paused: false,
    lockedMode: null, // null = scroll-driven morphing, 0..4 = manually locked mode
    weights: [1, 0, 0, 0, 0, 0, 0],
    targetWeights: [1, 0, 0, 0, 0, 0, 0],
    activeScrollMode: 0,
    params: {
      scalarWellStrength: 0.34,
      scalarStreamlines: true,
      nbodyDt: 1.0,
      nbodyTheta: 0.65,
      nbodyShowQuadtree: true,
      stochSigma: 0.75,
      stochKappa: 0.045,
      graphRadius: 125,
      graphPinnedSource: null,
      flowLambda: 1.0
    },
    telemetry: {
      scalarWellsCount: 0,
      nbodyCount: 144,
      nbodyQuadNodes: 0,
      stochEmpStd: 0,
      stochEmpMean: 0,
      graphVertices: 68,
      graphEdges: 0,
      graphComponents: 1,
      graphSourceIndex: 0,
      flowReroutes: 0,
      flowMeanLatency: 12.4,
      flowPacketCount: 0,
      flowFaultCount: 0
    },
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
    time: 0,
    frame: 0
  };

  Manifold.pointer = {
    targetX: window.innerWidth * 0.68,
    targetY: window.innerHeight * 0.48,
    x: window.innerWidth * 0.68,
    y: window.innerHeight * 0.48,
    vx: 0,
    vy: 0,
    active: false
  };

  Manifold.getFocalCenter = function () {
    const isDesktop = Manifold.state.width >= 1024;
    return {
      cx: isDesktop ? Manifold.state.width * 0.67 : Manifold.state.width * 0.5,
      cy: Manifold.state.height * 0.50
    };
  };

  Manifold.getActiveMode = function () {
    return Manifold.state.lockedMode !== null
      ? Manifold.state.lockedMode
      : Manifold.state.activeScrollMode;
  };

  // Subtle toast feedback for direct canvas interactions
  let toastTimer = null;
  Manifold.notify = function (msg) {
    const el = document.getElementById('canvas-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('is-visible');
    }, 1900);
  };

  Manifold.fields = {};
})(window);
