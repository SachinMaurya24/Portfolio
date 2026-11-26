/* =========================================================================
   AMBIENT BACKGROUND AUDIO ENGINE
   Track: Deep Focus (Ambient Neo-Classical).mp3
   Default ON, balanced 28% ambient volume, smooth fades, mute toggle & M key
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold || (global.Manifold = {});

  const TARGET_VOLUME = 0.28; // Balanced ambient level: present yet unobtrusive
  const FADE_IN_MS = 900;
  const FADE_OUT_MS = 260;

  // Primary location inside /audio, with root-folder fallback
  const AUDIO_SOURCES = [
    './audio/Deep%20Focus%20(Ambient%20Neo-Classical).mp3',
    './Deep%20Focus%20(Ambient%20Neo-Classical).mp3'
  ];

  const UNLOCK_EVENTS = ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown'];

  let audio = null;
  let sourceIndex = 0;
  let isMuted = false; // Always ON by default
  let isPlaying = false;
  let awaitingGesture = false;
  let loadFailed = false;
  let fadeRaf = null;

  let headerBtn = null;
  let dockBtn = null;

  function cancelFade() {
    if (fadeRaf !== null) {
      cancelAnimationFrame(fadeRaf);
      fadeRaf = null;
    }
  }

  function fadeVolume(toVolume, durationMs, onComplete) {
    if (!audio) return;
    cancelFade();
    const fromVolume = audio.volume;
    const start = performance.now();

    if (durationMs <= 0 || Math.abs(toVolume - fromVolume) < 0.002) {
      audio.volume = Math.max(0, Math.min(1, toVolume));
      if (onComplete) onComplete();
      return;
    }

    function step(now) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 2);
      audio.volume = Math.max(0, Math.min(1, fromVolume + (toVolume - fromVolume) * eased));
      if (t < 1) {
        fadeRaf = requestAnimationFrame(step);
      } else {
        fadeRaf = null;
        if (onComplete) onComplete();
      }
    }

    fadeRaf = requestAnimationFrame(step);
  }

  function updateButtons() {
    const soundOn = !isMuted;

    if (headerBtn) {
      headerBtn.classList.toggle('is-active', soundOn);
      headerBtn.setAttribute('aria-pressed', String(soundOn));
      if (isMuted) {
        headerBtn.textContent = '[ ✕ MUTED ]';
        headerBtn.title = 'Unmute background music (M)';
      } else {
        headerBtn.textContent = '[ ♫ SOUND: ON ]';
        headerBtn.title = 'Mute background music (M)';
      }
    }

    if (dockBtn) {
      dockBtn.classList.toggle('is-active', soundOn);
      dockBtn.setAttribute('aria-pressed', String(soundOn));
      dockBtn.textContent = isMuted ? '✕' : '♫';
      dockBtn.title = isMuted ? 'Unmute background music (M)' : 'Mute background music (M)';
    }
  }

  function startPlayback(showToast) {
    if (!audio || isMuted) return;

    if (loadFailed) {
      if (showToast && Manifold.notify) {
        Manifold.notify('AUDIO FILE NOT FOUND IN /audio');
      }
      return;
    }

    audio.muted = false;
    if (audio.paused) {
      audio.volume = 0;
    }

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          isPlaying = true;
          awaitingGesture = false;
          detachGestureUnlock();
          fadeVolume(TARGET_VOLUME, FADE_IN_MS);
          updateButtons();
          if (showToast && Manifold.notify) {
            Manifold.notify('AMBIENT AUDIO · ON');
          }
        })
        .catch((err) => {
          if (err && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
            awaitingGesture = true;
            attachGestureUnlock();
            updateButtons();
          }
        });
    } else {
      isPlaying = true;
      awaitingGesture = false;
      audio.volume = TARGET_VOLUME;
      updateButtons();
    }
  }

  function muteAudio(showToast) {
    isMuted = true;
    awaitingGesture = false;
    detachGestureUnlock();

    if (audio && isPlaying) {
      fadeVolume(0, FADE_OUT_MS, () => {
        if (isMuted && audio) {
          audio.pause();
          audio.muted = true;
          isPlaying = false;
          updateButtons();
        }
      });
    } else if (audio) {
      audio.muted = true;
      audio.pause();
      isPlaying = false;
    }

    updateButtons();
    if (showToast && Manifold.notify) {
      Manifold.notify('AMBIENT AUDIO · MUTED');
    }
  }

  function unmuteAudio(showToast) {
    isMuted = false;
    startPlayback(showToast);
    updateButtons();
  }

  function toggleMute() {
    if (isMuted) {
      unmuteAudio(true);
    } else if (!isPlaying && awaitingGesture) {
      // Browser held autoplay until first click: start playback immediately
      startPlayback(true);
    } else {
      muteAudio(true);
    }
  }

  function onFirstUserGesture(e) {
    if (e && e.target && (e.target === headerBtn || e.target === dockBtn)) {
      return;
    }
    if (!isMuted && !isPlaying && awaitingGesture) {
      startPlayback(false);
    }
  }

  function attachGestureUnlock() {
    UNLOCK_EVENTS.forEach((evt) => {
      window.addEventListener(evt, onFirstUserGesture, { capture: true, passive: true });
    });
  }

  function detachGestureUnlock() {
    UNLOCK_EVENTS.forEach((evt) => {
      window.removeEventListener(evt, onFirstUserGesture, { capture: true });
    });
  }

  function initAudioElement() {
    audio = new Audio();
    audio.loop = true;
    audio.autoplay = true;
    audio.preload = 'auto';
    audio.volume = 0;

    audio.addEventListener('canplay', () => {
      if (!isMuted && !isPlaying && !awaitingGesture) {
        startPlayback(false);
      }
    }, { once: true });

    audio.addEventListener('error', () => {
      if (sourceIndex + 1 < AUDIO_SOURCES.length) {
        sourceIndex++;
        audio.src = AUDIO_SOURCES[sourceIndex];
        audio.load();
      } else {
        loadFailed = true;
        isPlaying = false;
        updateButtons();
      }
    });

    audio.src = AUDIO_SOURCES[sourceIndex];
  }

  function bindControls() {
    headerBtn = document.getElementById('audio-btn');
    dockBtn = document.getElementById('dock-audio-btn');

    if (headerBtn) {
      headerBtn.addEventListener('click', toggleMute);
    }
    if (dockBtn) {
      dockBtn.addEventListener('click', toggleMute);
    }

    // Keyboard shortcut: M to mute / unmute
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      }
    });
  }

  function init() {
    isMuted = false; // Always start ON by default
    initAudioElement();
    bindControls();
    updateButtons();
    startPlayback(false);
  }

  Manifold.audio = {
    init,
    toggleMute,
    mute: () => muteAudio(true),
    unmute: () => unmuteAudio(true),
    getTargetVolume: () => TARGET_VOLUME
  };
})(window);
