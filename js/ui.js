/* =========================================================================
   INTERACTIVE UI CONTROLS, TELEMETRY, CANVAS ROUTING & KEYBOARD SHORTCUTS
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold;
  const { state, pointer, PALETTES, MODE_META } = Manifold;

  const dom = {};

  function cacheDom() {
    dom.canvas = document.getElementById('manifold-canvas');
    dom.themeBtn = document.getElementById('theme-btn');
    dom.inspectBtn = document.getElementById('inspect-btn');
    dom.pauseBtn = document.getElementById('pause-btn');
    dom.dockPauseBtn = document.getElementById('dock-pause-btn');
    dom.dockResetBtn = document.getElementById('dock-reset-btn');
    dom.dockHint = document.getElementById('dock-hint');
    dom.mastheadLabel = document.getElementById('masthead-section-label');
    dom.progressBar = document.getElementById('scroll-progress-bar');

    dom.trackedSections = Array.from(document.querySelectorAll('[data-section-label]'));
    dom.lockButtons = Array.from(document.querySelectorAll('.lock-btn'));
    dom.modePills = Array.from(document.querySelectorAll('[data-dock-mode]'));

    // Telemetry elements
    dom.telXY = document.getElementById('tel-xy');
    dom.telF = document.getElementById('tel-f');
    dom.telGrad = document.getElementById('tel-grad');
    dom.telWells = document.getElementById('tel-scalar-wells');
    dom.telNBodyN = document.getElementById('tel-nbody-n');
    dom.telNBodyNodes = document.getElementById('tel-nbody-nodes');
    dom.telStochStd = document.getElementById('tel-stoch-std');
    dom.telStochMean = document.getElementById('tel-stoch-mean');
    dom.telGraphV = document.getElementById('tel-graph-v');
    dom.telGraphE = document.getElementById('tel-graph-e');
    dom.telGraphD = document.getElementById('tel-graph-d');
    dom.telFlowTp = document.getElementById('tel-flow-tp');
    dom.telFlowLat = document.getElementById('tel-flow-lat');
    dom.telFlowRr = document.getElementById('tel-flow-rr');
  }

  function applyTheme(themeName) {
    state.theme = themeName;
    state.palette = PALETTES[themeName];
    document.documentElement.setAttribute('data-theme', themeName);
    if (dom.themeBtn) {
      dom.themeBtn.textContent = themeName === 'obsidian' ? '[ ◐ OBSIDIAN ]' : '[ ◑ ARCHIVAL ]';
    }
    try {
      localStorage.setItem('manifold-theme', themeName);
    } catch (_) {
      // Ignore storage failures
    }
  }

  function setInspectMode(enabled) {
    state.inspectField = enabled;
    document.body.classList.toggle('inspect-field', enabled);
    if (dom.inspectBtn) {
      dom.inspectBtn.classList.toggle('is-active', enabled);
      dom.inspectBtn.setAttribute('aria-pressed', String(enabled));
      dom.inspectBtn.textContent = enabled ? '[ EXIT INSPECT ]' : '[ INSPECT FIELD ]';
    }
  }

  function setPaused(paused) {
    state.paused = paused;
    document.body.classList.toggle('is-paused', paused);
    const label = paused ? '[ ▶ RESUME ]' : '[ ❚❚ PAUSE ]';
    if (dom.pauseBtn) {
      dom.pauseBtn.classList.toggle('is-active', paused);
      dom.pauseBtn.textContent = label;
    }
    if (dom.dockPauseBtn) {
      dom.dockPauseBtn.classList.toggle('is-active', paused);
      dom.dockPauseBtn.textContent = paused ? '▶' : '❚❚';
    }
  }

  function syncModeIndicators() {
    const activeMode = Manifold.getActiveMode();

    dom.lockButtons.forEach((btn) => {
      const m = parseInt(btn.getAttribute('data-lock-mode'), 10);
      const locked = state.lockedMode === m;
      btn.classList.toggle('is-active', locked);
      btn.textContent = locked ? '[ UNLOCK FIELD ]' : '[ LOCK FIELD ]';
    });

    dom.modePills.forEach((pill) => {
      const m = parseInt(pill.getAttribute('data-dock-mode'), 10);
      pill.classList.toggle('is-active', activeMode === m);
    });

    if (dom.dockHint && MODE_META[activeMode]) {
      const lockSuffix = state.lockedMode !== null ? ' · [LOCKED]' : '';
      dom.dockHint.textContent = MODE_META[activeMode].hint + lockSuffix;
    }

    for (let m = 1; m <= 4; m++) {
      const el = document.getElementById(`status-mode-${m}`);
      const plateEl = document.getElementById(`plate-${m}`);
      const veilEl = plateEl ? plateEl.querySelector('.editorial-veil') : null;
      const isActive = activeMode === m;

      if (veilEl) {
        veilEl.classList.toggle('is-active-plate', isActive);
      }

      if (!el) continue;
      const dot = el.querySelector('.mode-dot');
      const txt = el.querySelector('.mode-state-label');
      if (isActive) {
        dot.style.backgroundColor = 'var(--accent)';
        txt.textContent = state.lockedMode === m ? 'LOCKED IN MANIFOLD' : 'LIVE IN MANIFOLD';
        txt.style.color = 'var(--accent)';
      } else {
        dot.style.backgroundColor = 'var(--rule-strong)';
        txt.textContent = 'STANDBY';
        txt.style.color = 'var(--ink-muted)';
      }
    }
  }

  function updateScrollTargets() {
    const vh = window.innerHeight;
    const viewportMid = vh * 0.48;

    let closestEl = dom.trackedSections[0];
    let minDist = Infinity;

    for (let i = 0; i < dom.trackedSections.length; i++) {
      const el = dom.trackedSections[i];
      const rect = el.getBoundingClientRect();
      const secMid = rect.top + rect.height * 0.5;
      const dist = (viewportMid >= rect.top && viewportMid <= rect.bottom)
        ? Math.abs(secMid - viewportMid) * 0.15
        : Math.abs(secMid - viewportMid);
      if (dist < minDist) {
        minDist = dist;
        closestEl = el;
      }
    }

    if (closestEl) {
      const label = closestEl.getAttribute('data-section-label');
      const mode = parseInt(closestEl.getAttribute('data-mode') || '0', 10);
      if (dom.mastheadLabel && dom.mastheadLabel.textContent !== label) {
        dom.mastheadLabel.textContent = label;
      }
      state.activeScrollMode = mode;
    }

    // Update 1px reading progress hairline
    if (dom.progressBar) {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const pct = Math.max(0, Math.min(100, (window.scrollY / maxScroll) * 100));
      dom.progressBar.style.width = `${pct.toFixed(2)}%`;
    }

    const target = [0, 0, 0, 0, 0, 0, 0];
    const chosenMode = Manifold.getActiveMode();
    target[chosenMode] = 1;
    state.targetWeights = target;
    syncModeIndicators();
  }

  function resetActiveField() {
    const mode = Manifold.getActiveMode();
    if (mode === 0) Manifold.fields.scalar.reset();
    else if (mode === 1) Manifold.fields.nbody.reset();
    else if (mode === 2) Manifold.fields.stochastic.reset();
    else if (mode === 3) Manifold.fields.graph.reset();
    else if (mode === 4) Manifold.fields.flow.reset();
    else if (mode === 5 && Manifold.fields.attractor) Manifold.fields.attractor.reset();
    else if (mode === 6 && Manifold.fields.eigenmode) Manifold.fields.eigenmode.reset();
  }

  function updateTelemetryReadouts() {
    if (state.weights[0] > 0.05 && Manifold.fields.scalar) {
      const scale = Math.min(state.width, state.height) * 0.5;
      const nx = (pointer.x - state.width * 0.5) / scale;
      const ny = -(pointer.y - state.height * 0.5) / scale;
      const fVal = Manifold.fields.scalar.evalScalarPotential(pointer.x, pointer.y, state.time);
      const { gx, gy } = Manifold.fields.scalar.evalGradient(pointer.x, pointer.y, state.time);
      const gNorm = Math.hypot(gx, gy) * 100;

      if (dom.telXY) dom.telXY.textContent = `${nx >= 0 ? '+' : ''}${nx.toFixed(2)}, ${ny >= 0 ? '+' : ''}${ny.toFixed(2)}`;
      if (dom.telF) dom.telF.textContent = `${fVal >= 0 ? '+' : ''}${fVal.toFixed(3)}`;
      if (dom.telGrad) dom.telGrad.textContent = gNorm.toFixed(3);
      if (dom.telWells) dom.telWells.textContent = String(state.telemetry.scalarWellsCount);
    }

    if (state.weights[1] > 0.05) {
      if (dom.telNBodyN) dom.telNBodyN.textContent = String(state.telemetry.nbodyCount);
      if (dom.telNBodyNodes) dom.telNBodyNodes.textContent = String(state.telemetry.nbodyQuadNodes);
    }

    if (state.weights[2] > 0.05) {
      if (dom.telStochStd) dom.telStochStd.textContent = state.telemetry.stochEmpStd.toFixed(3);
      if (dom.telStochMean) {
        const m = state.telemetry.stochEmpMean;
        dom.telStochMean.textContent = `${m >= 0 ? '+' : ''}${m.toFixed(3)}`;
      }
    }

    if (state.weights[3] > 0.05) {
      const v = state.telemetry.graphVertices;
      const e = state.telemetry.graphEdges;
      if (dom.telGraphV) dom.telGraphV.textContent = String(v);
      if (dom.telGraphE) dom.telGraphE.textContent = String(e);
      if (dom.telGraphD) {
        const maxEdges = Math.max(1, (v * (v - 1)) / 2);
        const density = (e / maxEdges).toFixed(2);
        dom.telGraphD.textContent = `${density} / κ=${state.telemetry.graphComponents}`;
      }
    }

    if (state.weights[4] > 0.05) {
      const tp = Math.round(120 * state.params.flowLambda + state.telemetry.flowPacketCount * 1.4);
      if (dom.telFlowTp) dom.telFlowTp.textContent = `${tp} req/s`;
      if (dom.telFlowLat) dom.telFlowLat.textContent = `${state.telemetry.flowMeanLatency.toFixed(1)} ms`;
      if (dom.telFlowRr) dom.telFlowRr.textContent = String(state.telemetry.flowReroutes);
    }
  }

  function bindSlidersAndActions() {
    // Mode 0: Scalar Field Controls
    const btnStreamlines = document.getElementById('btn-scalar-streamlines');
    if (btnStreamlines) {
      btnStreamlines.addEventListener('click', () => {
        state.params.scalarStreamlines = !state.params.scalarStreamlines;
        btnStreamlines.classList.toggle('is-active', state.params.scalarStreamlines);
        btnStreamlines.textContent = state.params.scalarStreamlines ? '[ STREAMLINES: ON ]' : '[ STREAMLINES: OFF ]';
      });
    }
    const btnClearWells = document.getElementById('btn-scalar-clear');
    if (btnClearWells) {
      btnClearWells.addEventListener('click', () => Manifold.fields.scalar.clearWells());
    }

    // Mode 1: N-Body Controls
    const sliderNBody = document.getElementById('slider-nbody');
    const valNBody = document.getElementById('val-nbody');
    if (sliderNBody && valNBody) {
      sliderNBody.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        state.params.nbodyDt = v;
        valNBody.textContent = `${v.toFixed(2)}×`;
      });
    }

    const sliderTheta = document.getElementById('slider-theta');
    const valTheta = document.getElementById('val-theta');
    if (sliderTheta && valTheta) {
      sliderTheta.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        state.params.nbodyTheta = v;
        valTheta.textContent = v.toFixed(2);
      });
    }

    const btnQuadtree = document.getElementById('btn-nbody-quad');
    if (btnQuadtree) {
      btnQuadtree.addEventListener('click', () => {
        state.params.nbodyShowQuadtree = !state.params.nbodyShowQuadtree;
        btnQuadtree.classList.toggle('is-active', state.params.nbodyShowQuadtree);
        btnQuadtree.textContent = state.params.nbodyShowQuadtree ? '[ QUADTREE: ON ]' : '[ QUADTREE: OFF ]';
      });
    }

    const btnResetNBody = document.getElementById('btn-nbody-reset');
    if (btnResetNBody) {
      btnResetNBody.addEventListener('click', () => Manifold.fields.nbody.reset());
    }

    // Mode 2: Stochastic Controls
    const sliderStoch = document.getElementById('slider-stoch');
    const valStoch = document.getElementById('val-stoch');
    if (sliderStoch && valStoch) {
      sliderStoch.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        state.params.stochSigma = v;
        valStoch.textContent = v.toFixed(2);
      });
    }

    const sliderKappa = document.getElementById('slider-kappa');
    const valKappa = document.getElementById('val-kappa');
    if (sliderKappa && valKappa) {
      sliderKappa.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        state.params.stochKappa = v;
        valKappa.textContent = v.toFixed(3);
      });
    }

    const btnReseed = document.getElementById('btn-stoch-reseed');
    if (btnReseed) {
      btnReseed.addEventListener('click', () => Manifold.fields.stochastic.reset());
    }

    // Mode 3: Graph Controls
    const sliderGraph = document.getElementById('slider-graph');
    const valGraph = document.getElementById('val-graph');
    if (sliderGraph && valGraph) {
      sliderGraph.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        state.params.graphRadius = v;
        valGraph.textContent = `${Math.round(v)} px`;
      });
    }

    const btnResampleGraph = document.getElementById('btn-graph-reset');
    if (btnResampleGraph) {
      btnResampleGraph.addEventListener('click', () => Manifold.fields.graph.reset());
    }

    const btnUnpinGraph = document.getElementById('btn-graph-unpin');
    if (btnUnpinGraph) {
      btnUnpinGraph.addEventListener('click', () => {
        state.params.graphPinnedSource = null;
        Manifold.notify('DIJKSTRA SOURCE FOLLOWING CURSOR');
      });
    }

    // Mode 4: Latency Flow Controls
    const sliderFlow = document.getElementById('slider-flow');
    const valFlow = document.getElementById('val-flow');
    if (sliderFlow && valFlow) {
      sliderFlow.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        state.params.flowLambda = v;
        valFlow.textContent = `${v.toFixed(2)}×`;
      });
    }

    const btnFlowBurst = document.getElementById('btn-flow-burst');
    if (btnFlowBurst) {
      btnFlowBurst.addEventListener('click', () => Manifold.fields.flow.injectBurst());
    }

    const btnFlowClear = document.getElementById('btn-flow-clear');
    if (btnFlowClear) {
      btnFlowClear.addEventListener('click', () => Manifold.fields.flow.clearFaults());
    }
  }

  function bindGlobalListeners() {
    applyTheme(state.theme);

    if (dom.themeBtn) {
      dom.themeBtn.addEventListener('click', () => {
        applyTheme(state.theme === 'obsidian' ? 'archival' : 'obsidian');
      });
    }

    if (dom.inspectBtn) {
      dom.inspectBtn.addEventListener('click', () => setInspectMode(!state.inspectField));
    }

    if (dom.pauseBtn) {
      dom.pauseBtn.addEventListener('click', () => setPaused(!state.paused));
    }

    if (dom.dockPauseBtn) {
      dom.dockPauseBtn.addEventListener('click', () => setPaused(!state.paused));
    }

    if (dom.dockResetBtn) {
      dom.dockResetBtn.addEventListener('click', resetActiveField);
    }

    // Lock field buttons inside plates
    dom.lockButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = parseInt(btn.getAttribute('data-lock-mode'), 10);
        state.lockedMode = state.lockedMode === m ? null : m;
        updateScrollTargets();
      });
    });

    // Quick mode switcher pills in floating field dock
    dom.modePills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const m = parseInt(pill.getAttribute('data-dock-mode'), 10);
        if (state.lockedMode === m) {
          state.lockedMode = null;
          Manifold.notify('FIELD UNLOCKED · SCROLL MORPHING');
        } else {
          state.lockedMode = m;
          Manifold.notify(`FIELD LOCKED · ${MODE_META[m].label}`);
        }
        updateScrollTargets();
      });
    });

    // Direct interactive canvas clicks routed to active mathematical domain
    if (dom.canvas) {
      dom.canvas.addEventListener('click', (e) => {
        const x = e.clientX;
        const y = e.clientY;
        const mode = Manifold.getActiveMode();
        if (mode === 0) Manifold.fields.scalar.handleClick(x, y, e.shiftKey);
        else if (mode === 1) Manifold.fields.nbody.handleClick(x, y, e.shiftKey);
        else if (mode === 2) Manifold.fields.stochastic.handleClick(x, y, e.shiftKey);
        else if (mode === 3) Manifold.fields.graph.handleClick(x, y, e.shiftKey);
        else if (mode === 4) Manifold.fields.flow.handleClick(x, y, e.shiftKey);
        else if (mode === 5 && Manifold.fields.attractor) Manifold.fields.attractor.handleClick(x, y, e.shiftKey);
        else if (mode === 6 && Manifold.fields.eigenmode) Manifold.fields.eigenmode.handleClick(x, y, e.shiftKey);
      });
    }

    // Keyboard shortcuts (ignored while typing inside an input)
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'Escape' && state.inspectField) {
        setInspectMode(false);
      } else if (e.key === 'i' || e.key === 'I') {
        setInspectMode(!state.inspectField);
      } else if (e.key === 't' || e.key === 'T') {
        applyTheme(state.theme === 'obsidian' ? 'archival' : 'obsidian');
      } else if (e.code === 'Space') {
        e.preventDefault();
        setPaused(!state.paused);
      } else if (e.key === 'r' || e.key === 'R') {
        resetActiveField();
      } else if (e.key >= '0' && e.key <= '6') {
        const m = parseInt(e.key, 10);
        state.lockedMode = state.lockedMode === m ? null : m;
        updateScrollTargets();
        Manifold.notify(
          state.lockedMode === null
            ? 'FIELD UNLOCKED · SCROLL MORPHING'
            : `FIELD LOCKED · ${MODE_META[m].label}`
        );
      }
    });
  }

  Manifold.ui = {
    init: () => {
      cacheDom();
      bindSlidersAndActions();
      bindGlobalListeners();
    },
    updateScrollTargets,
    updateTelemetryReadouts
  };
})(window);
