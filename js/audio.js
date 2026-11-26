/* =========================================================================
   AMBIENT BACKGROUND AUDIO ENGINE
   Track: Deep Focus (Ambient Neo-Classical).mp3
   Balanced background volume (28%), smooth fade-in/out, mute toggle & M key
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold || (global.Manifold = {});

  const TARGET_VOLUME = 0.28; // Balanced ambient level: present yet unobtrusive
  const FADE_IN_MS = 900;
  const FADE_OUT_MS = 260;
  const STORAGE_KEY = 'manifold-audio-muted';

  // Primary location inside /audio, with root-folder fallback
  const AUDIO_SOURCES = [
    './audio/Deep%20Focus%20(Ambient%20Neo-Classical).mp3',
    './Deep%20Focus%20(Ambient%20Neo-Classical).mp3'
  ];

  let audio = null;
  let sourceIndex = 0;
  let isMuted = false;
  let isPlaying = false;
  let awaitingGesture = false;
  let loadFailed = false;
  let fadeRaf = null;

  let headerBtn = null;
  let dockBtn = null;

  function loadSavedMutePref() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (_) {
      return false;
    }
  }

  function saveMutePref(muted) {
    try {
      localStorage.setItem(STORAGE_KEY, String(muted));
    } catch (_) {
      // Ignore storage errors
    }
  }

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
      // Smooth ease-out curve
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
    const active = isPlaying && !isMuted;

    if (headerBtn) {
      headerBtn.classList.toggle('is-active', active);
      headerBtn.setAttribute('aria-pressed', String(!isMuted));
      if (isMuted) {
        headerBtn.textContent = '[ ✕ MUTED ]';
        headerBtn.title = 'Unmute background music (M)';
      } else if (active) {
        headerBtn.textContent = '[ ♫ SOUND: ON ]';
        headerBtn.title = 'Mute background music (M)';
      } else {
        headerBtn.textContent = '[ ♫ SOUND ]';
        headerBtn.title = 'Start or mute background music (M)';
      }
    }

    if (dockBtn) {
      dockBtn.classList.toggle('is-active', active);
      dockBtn.setAttribute('aria-pressed', String(!isMuted));
      dockBtn.textContent = isMuted ? '✕' : '♫';
      dockBtn.title = isMuted ? 'Unmute background music (M)' : 'Mute background music (M)';
    }
  }

  function startPlayback(showToast) {
    if (!audio || isMuted) return;

    if (loadFailed) {
      if (showToast && Manifold.notify) {
        Manifold.notify('ADD MP3 TO /audio FOLDER TO PLAY');
      }
      return;
    }

    audio.muted = false;
    audio.volume = 0;

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
          if (err && err.name === 'NotAllowedError') {
            awaitingGesture = true;
            attachGestureUnlock();
            updateButtons();
          }
        });
    } else {
      isPlaying = true;
      audio.volume = TARGET_VOLUME;
      updateButtons();
    }
  }

  function muteAudio(showToast) {
    isMuted = true;
    awaitingGesture = false;
    detachGestureUnlock();
    saveMutePref(true);

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
    saveMutePref(false);
    startPlayback(showToast);
    updateButtons();
  }

  function toggleMute() {
    if (isMuted) {
      unmuteAudio(true);
    } else if (!isPlaying && awaitingGesture) {
      // First click on the sound button when autoplay was blocked starts playback
      startPlayback(true);
    } else {
      muteAudio(true);
    }
  }

  function onFirstUserGesture(e) {
    // If user clicked the audio button itself, let its click handler manage state
    if (e && e.target && (e.target === headerBtn || e.target === dockBtn)) {
      return;
    }
    if (!isMuted && !isPlaying && awaitingGesture) {
      startPlayback(false);
    }
  }

  function attachGestureUnlock() {
    window.addEventListener('pointerdown', onFirstUserGesture, { passive: true });
    window.addEventListener('keydown', onFirstUserGesture, { passive: true });
  }

  function detachGestureUnlock() {
    window.removeEventListener('pointerdown', onFirstUserGesture);
    window.removeEventListener('keydown', onFirstUserGesture);
  }

  function initAudioElement() {
    audio = new Audio();
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;

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
    isMuted = loadSavedMutePref();
    initAudioElement();
    bindControls();
    updateButtons();

    if (!isMuted) {
      startPlayback(false);
    }
  }

  Manifold.audio = {
    init,
    toggleMute,
    mute: () => muteAudio(true),
    unmute: () => unmuteAudio(true),
    getTargetVolume: () => TARGET_VOLUME
  };
})(window);
