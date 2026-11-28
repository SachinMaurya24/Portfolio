/* =========================================================================
   FIELD DOCK PARAMETER LAB & MONOGRAPH PNG PLATE EXPORTER
   - Exposes live sliders & actions for ALL 7 mathematical fields (including
     Mode 2 Stochastic SDE & Mode 4 Latency Flow) directly in the Field Dock
   - Stays interactive in Inspect Field mode
   - Composites & downloads high-res PNG plates with archival monograph stamp
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold;
  const { state, MODE_META, rgba } = Manifold;

  let labOpen = false;
  let renderedMode = -1;
  let panelEl = null;
  let bodyEl = null;
  let titleEl = null;
  let toggleBtn = null;
  let exportBtn = null;

  function syncPlateControl(id, value, valTextId, formatted) {
    const el = document.getElementById(id);
    if (el && el.value !== String(value)) el.value = String(value);
    if (valTextId) {
      const vEl = document.getElementById(valTextId);
      if (vEl) vEl.textContent = formatted;
    }
  }

  function buildSliderRow(cfg) {
    const wrap = document.createElement('div');
    wrap.className = 'space-y-0.5';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between text-[9.5px] tracking-[0.08em]';

    const label = document.createElement('label');
    label.className = 'uppercase text-ink';
    label.textContent = cfg.label;

    const valSpan = document.createElement('span');
    valSpan.className = 'text-accent tabular-nums';
    valSpan.textContent = cfg.format(cfg.value);

    header.appendChild(label);
    header.appendChild(valSpan);

    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'manifold-slider dock-slider';
    input.min = String(cfg.min);
    input.max = String(cfg.max);
    input.step = String(cfg.step);
    input.value = String(cfg.value);
    input.setAttribute('aria-label', cfg.label);

    input.addEventListener('input', (e) => {
      const v = cfg.isInt ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
      valSpan.textContent = cfg.format(v);
      cfg.onChange(v);
    });

    wrap.appendChild(header);
    wrap.appendChild(input);
    return wrap;
  }

  function buildActionRow(actions) {
    const row = document.createElement('div');
    row.className = 'flex flex-wrap items-center gap-1.5 pt-1';

    actions.forEach((act) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `hairline-btn px-2 py-1 text-[9px] tracking-[0.1em] uppercase${act.active ? ' is-active' : ''}`;
      btn.textContent = act.label;
      btn.addEventListener('click', () => {
        act.onClick(btn);
      });
      row.appendChild(btn);
    });

    return row;
  }

  function renderControlsForMode(mode) {
    if (!bodyEl) return;
    renderedMode = mode;
    bodyEl.innerHTML = '';

    if (titleEl && MODE_META[mode]) {
      titleEl.textContent = `LAB · ${MODE_META[mode].label}`;
    }

    if (mode === 0) {
      bodyEl.appendChild(
        buildSliderRow({
          label: 'M (Well Depth)',
          min: 0.15,
          max: 0.70,
          step: 0.05,
          value: state.params.scalarWellStrength,
          format: (v) => v.toFixed(2),
          onChange: (v) => {
            state.params.scalarWellStrength = v;
          }
        })
      );
      bodyEl.appendChild(
        buildActionRow([
          {
            label: state.params.scalarStreamlines ? '[ STREAMLINES: ON ]' : '[ STREAMLINES: OFF ]',
            active: state.params.scalarStreamlines,
            onClick: (btn) => {
              state.params.scalarStreamlines = !state.params.scalarStreamlines;
              btn.classList.toggle('is-active', state.params.scalarStreamlines);
              btn.textContent = state.params.scalarStreamlines ? '[ STREAMLINES: ON ]' : '[ STREAMLINES: OFF ]';
              const mainBtn = document.getElementById('btn-scalar-streamlines');
              if (mainBtn) {
                mainBtn.classList.toggle('is-active', state.params.scalarStreamlines);
                mainBtn.textContent = btn.textContent;
              }
            }
          },
          {
            label: '[ CLEAR WELLS ]',
            onClick: () => Manifold.fields.scalar && Manifold.fields.scalar.clearWells()
          }
        ])
      );
    } else if (mode === 1) {
      bodyEl.appendChild(
        buildSliderRow({
          label: 'Δt (Time Step)',
          min: 0.20,
          max: 2.50,
          step: 0.05,
          value: state.params.nbodyDt,
          format: (v) => `${v.toFixed(2)}×`,
          onChange: (v) => {
            state.params.nbodyDt = v;
            syncPlateControl('slider-nbody', v, 'val-nbody', `${v.toFixed(2)}×`);
          }
        })
      );
      bodyEl.appendChild(
        buildSliderRow({
          label: 'θ (Opening Angle)',
          min: 0.20,
          max: 1.40,
          step: 0.05,
          value: state.params.nbodyTheta,
          format: (v) => v.toFixed(2),
          onChange: (v) => {
            state.params.nbodyTheta = v;
            syncPlateControl('slider-theta', v, 'val-theta', v.toFixed(2));
          }
        })
      );
      bodyEl.appendChild(
        buildActionRow([
          {
            label: state.params.nbodyShowQuadtree ? '[ QUADTREE: ON ]' : '[ QUADTREE: OFF ]',
            active: state.params.nbodyShowQuadtree,
            onClick: (btn) => {
              state.params.nbodyShowQuadtree = !state.params.nbodyShowQuadtree;
              btn.classList.toggle('is-active', state.params.nbodyShowQuadtree);
              btn.textContent = state.params.nbodyShowQuadtree ? '[ QUADTREE: ON ]' : '[ QUADTREE: OFF ]';
              const mainBtn = document.getElementById('btn-nbody-quad');
              if (mainBtn) {
                mainBtn.classList.toggle('is-active', state.params.nbodyShowQuadtree);
                mainBtn.textContent = btn.textContent;
              }
            }
          },
          {
            label: '[ RESET ]',
            onClick: () => Manifold.fields.nbody && Manifold.fields.nbody.reset()
          }
        ])
      );
    } else if (mode === 2) {
      bodyEl.appendChild(
        buildSliderRow({
          label: 'σ (Volatility)',
          min: 0.15,
          max: 1.80,
          step: 0.05,
          value: state.params.stochSigma,
          format: (v) => v.toFixed(2),
          onChange: (v) => {
            state.params.stochSigma = v;
          }
        })
      );
      bodyEl.appendChild(
        buildSliderRow({
          label: 'κ (Mean Reversion)',
          min: 0.005,
          max: 0.15,
          step: 0.005,
          value: state.params.stochKappa,
          format: (v) => v.toFixed(3),
          onChange: (v) => {
            state.params.stochKappa = v;
          }
        })
      );
      bodyEl.appendChild(
        buildActionRow([
          {
            label: '[ RESEED WIENER ]',
            onClick: () => Manifold.fields.stochastic && Manifold.fields.stochastic.reseed(false)
          }
        ])
      );
    } else if (mode === 3) {
      bodyEl.appendChild(
        buildSliderRow({
          label: 'N (Harmonics)',
          min: 1,
          max: 5,
          step: 1,
          isInt: true,
          value: state.params.fourierHarmonics,
          format: (v) => String(v),
          onChange: (v) => {
            state.params.fourierHarmonics = v;
            syncPlateControl('slider-fourier-n', v, 'val-fourier-n', String(v));
            if (Manifold.fields.graph && Manifold.fields.graph.clearTrail) {
              Manifold.fields.graph.clearTrail();
            }
          }
        })
      );
      bodyEl.appendChild(
        buildSliderRow({
          label: 'ω (Angular Speed)',
          min: 0.30,
          max: 2.20,
          step: 0.05,
          value: state.params.fourierSpeed,
          format: (v) => `${v.toFixed(2)}×`,
          onChange: (v) => {
            state.params.fourierSpeed = v;
            syncPlateControl('slider-fourier-speed', v, 'val-fourier-speed', `${v.toFixed(2)}×`);
          }
        })
      );
      bodyEl.appendChild(
        buildActionRow([
          {
            label: '[ CYCLE PRESET ]',
            onClick: () => Manifold.fields.graph && Manifold.fields.graph.cyclePreset && Manifold.fields.graph.cyclePreset()
          },
          {
            label: '[ RESET ]',
            onClick: () => Manifold.fields.graph && Manifold.fields.graph.reset()
          }
        ])
      );
    } else if (mode === 4) {
      bodyEl.appendChild(
        buildSliderRow({
          label: 'λ (Arrival Rate)',
          min: 0.25,
          max: 2.20,
          step: 0.05,
          value: state.params.flowLambda,
          format: (v) => `${v.toFixed(2)}×`,
          onChange: (v) => {
            state.params.flowLambda = v;
          }
        })
      );
      bodyEl.appendChild(
        buildActionRow([
          {
            label: '[ +TRAFFIC BURST ]',
            onClick: () => Manifold.fields.flow && Manifold.fields.flow.injectBurst()
          },
          {
            label: '[ CLEAR FAULTS ]',
            onClick: () => Manifold.fields.flow && Manifold.fields.flow.clearFaults()
          }
        ])
      );
    } else if (mode === 5) {
      bodyEl.appendChild(
        buildSliderRow({
          label: 'ρ (Rayleigh)',
          min: 14.0,
          max: 38.0,
          step: 0.5,
          value: state.params.attractorRho,
          format: (v) => v.toFixed(1),
          onChange: (v) => {
            state.params.attractorRho = v;
            syncPlateControl('slider-attractor-rho', v, 'val-attractor-rho', v.toFixed(1));
          }
        })
      );
      bodyEl.appendChild(
        buildSliderRow({
          label: 'dt (Integration)',
          min: 0.30,
          max: 2.20,
          step: 0.05,
          value: state.params.attractorSpeed,
          format: (v) => `${v.toFixed(2)}×`,
          onChange: (v) => {
            state.params.attractorSpeed = v;
            syncPlateControl('slider-attractor-speed', v, 'val-attractor-speed', `${v.toFixed(2)}×`);
          }
        })
      );
      bodyEl.appendChild(
        buildActionRow([
          {
            label: '[ CYCLE SYSTEM ]',
            onClick: () => {
              if (Manifold.fields.attractor && Manifold.fields.attractor.setPreset) {
                const next = ((state.params.attractorPreset || 0) + 1) % 4;
                Manifold.fields.attractor.setPreset(next, false);
              }
            }
          },
          {
            label: '[ RE-SEED δ₀ ]',
            onClick: () => Manifold.fields.attractor && Manifold.fields.attractor.reseed && Manifold.fields.attractor.reseed()
          }
        ])
      );
    } else if (mode === 6) {
      bodyEl.appendChild(
        buildSliderRow({
          label: 'n (Wave Number)',
          min: 1,
          max: 9,
          step: 1,
          isInt: true,
          value: state.params.eigenN,
          format: (v) => String(v),
          onChange: (v) => {
            state.params.eigenN = v;
            syncPlateControl('slider-eigen-n', v, 'val-eigen-n', String(v));
          }
        })
      );
      bodyEl.appendChild(
        buildSliderRow({
          label: 'm (Conjugate)',
          min: 1,
          max: 9,
          step: 1,
          isInt: true,
          value: state.params.eigenM,
          format: (v) => String(v),
          onChange: (v) => {
            state.params.eigenM = v;
            syncPlateControl('slider-eigen-m', v, 'val-eigen-m', String(v));
          }
        })
      );
      bodyEl.appendChild(
        buildActionRow([
          {
            label: '[ IMPULSE ]',
            onClick: () => Manifold.fields.eigenmode && Manifold.fields.eigenmode.scatter && Manifold.fields.eigenmode.scatter()
          },
          {
            label: '[ CYCLE (n,m) ]',
            onClick: () => {
              if (Manifold.fields.eigenmode && Manifold.fields.eigenmode.cyclePreset) {
                Manifold.fields.eigenmode.cyclePreset();
                renderControlsForMode(6);
              }
            }
          }
        ])
      );
    }
  }

  function getParamSummary(mode) {
    const p = state.params;
    const t = state.telemetry;
    if (mode === 0) return `∇f(x,y) · WELLS=${t.scalarWellsCount}`;
    if (mode === 1) return `N=${t.nbodyCount} · θ=${p.nbodyTheta.toFixed(2)} · Δt=${p.nbodyDt.toFixed(2)}×`;
    if (mode === 2) return `OU SDE · σ=${p.stochSigma.toFixed(2)} · κ=${p.stochKappa.toFixed(3)}`;
    if (mode === 3) return `${t.fourierPresetName} · N=${p.fourierHarmonics} · ω=${p.fourierSpeed.toFixed(2)}×`;
    if (mode === 4) return `QUEUE FLOW · λ=${p.flowLambda.toFixed(2)}× · ${t.flowMeanLatency.toFixed(1)}ms`;
    if (mode === 5) return `${t.attractorName} · ρ=${p.attractorRho.toFixed(1)} · λ≈${t.attractorLyap.toFixed(3)}`;
    if (mode === 6) return `HELMHOLTZ (n,m)=(${p.eigenN},${p.eigenM}) · k²/π²=${t.eigenKSq}`;
    return '';
  }

  function exportPlatePNG() {
    const srcCanvas = document.getElementById('manifold-canvas');
    if (!srcCanvas) return;

    try {
      const mode = Manifold.getActiveMode();
      const meta = MODE_META[mode] || { label: 'LIVING MANIFOLD' };
      const out = document.createElement('canvas');
      out.width = srcCanvas.width;
      out.height = srcCanvas.height;
      const octx = out.getContext('2d');
      if (!octx) return;

      // Copy live canvas frame
      octx.drawImage(srcCanvas, 0, 0);

      // Stamp archival 1px frame & monograph plate metadata
      const dpr = state.dpr || 1;
      const w = out.width;
      const h = out.height;
      const pad = Math.round(18 * dpr);
      const ink = state.palette.inkRGB;
      const accent = state.palette.accentRGB;

      octx.strokeStyle = rgba(ink, 0.25);
      octx.lineWidth = Math.max(1, dpr);
      octx.strokeRect(pad, pad, w - pad * 2, h - pad * 2);

      // Bottom monograph caption bar
      const barH = Math.round(34 * dpr);
      octx.fillStyle = state.theme === 'obsidian' ? 'rgba(10,11,13,0.82)' : 'rgba(246,244,238,0.86)';
      octx.fillRect(pad + 1, h - pad - barH, w - pad * 2 - 2, barH - 1);

      octx.strokeStyle = rgba(ink, 0.2);
      octx.beginPath();
      octx.moveTo(pad, h - pad - barH);
      octx.lineTo(w - pad, h - pad - barH);
      octx.stroke();

      const fontSize = Math.round(10.5 * dpr);
      octx.font = `${fontSize}px "IBM Plex Mono", ui-monospace, monospace`;
      octx.textBaseline = 'middle';
      const textY = h - pad - barH * 0.5;

      octx.fillStyle = rgba(accent, 0.95);
      octx.fillText(`THE LIVING MANIFOLD · ${meta.label}`, pad + Math.round(12 * dpr), textY);

      const rightStamp = `${getParamSummary(mode)}  ·  SACHIN MAURYA`;
      const tw = octx.measureText(rightStamp).width;
      octx.fillStyle = rgba(ink, 0.78);
      octx.fillText(rightStamp, w - pad - Math.round(12 * dpr) - tw, textY);

      const url = out.toDataURL('image/png');
      const a = document.createElement('a');
      const slug = meta.short ? meta.short.toLowerCase().replace(/[^a-z0-9]+/g, '') : `mode-${mode}`;
      a.download = `living-manifold-plate-${mode}-${slug || 'field'}.png`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      Manifold.notify(`PLATE EXPORTED · PNG SAVED`);
    } catch (_) {
      Manifold.notify('UNABLE TO EXPORT CANVAS');
    }
  }

  function setLabOpen(open) {
    labOpen = open;
    if (panelEl) panelEl.classList.toggle('is-open', open);
    if (toggleBtn) {
      toggleBtn.classList.toggle('is-active', open);
      toggleBtn.setAttribute('aria-expanded', String(open));
    }
    if (open) {
      renderControlsForMode(Manifold.getActiveMode());
    }
  }

  function syncActiveMode() {
    const mode = Manifold.getActiveMode();
    if (labOpen && mode !== renderedMode) {
      renderControlsForMode(mode);
    }
  }

  function init() {
    panelEl = document.getElementById('dock-lab-panel');
    bodyEl = document.getElementById('dock-lab-body');
    titleEl = document.getElementById('dock-lab-title');
    toggleBtn = document.getElementById('dock-lab-btn');
    exportBtn = document.getElementById('dock-export-btn');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => setLabOpen(!labOpen));
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', exportPlatePNG);
    }
  }

  Manifold.dockLab = {
    init,
    syncActiveMode,
    setOpen: setLabOpen,
    exportPlatePNG
  };
})(window);
