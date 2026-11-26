/* =========================================================================
   INTERACTIVE UI CONTROLS, TELEMETRY, SPARKLINES, AXIOMS & KEYBOARD SHORTCUTS
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold;
  const { state, pointer, PALETTES, MODE_META, rgba } = Manifold;

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
    dom.plateSections = Array.from(document.querySelectorAll('.plate-section'));
    dom.lockButtons = Array.from(document.querySelectorAll('.lock-btn'));
    dom.modePills = Array.from(document.querySelectorAll('[data-dock-mode]'));
    dom.attractorPills = Array.from(document.querySelectorAll('[data-attractor-preset]'));

    // Telemetry elements
    dom.telXY = document.getElementById('tel-xy');
    dom.telF = document.getElementById('tel-f');
    dom.telGrad = document.getElementById('tel-grad');
    dom.telWells = document.getElementById('tel-scalar-wells');
    dom.telNBodyN = document.getElementById('tel-nbody-n');
    dom.telNBodyNodes = document.getElementById('tel-nbody-nodes');
    dom.telFourierPreset = document.getElementById('tel-fourier-preset');
    dom.telFourierTheta = document.getElementById('tel-fourier-theta');
    dom.telFourierRadius = document.getElementById('tel-fourier-radius');
    dom.telAttractorName = document.getElementById('tel-attractor-name');
    dom.telAttractorDelta = document.getElementById('tel-attractor-delta');
    dom.telAttractorLyap = document.getElementById('tel-attractor-lyap');
    dom.telEigenPair = document.getElementById('tel-eigen-pair');
    dom.telEigenKSq = document.getElementById('tel-eigen-ksq');
    dom.telEigenNodal = document.getElementById('tel-eigen-nodal');

    // Marginalia sparkline canvases
    dom.sparkNBody = document.getElementById('spark-nbody');
    dom.sparkFourier = document.getElementById('spark-fourier');
    dom.sparkAttractor = document.getElementById('spark-attractor');
    dom.sparkEigen = document.getElementById('spark-eigen');

    // Synced sliders
    dom.sliderEigenN = document.getElementById('slider-eigen-n');
    dom.valEigenN = document.getElementById('val-eigen-n');
    dom.sliderEigenM = document.getElementById('slider-eigen-m');
    dom.valEigenM = document.getElementById('val-eigen-m');
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

  function syncAttractorPills(idx) {
    if (!dom.attractorPills) return;
    dom.attractorPills.forEach((btn) => {
      const preset = parseInt(btn.getAttribute('data-attractor-preset'), 10);
      btn.classList.toggle('is-active', preset === idx);
    });
  }

  function syncEigenSliders(n, m) {
    if (dom.sliderEigenN) dom.sliderEigenN.value = String(n);
    if (dom.valEigenN) dom.valEigenN.textContent = String(n);
    if (dom.sliderEigenM) dom.sliderEigenM.value = String(m);
    if (dom.valEigenM) dom.valEigenM.textContent = String(m);
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

    // Sync each plate's active state against its true data-mode attribute
    dom.plateSections.forEach((plateEl) => {
      const plateMode = parseInt(plateEl.getAttribute('data-mode') || '-1', 10);
      const veilEl = plateEl.querySelector('.editorial-veil');
      const statusEl = plateEl.querySelector('.plate-mode-status');
      const isActive = activeMode === plateMode;

      if (veilEl) {
        veilEl.classList.toggle('is-active-plate', isActive);
      }

      if (!statusEl) return;
      const dot = statusEl.querySelector('.mode-dot');
      const txt = statusEl.querySelector('.mode-state-label');
      if (isActive) {
        if (dot) dot.style.backgroundColor = 'var(--accent)';
        if (txt) {
          txt.textContent = state.lockedMode === plateMode ? 'LOCKED IN MANIFOLD' : 'LIVE IN MANIFOLD';
          txt.style.color = 'var(--accent)';
        }
      } else {
        if (dot) dot.style.backgroundColor = 'var(--rule-strong)';
        if (txt) {
          txt.textContent = 'STANDBY';
          txt.style.color = 'var(--ink-muted)';
        }
      }
    });
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

  /* -----------------------------------------------------------------------
     HAIRLINE MARGINALIA SPARKLINE & MODAL LATTICE RENDERERS
     ----------------------------------------------------------------------- */
  function drawSparkline(canvasEl, values, fixedMin, fixedMax) {
    if (!canvasEl) return;
    const c = canvasEl.getContext('2d');
    if (!c) return;
    const w = canvasEl.width;
    const h = canvasEl.height;
    const ink = state.palette.inkRGB;
    const accent = state.palette.accentRGB;

    c.clearRect(0, 0, w, h);

    // Subtle baseline & midpoint hairline rules
    c.strokeStyle = rgba(ink, 0.14);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, h - 4.5);
    c.lineTo(w, h - 4.5);
    c.stroke();

    c.setLineDash([2, 3]);
    c.strokeStyle = rgba(ink, 0.09);
    c.beginPath();
    c.moveTo(0, Math.floor(h * 0.5) + 0.5);
    c.lineTo(w, Math.floor(h * 0.5) + 0.5);
    c.stroke();
    c.setLineDash([]);

    if (!values || values.length < 2) return;

    let minV = fixedMin !== undefined ? fixedMin : Math.min(...values);
    let maxV = fixedMax !== undefined ? fixedMax : Math.max(...values);
    if (maxV - minV < 1e-4) {
      minV -= 0.5;
      maxV += 0.5;
    }

    const padX = 3;
    const padY = 6;
    const plotW = w - padX * 2;
    const plotH = h - padY * 2;

    c.strokeStyle = rgba(accent, 0.88);
    c.lineWidth = 1.15;
    c.beginPath();
    let lastX = padX;
    let lastY = padY + plotH;
    for (let i = 0; i < values.length; i++) {
      const x = padX + (i / Math.max(1, values.length - 1)) * plotW;
      const norm = (values[i] - minV) / (maxV - minV);
      const y = padY + (1 - Math.max(0, Math.min(1, norm))) * plotH;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
      lastX = x;
      lastY = y;
    }
    c.stroke();

    // Active head square
    c.fillStyle = rgba(ink, 0.95);
    c.fillRect(lastX - 1.5, lastY - 1.5, 3, 3);
  }

  function drawEigenLattice(canvasEl, activeN, activeM) {
    if (!canvasEl) return;
    const c = canvasEl.getContext('2d');
    if (!c) return;
    const w = canvasEl.width;
    const h = canvasEl.height;
    const ink = state.palette.inkRGB;
    const accent = state.palette.accentRGB;

    c.clearRect(0, 0, w, h);

    const maxMode = 9;
    const padX = 10;
    const padY = 7;
    const stepX = (w - padX * 2) / (maxMode - 1);
    const stepY = (h - padY * 2) / (maxMode - 1);

    // Draw iso-eigenvalue quarter-arc through (n, m)
    const rN = (activeN - 1) * stepX;
    const rM = (activeM - 1) * stepY;
    c.strokeStyle = rgba(accent, 0.35);
    c.lineWidth = 0.85;
    c.beginPath();
    c.ellipse(padX, h - padY, Math.hypot(rN, rM), Math.hypot(rN, rM) * (stepY / stepX), 0, -Math.PI * 0.5, 0);
    c.stroke();

    // Draw 9x9 eigenvalue lattice points
    for (let m = 1; m <= maxMode; m++) {
      for (let n = 1; n <= maxMode; n++) {
        const x = padX + (n - 1) * stepX;
        const y = h - padY - (m - 1) * stepY;
        const isCurrent = n === activeN && m === activeM;
        const isSym = n === activeM && m === activeN;

        if (isCurrent) {
          c.fillStyle = rgba(accent, 1.0);
          c.fillRect(x - 2.5, y - 2.5, 5, 5);
        } else if (isSym) {
          c.strokeStyle = rgba(accent, 0.75);
          c.lineWidth = 1;
          c.strokeRect(x - 2, y - 2, 4, 4);
        } else {
          c.fillStyle = rgba(ink, 0.22);
          c.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
        }
      }
    }
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

    if (dom.telNBodyN) dom.telNBodyN.textContent = String(state.telemetry.nbodyCount);
    if (dom.telNBodyNodes) dom.telNBodyNodes.textContent = String(state.telemetry.nbodyQuadNodes);
    if (dom.sparkNBody) drawSparkline(dom.sparkNBody, state.telemetry.nbodyNodesHistory);

    if (dom.telFourierPreset) dom.telFourierPreset.textContent = state.telemetry.fourierPresetName;
    if (dom.telFourierTheta) dom.telFourierTheta.textContent = `${state.telemetry.fourierTheta.toFixed(2)} rad`;
    if (dom.telFourierRadius) dom.telFourierRadius.textContent = state.telemetry.fourierRadius.toFixed(2);
    if (dom.sparkFourier) drawSparkline(dom.sparkFourier, state.telemetry.fourierRadiusHistory, 0, 1.15);

    if (dom.telAttractorName) dom.telAttractorName.textContent = state.telemetry.attractorName;
    if (dom.telAttractorDelta) dom.telAttractorDelta.textContent = state.telemetry.attractorDelta.toFixed(3);
    if (dom.telAttractorLyap) dom.telAttractorLyap.textContent = state.telemetry.attractorLyap.toFixed(3);
    if (dom.sparkAttractor) drawSparkline(dom.sparkAttractor, state.telemetry.attractorLyapHistory);

    if (dom.telEigenPair) dom.telEigenPair.textContent = `(${state.params.eigenN}, ${state.params.eigenM})`;
    if (dom.telEigenKSq) dom.telEigenKSq.textContent = String(state.telemetry.eigenKSq);
    if (dom.telEigenNodal) dom.telEigenNodal.textContent = `${state.telemetry.eigenNodalPct}%`;
    if (dom.sparkEigen) drawEigenLattice(dom.sparkEigen, state.params.eigenN, state.params.eigenM);
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

    // Mode 1: N-Body Controls (Plate I)
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

    // Mode 3: Fourier Epicycles Controls (Plate II)
    const sliderFourierN = document.getElementById('slider-fourier-n');
    const valFourierN = document.getElementById('val-fourier-n');
    if (sliderFourierN && valFourierN) {
      sliderFourierN.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        state.params.fourierHarmonics = v;
        valFourierN.textContent = String(v);
        if (Manifold.fields.graph && Manifold.fields.graph.clearTrail) {
          Manifold.fields.graph.clearTrail();
        }
      });
    }

    const sliderFourierSpeed = document.getElementById('slider-fourier-speed');
    const valFourierSpeed = document.getElementById('val-fourier-speed');
    if (sliderFourierSpeed && valFourierSpeed) {
      sliderFourierSpeed.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        state.params.fourierSpeed = v;
        valFourierSpeed.textContent = `${v.toFixed(2)}×`;
      });
    }

    const btnFourierCycle = document.getElementById('btn-fourier-cycle');
    if (btnFourierCycle) {
      btnFourierCycle.addEventListener('click', () => {
        if (Manifold.fields.graph && Manifold.fields.graph.cyclePreset) {
          Manifold.fields.graph.cyclePreset();
        }
      });
    }

    const btnFourierReset = document.getElementById('btn-fourier-reset');
    if (btnFourierReset) {
      btnFourierReset.addEventListener('click', () => Manifold.fields.graph.reset());
    }

    // Mode 5: Strange Attractors Controls (Plate III)
    dom.attractorPills.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-attractor-preset'), 10);
        if (Manifold.fields.attractor && Manifold.fields.attractor.setPreset) {
          Manifold.fields.attractor.setPreset(idx, false);
        }
      });
    });

    const sliderRho = document.getElementById('slider-attractor-rho');
    const valRho = document.getElementById('val-attractor-rho');
    if (sliderRho && valRho) {
      sliderRho.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        state.params.attractorRho = v;
        valRho.textContent = v.toFixed(1);
      });
    }

    const sliderAttSpeed = document.getElementById('slider-attractor-speed');
    const valAttSpeed = document.getElementById('val-attractor-speed');
    if (sliderAttSpeed && valAttSpeed) {
      sliderAttSpeed.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        state.params.attractorSpeed = v;
        valAttSpeed.textContent = `${v.toFixed(2)}×`;
      });
    }

    const btnAttReseed = document.getElementById('btn-attractor-reseed');
    if (btnAttReseed) {
      btnAttReseed.addEventListener('click', () => {
        if (Manifold.fields.attractor && Manifold.fields.attractor.reseed) {
          Manifold.fields.attractor.reseed();
        }
      });
    }

    // Mode 6: Helmholtz Eigenmodes Controls (Plate IV)
    if (dom.sliderEigenN && dom.valEigenN) {
      dom.sliderEigenN.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        state.params.eigenN = v;
        dom.valEigenN.textContent = String(v);
      });
    }

    if (dom.sliderEigenM && dom.valEigenM) {
      dom.sliderEigenM.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        state.params.eigenM = v;
        dom.valEigenM.textContent = String(v);
      });
    }

    const btnEigenImpulse = document.getElementById('btn-eigen-impulse');
    if (btnEigenImpulse) {
      btnEigenImpulse.addEventListener('click', () => {
        if (Manifold.fields.eigenmode && Manifold.fields.eigenmode.scatter) {
          Manifold.fields.eigenmode.scatter();
        }
      });
    }

    const btnEigenCycle = document.getElementById('btn-eigen-cycle');
    if (btnEigenCycle) {
      btnEigenCycle.addEventListener('click', () => {
        if (Manifold.fields.eigenmode && Manifold.fields.eigenmode.cyclePreset) {
          Manifold.fields.eigenmode.cyclePreset();
        }
      });
    }

    // § 03 Interactive Axiom Derivation Drawers
    const axiomTriggers = Array.from(document.querySelectorAll('.axiom-trigger'));
    axiomTriggers.forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.axiom-item');
        if (!item) return;
        const willOpen = !item.classList.contains('is-open');
        item.classList.toggle('is-open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
        const marker = btn.querySelector('.axiom-marker');
        if (marker) marker.textContent = willOpen ? '−' : '+';
      });
    });

    const jumpButtons = Array.from(document.querySelectorAll('[data-jump-mode]'));
    jumpButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = parseInt(btn.getAttribute('data-jump-mode'), 10);
        if (Number.isNaN(m)) return;
        state.lockedMode = m;
        updateScrollTargets();
        Manifold.notify(`FIELD LOCKED · ${MODE_META[m].label}`);
      });
    });
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
    updateTelemetryReadouts,
    syncAttractorPills,
    syncEigenSliders
  };
})(window);
