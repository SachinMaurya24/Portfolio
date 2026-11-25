/* =========================================================================
   MODE 4: DETERMINISTIC LATENCY-FLOW & QUEUEING SYSTEM DIAGRAM
   Interactive features:
   - Click any switch node to manually fault / recover it
   - Trigger traffic bursts to observe deterministic diagonal failover
   - Clear all manual faults & live arrival rate λ slider
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold;
  const { state, pointer, rgba } = Manifold;

  const FLOW_LANES = 5;
  const FLOW_STAGES = 4;
  let flowNodes = [];
  let flowPackets = [];
  let flowSpawnAccum = 0;

  function init() {
    const prevFaults = new Set(
      flowNodes.filter((n) => n.manualFault).map((n) => `${n.lane}-${n.stage}`)
    );
    flowNodes = [];
    const w = state.width;
    const h = state.height;
    const isDesktop = w >= 1024;
    const leftX = isDesktop ? w * 0.44 : w * 0.12;
    const rightX = w * 0.92;
    const topY = h * 0.20;
    const botY = h * 0.80;

    for (let lane = 0; lane < FLOW_LANES; lane++) {
      const y = topY + ((botY - topY) * lane) / (FLOW_LANES - 1);
      for (let stage = 0; stage < FLOW_STAGES; stage++) {
        const x = leftX + ((rightX - leftX) * stage) / (FLOW_STAGES - 1);
        const key = `${lane}-${stage}`;
        flowNodes.push({
          lane,
          stage,
          x,
          y,
          queue: 0.12 + Math.random() * 0.15,
          congested: false,
          manualFault: prevFaults.has(key)
        });
      }
    }
  }

  function getFlowNode(lane, stage) {
    return flowNodes[lane * FLOW_STAGES + stage];
  }

  function handleClick(x, y) {
    let hit = null;
    let bestD = 26;
    for (let i = 0; i < flowNodes.length; i++) {
      const d = Math.hypot(flowNodes[i].x - x, flowNodes[i].y - y);
      if (d < bestD) {
        bestD = d;
        hit = flowNodes[i];
      }
    }

    if (hit) {
      hit.manualFault = !hit.manualFault;
      const faults = flowNodes.filter((n) => n.manualFault).length;
      state.telemetry.flowFaultCount = faults;
      Manifold.notify(
        hit.manualFault
          ? `SWITCH L${hit.lane + 1}·S0${hit.stage + 1} FAULTED`
          : `SWITCH L${hit.lane + 1}·S0${hit.stage + 1} RECOVERED`
      );
    } else {
      injectBurst();
    }
  }

  function injectBurst() {
    for (let i = 0; i < 16; i++) {
      if (flowPackets.length >= 110) break;
      const lane = i % FLOW_LANES;
      flowPackets.push({
        fromLane: lane,
        toLane: lane,
        stage: -1,
        t: Math.random() * 0.25,
        speed: 0.018 + Math.random() * 0.008,
        rerouted: false
      });
    }
    Manifold.notify('TRAFFIC BURST INJECTED (+16 REQ)');
  }

  function clearFaults() {
    for (let i = 0; i < flowNodes.length; i++) {
      flowNodes[i].manualFault = false;
    }
    state.telemetry.flowFaultCount = 0;
    Manifold.notify('ALL SWITCH FAULTS CLEARED');
  }

  function render(ctx, alpha) {
    if (flowNodes.length === 0) init();

    const lambda = state.params.flowLambda;
    const ink = state.palette.inkRGB;
    const accent = state.palette.accentRGB;

    let totalQueue = 0;
    let faults = 0;
    for (let i = 0; i < flowNodes.length; i++) {
      const nd = flowNodes[i];
      const d = Math.hypot(nd.x - pointer.x, nd.y - pointer.y);
      const cursorPressure = Math.exp(-(d * d) / 14500) * 0.88;
      const targetQ = nd.manualFault
        ? 0.98
        : Math.min(1.0, 0.10 + lambda * 0.16 + cursorPressure);

      if (!state.paused) {
        nd.queue += (targetQ - nd.queue) * 0.09;
      }
      nd.congested = nd.manualFault || nd.queue > 0.56;
      if (nd.manualFault) faults++;
      totalQueue += nd.queue;
    }

    state.telemetry.flowFaultCount = faults;
    state.telemetry.flowMeanLatency = 8.2 + (totalQueue / flowNodes.length) * 34.0 + lambda * 2.4;

    // Spawn laminar packets proportional to arrival rate λ
    if (!state.paused) {
      flowSpawnAccum += lambda * 0.18;
      while (flowSpawnAccum >= 1) {
        flowSpawnAccum -= 1;
        if (flowPackets.length < 85) {
          const lane = Math.floor(Math.random() * FLOW_LANES);
          flowPackets.push({
            fromLane: lane,
            toLane: lane,
            stage: -1,
            t: 0,
            speed: 0.015 + Math.random() * 0.006,
            rerouted: false
          });
        }
      }
    }

    // Horizontal rails & diagonal failover bypass conduits
    const railExtend = 70;
    for (let lane = 0; lane < FLOW_LANES; lane++) {
      const first = getFlowNode(lane, 0);
      const last = getFlowNode(lane, FLOW_STAGES - 1);

      ctx.strokeStyle = rgba(ink, alpha * 0.18);
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(first.x - railExtend, first.y);
      ctx.lineTo(last.x + railExtend, last.y);
      ctx.stroke();

      for (let stage = 0; stage < FLOW_STAGES - 1; stage++) {
        const a = getFlowNode(lane, stage);
        if (lane > 0) {
          const bUp = getFlowNode(lane - 1, stage + 1);
          ctx.strokeStyle = rgba(ink, alpha * 0.07);
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(bUp.x, bUp.y);
          ctx.stroke();
        }
        if (lane < FLOW_LANES - 1) {
          const bDn = getFlowNode(lane + 1, stage + 1);
          ctx.strokeStyle = rgba(ink, alpha * 0.07);
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(bDn.x, bDn.y);
          ctx.stroke();
        }
      }
    }

    // Advance & render laminar packets
    let activeReroutes = 0;
    for (let i = flowPackets.length - 1; i >= 0; i--) {
      const pk = flowPackets[i];
      if (!state.paused) {
        const curSpeed = pk.speed * (0.65 + lambda * 0.45);
        pk.t += curSpeed;

        if (pk.t >= 1) {
          pk.t = 0;
          pk.stage += 1;
          pk.fromLane = pk.toLane;

          if (pk.stage >= FLOW_STAGES) {
            flowPackets.splice(i, 1);
            continue;
          }

          if (pk.stage < FLOW_STAGES - 1) {
            const ahead = getFlowNode(pk.fromLane, pk.stage + 1);
            if (ahead.congested) {
              const candidates = [];
              if (pk.fromLane > 0) candidates.push(pk.fromLane - 1);
              if (pk.fromLane < FLOW_LANES - 1) candidates.push(pk.fromLane + 1);
              let bestLane = pk.fromLane;
              let bestQ = ahead.queue;
              for (let c = 0; c < candidates.length; c++) {
                const candQ = getFlowNode(candidates[c], pk.stage + 1).queue;
                if (candQ < bestQ) {
                  bestQ = candQ;
                  bestLane = candidates[c];
                }
              }
              pk.toLane = bestLane;
              pk.rerouted = (bestLane !== pk.fromLane);
            } else {
              pk.toLane = pk.fromLane;
              pk.rerouted = false;
            }
          } else {
            pk.toLane = pk.fromLane;
            pk.rerouted = false;
          }
        }
      }

      let px, py;
      if (pk.stage === -1) {
        const target = getFlowNode(pk.toLane, 0);
        px = (target.x - railExtend) + pk.t * railExtend;
        py = target.y;
      } else if (pk.stage === FLOW_STAGES - 1) {
        const src = getFlowNode(pk.fromLane, FLOW_STAGES - 1);
        px = src.x + pk.t * railExtend;
        py = src.y;
      } else {
        const src = getFlowNode(pk.fromLane, pk.stage);
        const dst = getFlowNode(pk.toLane, pk.stage + 1);
        px = src.x + (dst.x - src.x) * pk.t;
        py = src.y + (dst.y - src.y) * pk.t;

        if (pk.rerouted) {
          activeReroutes++;
          ctx.strokeStyle = rgba(accent, alpha * 0.35);
          ctx.lineWidth = 0.85;
          ctx.beginPath();
          ctx.moveTo(src.x, src.y);
          ctx.lineTo(dst.x, dst.y);
          ctx.stroke();
        }
      }

      ctx.fillStyle = pk.rerouted
        ? rgba(accent, alpha * 0.92)
        : rgba(ink, alpha * 0.78);
      ctx.fillRect(px - 2.2, py - 2.2, 4.4, 4.4);
    }

    state.telemetry.flowReroutes = activeReroutes;
    state.telemetry.flowPacketCount = flowPackets.length;

    // Render discrete nodal switches & micro-bar queue indicators
    ctx.font = '9px "IBM Plex Mono", monospace';
    for (let i = 0; i < flowNodes.length; i++) {
      const nd = flowNodes[i];
      const col = nd.congested ? accent : ink;

      ctx.fillStyle = state.palette.bg;
      ctx.fillRect(nd.x - 5.5, nd.y - 5.5, 11, 11);
      ctx.strokeStyle = rgba(col, alpha * (nd.congested ? 0.9 : 0.45));
      ctx.lineWidth = nd.manualFault ? 1.3 : 0.9;
      ctx.strokeRect(nd.x - 5.5, nd.y - 5.5, 11, 11);

      // Draw crisp X inside manually faulted switch
      if (nd.manualFault) {
        ctx.beginPath();
        ctx.moveTo(nd.x - 3, nd.y - 3);
        ctx.lineTo(nd.x + 3, nd.y + 3);
        ctx.moveTo(nd.x + 3, nd.y - 3);
        ctx.lineTo(nd.x - 3, nd.y + 3);
        ctx.strokeStyle = rgba(accent, alpha * 0.95);
        ctx.stroke();
      }

      // Micro-bar queue depth indicator
      const barW = 20;
      const barH = 3;
      const bx = nd.x - barW * 0.5;
      const by = nd.y - 14;
      ctx.strokeStyle = rgba(ink, alpha * 0.18);
      ctx.lineWidth = 0.6;
      ctx.strokeRect(bx, by, barW, barH);
      ctx.fillStyle = rgba(col, alpha * (nd.congested ? 0.88 : 0.48));
      ctx.fillRect(bx, by, barW * nd.queue, barH);

      if (nd.lane === 0) {
        ctx.fillStyle = rgba(ink, alpha * 0.34);
        ctx.fillText(`S0${nd.stage + 1}`, nd.x - 9, nd.y - 23);
      }
    }
  }

  Manifold.fields.flow = {
    init,
    injectBurst,
    clearFaults,
    reset: clearFaults,
    handleClick,
    render
  };
})(window);
