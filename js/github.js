/* =========================================================================
   LIVE GITHUB REPOSITORY SYNC & PLATE BINDING — github.com/SachinMaurya24
   Populates Plates I–IV and § 02 Repository Index directly from real public
   repositories on GitHub. Never injects hardcoded or unprepared projects.
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold;

  const GITHUB_USER = 'SachinMaurya24';
  const CODEFORCES_HANDLE = 'Borachii';
  const CACHE_KEY = `manifold-gh-${GITHUB_USER}-v3`;
  const CF_CACHE_KEY = `manifold-cf-${CODEFORCES_HANDLE}-v3`;
  const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

  const ghState = {
    profile: null,
    repos: [],
    language: 'ALL',
    query: '',
    includeForks: false,
    sortBy: 'updated' // 'updated' | 'stars'
  };

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatRelativeDate(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return '—';
    const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'TODAY';
    if (diffDays === 1) return '1D AGO';
    if (diffDays < 30) return `${diffDays}D AGO`;
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function formatRepoDisplayName(name) {
    return String(name || '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function writeCache(profile, repos) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), profile, repos }));
    } catch (_) {
      // Ignore storage quota errors
    }
  }

  async function fetchGitHubData(forceRefresh) {
    if (!forceRefresh) {
      const cached = readCache();
      if (cached && cached.profile && Array.isArray(cached.repos)) {
        return { profile: cached.profile, repos: cached.repos };
      }
    }

    const headers = { Accept: 'application/vnd.github+json' };
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${GITHUB_USER}`, { headers }),
      fetch(`https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=100`, { headers })
    ]);

    if (!userRes.ok || !reposRes.ok) {
      throw new Error(`GitHub API responded with ${userRes.status}/${reposRes.status}`);
    }

    const [profile, repos] = await Promise.all([userRes.json(), reposRes.json()]);
    writeCache(profile, repos);
    return { profile, repos };
  }

  /* -----------------------------------------------------------------------
     CURATED PLATE PINNING — BINDS LIVE GITHUB METADATA WITHOUT DESYNC
     Pins each showcase plate to its exact repository slug so pushing new
     repos never silently mismatches a plate's curated monograph prose.
     ----------------------------------------------------------------------- */
  function bindPlatesToGitHubRepos(repos) {
    if (!Array.isArray(repos)) return;

    const CURATED_SLUGS = {
      1: 'barnes-hut-n-body-simulator',
      3: 'amazon-clone',
      4: 'atcoder-profile-checker'
    };

    const bySlug = new Map();
    repos.forEach((r) => {
      if (r && r.name) bySlug.set(r.name.toLowerCase(), r);
    });

    const fallbackPool = repos
      .filter((r) => !r.fork && (r.name || '').toLowerCase() !== GITHUB_USER.toLowerCase())
      .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));

    [1, 3, 4].forEach((plateNum, poolIdx) => {
      const pinnedSlug = CURATED_SLUGS[plateNum];
      const repo = bySlug.get(pinnedSlug) || fallbackPool[poolIdx];

      const kickerEl = document.getElementById(`plate-${plateNum}-kicker`);
      const titleEl = document.getElementById(`plate-${plateNum}-title`);
      const metaEl = document.getElementById(`plate-${plateNum}-meta`);
      const descEl = document.getElementById(`plate-${plateNum}-desc`);
      const repoLinkEl = document.getElementById(`plate-${plateNum}-repo-link`);
      const demoLinkEl = document.getElementById(`plate-${plateNum}-demo-link`);

      if (!repo) {
        if (kickerEl) kickerEl.textContent = `PLATE 0${plateNum} · MATHEMATICAL STUDY`;
        return;
      }

      const lang = repo.language || 'Repository';
      const topics = Array.isArray(repo.topics) ? repo.topics.slice(0, 3) : [];
      const updated = formatRelativeDate(repo.pushed_at || repo.updated_at);
      const stars = repo.stargazers_count || 0;
      const matchedPinned = (repo.name || '').toLowerCase() === pinnedSlug;

      if (kickerEl) {
        kickerEl.textContent = `GITHUB REPO 0${plateNum} · ${lang.toUpperCase()} · ★ ${stars}`;
      }

      if (titleEl && !matchedPinned) {
        titleEl.textContent = formatRepoDisplayName(repo.name);
      }

      if (metaEl) {
        const parts = [repo.name, lang, ...topics, `Updated ${updated}`].filter(Boolean);
        metaEl.textContent = parts.join(' · ');
      }

      if (descEl && (!descEl.hasAttribute('data-preserve-desc') || !matchedPinned)) {
        descEl.textContent = repo.description
          ? repo.description
          : `Public ${lang} repository published under github.com/${GITHUB_USER}/${repo.name}.`;
      }

      if (repoLinkEl) {
        repoLinkEl.href = repo.html_url;
        repoLinkEl.textContent = `${repo.name} ↗`;
      }

      if (demoLinkEl) {
        if (repo.homepage) {
          demoLinkEl.href = repo.homepage;
          demoLinkEl.classList.remove('hidden');
        } else if (!demoLinkEl.getAttribute('href') || demoLinkEl.getAttribute('href') === '#') {
          demoLinkEl.classList.add('hidden');
        }
      }
    });
  }

  function renderProfileStats(profile, repos) {
    const repoCountEl = document.getElementById('gh-stat-repos');
    const langCountEl = document.getElementById('gh-stat-langs');
    const starCountEl = document.getElementById('gh-stat-stars');
    const statusEl = document.getElementById('gh-sync-status');
    const bioEl = document.getElementById('gh-profile-bio');

    const nonForks = repos.filter((r) => !r.fork);
    const langs = new Set(nonForks.map((r) => r.language).filter(Boolean));
    const totalStars = repos.reduce((acc, r) => acc + (r.stargazers_count || 0), 0);

    if (repoCountEl) repoCountEl.textContent = String(profile.public_repos ?? repos.length);
    if (langCountEl) langCountEl.textContent = String(langs.size || '—');
    if (starCountEl) starCountEl.textContent = String(totalStars);
    if (statusEl) statusEl.textContent = `SYNCED · @${GITHUB_USER}`;
    if (bioEl && profile.bio) {
      bioEl.textContent = profile.bio;
      bioEl.classList.remove('hidden');
    }
  }

  function renderLanguageFilters() {
    const wrap = document.getElementById('gh-lang-filters');
    if (!wrap) return;

    const source = ghState.includeForks
      ? ghState.repos
      : ghState.repos.filter((r) => !r.fork);

    const counts = new Map();
    source.forEach((r) => {
      if (r.language) {
        counts.set(r.language, (counts.get(r.language) || 0) + 1);
      }
    });

    const sortedLangs = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7);

    const buttons = [
      `<button type="button" data-gh-lang="ALL" class="hairline-btn px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase ${ghState.language === 'ALL' ? 'is-active' : ''}">ALL (${source.length})</button>`
    ];

    sortedLangs.forEach(([lang, count]) => {
      const active = ghState.language === lang ? 'is-active' : '';
      buttons.push(
        `<button type="button" data-gh-lang="${escapeHTML(lang)}" class="hairline-btn px-2.5 py-1 text-[10px] tracking-[0.1em] uppercase ${active}">${escapeHTML(lang)} (${count})</button>`
      );
    });

    wrap.innerHTML = buttons.join('');
    wrap.querySelectorAll('[data-gh-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        ghState.language = btn.getAttribute('data-gh-lang') || 'ALL';
        renderLanguageFilters();
        renderRepoList();
      });
    });
  }

  function renderRepoList() {
    const listEl = document.getElementById('gh-repo-list');
    if (!listEl) return;

    const q = ghState.query.trim().toLowerCase();
    let filtered = ghState.repos.filter((r) => {
      if (!ghState.includeForks && r.fork) return false;
      if (ghState.language !== 'ALL' && r.language !== ghState.language) return false;
      if (q) {
        const hay = `${r.name || ''} ${r.description || ''} ${r.language || ''} ${(r.topics || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (ghState.sortBy === 'stars') {
        const diff = (b.stargazers_count || 0) - (a.stargazers_count || 0);
        if (diff !== 0) return diff;
      }
      return new Date(b.pushed_at || b.updated_at || 0) - new Date(a.pushed_at || a.updated_at || 0);
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="p-6 font-mono-spec text-[11px] text-muted">
          No matching public repositories found for current filter.
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered
      .map((repo, idx) => {
        const num = String(idx + 1).padStart(2, '0');
        const lang = repo.language ? escapeHTML(repo.language) : 'SPEC';
        const desc = repo.description
          ? escapeHTML(repo.description)
          : 'Public repository on GitHub.';
        const updated = formatRelativeDate(repo.pushed_at || repo.updated_at);
        const stars = repo.stargazers_count || 0;
        const forkBadge = repo.fork ? '<span class="text-muted ml-2">[FORK]</span>' : '';
        const homepageLink = repo.homepage
          ? `<a href="${escapeHTML(repo.homepage)}" target="_blank" rel="noopener noreferrer" class="mono-action text-[10px] tracking-[0.1em] uppercase text-muted">DEMO ↗</a>`
          : '';

        return `
          <div class="repo-row rule-b px-5 sm:px-6 py-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-baseline">
            <div class="md:col-span-4 flex items-baseline gap-3 min-w-0">
              <span class="font-mono-spec text-[10px] text-muted tabular-nums shrink-0">${num}</span>
              <a
                href="${escapeHTML(repo.html_url)}"
                target="_blank"
                rel="noopener noreferrer"
                class="font-serif-math text-[18px] text-ink hover:text-accent transition-colors truncate"
              >${escapeHTML(repo.name)}</a>
              ${forkBadge}
            </div>
            <div class="md:col-span-5 font-serif-math text-[15px] leading-snug text-muted">
              ${desc}
            </div>
            <div class="md:col-span-3 flex flex-wrap md:justify-end items-center gap-x-4 gap-y-1 font-mono-spec text-[10px] tracking-[0.08em] uppercase text-muted tabular-nums">
              <span class="text-accent">${lang}</span>
              <span>★ ${stars}</span>
              <span>${updated}</span>
              ${homepageLink}
              <a
                href="${escapeHTML(repo.html_url)}"
                target="_blank"
                rel="noopener noreferrer"
                class="mono-action text-ink"
              >REPO ↗</a>
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderErrorState() {
    const statusEl = document.getElementById('gh-sync-status');
    const listEl = document.getElementById('gh-repo-list');
    if (statusEl) statusEl.textContent = 'OFFLINE / RATE LIMITED';

    for (let plateNum = 1; plateNum <= 4; plateNum++) {
      if (plateNum === 2) continue;
      const kickerEl = document.getElementById(`plate-${plateNum}-kicker`);
      if (kickerEl) kickerEl.textContent = `PLATE 0${plateNum} · MATHEMATICAL STUDY`;
    }

    if (listEl) {
      listEl.innerHTML = `
        <div class="p-6 flex flex-wrap items-center justify-between gap-4 font-mono-spec text-[11px] text-muted">
          <span>Unable to reach GitHub API right now. View live repositories directly on GitHub.</span>
          <div class="flex items-center gap-4">
            <button type="button" id="gh-retry-btn" class="hairline-btn px-3 py-1 text-[10px] uppercase tracking-[0.1em]">[ RETRY SYNC ]</button>
            <a href="https://github.com/${GITHUB_USER}" target="_blank" rel="noopener noreferrer" class="mono-action uppercase text-ink">github.com/${GITHUB_USER} ↗</a>
          </div>
        </div>
      `;
      const retryBtn = document.getElementById('gh-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => load(true));
      }
    }
  }

  async function load(forceRefresh) {
    const statusEl = document.getElementById('gh-sync-status');
    if (statusEl) statusEl.textContent = 'QUERYING GITHUB API...';

    try {
      const { profile, repos } = await fetchGitHubData(forceRefresh);
      ghState.profile = profile;
      ghState.repos = Array.isArray(repos) ? repos : [];
      renderProfileStats(profile, ghState.repos);
      bindPlatesToGitHubRepos(ghState.repos);
      renderLanguageFilters();
      renderRepoList();
    } catch (_) {
      renderErrorState();
    }
  }

  function bindControls() {
    const searchInput = document.getElementById('gh-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        ghState.query = e.target.value || '';
        renderRepoList();
      });
    }

    const sortBtn = document.getElementById('gh-sort-btn');
    if (sortBtn) {
      sortBtn.addEventListener('click', () => {
        ghState.sortBy = ghState.sortBy === 'updated' ? 'stars' : 'updated';
        sortBtn.textContent = ghState.sortBy === 'updated' ? '[ SORT: RECENT ]' : '[ SORT: STARS ]';
        renderRepoList();
      });
    }

    const forkBtn = document.getElementById('gh-forks-btn');
    if (forkBtn) {
      forkBtn.addEventListener('click', () => {
        ghState.includeForks = !ghState.includeForks;
        forkBtn.classList.toggle('is-active', ghState.includeForks);
        forkBtn.textContent = ghState.includeForks ? '[ FORKS: SHOWN ]' : '[ FORKS: HIDDEN ]';
        ghState.language = 'ALL';
        renderLanguageFilters();
        renderRepoList();
      });
    }
  }

  const cfGraphState = {
    ratings: [],
    points: [],
    activeIndex: -1,
    bound: false
  };

  function formatContestDate(unixSec) {
    if (!unixSec) return '—';
    const d = new Date(unixSec * 1000);
    if (Number.isNaN(d.getTime())) return '—';
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const day = String(d.getDate()).padStart(2, '0');
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function updateCfReadout(idx) {
    const contestEl = document.getElementById('cf-hover-contest');
    const detailEl = document.getElementById('cf-hover-detail');
    const metaEl = document.getElementById('cf-graph-meta');
    const list = cfGraphState.ratings;
    if (!list || list.length === 0) return;

    const chosen = (idx >= 0 && idx < list.length) ? list[idx] : list[list.length - 1];
    const delta = typeof chosen.oldRating === 'number'
      ? chosen.newRating - chosen.oldRating
      : null;
    const deltaStr = delta !== null ? ` (${delta >= 0 ? '+' : ''}${delta})` : '';
    const dateStr = formatContestDate(chosen.ratingUpdateTimeSeconds);
    const rankStr = chosen.rank ? ` · #${chosen.rank}` : '';

    if (contestEl) {
      contestEl.textContent = chosen.contestName || `Contest #${chosen.contestId}`;
      contestEl.title = chosen.contestName || '';
    }
    if (detailEl) {
      detailEl.textContent = `${chosen.newRating}${deltaStr} · ${dateStr}${rankStr}`;
    }
    if (metaEl) {
      metaEl.textContent = (idx >= 0 && idx < list.length)
        ? `CONTEST ${idx + 1}/${list.length}`
        : `${list.length} CONTESTS · LIVE API`;
    }
  }

  function drawCfRatingGraph(canvasEl) {
    if (!canvasEl) return;
    const ratings = cfGraphState.ratings;
    if (!ratings || ratings.length === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvasEl.getBoundingClientRect();
    const cssW = Math.max(240, Math.round(rect.width || 480));
    const cssH = Math.max(76, Math.round(rect.height || 92));

    if (canvasEl.width !== Math.round(cssW * dpr) || canvasEl.height !== Math.round(cssH * dpr)) {
      canvasEl.width = Math.round(cssW * dpr);
      canvasEl.height = Math.round(cssH * dpr);
    }

    const c = canvasEl.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cssW, cssH);

    const palette = Manifold.state.palette;
    const ink = palette.inkRGB;
    const accent = palette.accentRGB;
    const rgba = Manifold.rgba;

    const padL = 34;
    const padR = 10;
    const padT = 10;
    const padB = 18;
    const plotW = cssW - padL - padR;
    const plotH = cssH - padT - padB;

    const vals = ratings.map((r) => r.newRating);
    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    const span = Math.max(80, rawMax - rawMin);
    const minV = Math.floor((rawMin - span * 0.14) / 25) * 25;
    const maxV = Math.ceil((rawMax + span * 0.14) / 25) * 25;

    const times = ratings.map((r) => r.ratingUpdateTimeSeconds || 0);
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const useTimeAxis = ratings.length > 1 && maxT > minT;

    // 1. Horizontal rating guide lines & monospace labels
    const ticks = [minV, Math.round((minV + maxV) * 0.5), maxV];
    c.font = '8px "IBM Plex Mono", ui-monospace, monospace';
    c.textBaseline = 'middle';
    ticks.forEach((tv, idx) => {
      const y = padT + (1 - (tv - minV) / Math.max(1, maxV - minV)) * plotH;
      c.save();
      if (idx === 1) c.setLineDash([2, 3]);
      c.strokeStyle = rgba(ink, idx === 0 ? 0.18 : 0.10);
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(padL, Math.round(y) + 0.5);
      c.lineTo(cssW - padR, Math.round(y) + 0.5);
      c.stroke();
      c.restore();

      c.fillStyle = rgba(ink, 0.45);
      c.fillText(String(tv), 2, y);
    });

    // 2. Compute screen coordinates for each contest
    const points = ratings.map((r, i) => {
      const tNorm = useTimeAxis
        ? (r.ratingUpdateTimeSeconds - minT) / (maxT - minT)
        : (ratings.length === 1 ? 0.5 : i / (ratings.length - 1));
      const x = padL + tNorm * plotW;
      const y = padT + (1 - (r.newRating - minV) / Math.max(1, maxV - minV)) * plotH;
      return { x, y, contest: r };
    });
    cfGraphState.points = points;

    // 3. Draw vertical crosshair if hovering a contest dot
    const activeIdx = cfGraphState.activeIndex;
    if (activeIdx >= 0 && activeIdx < points.length) {
      const ap = points[activeIdx];
      c.save();
      c.setLineDash([2, 2]);
      c.strokeStyle = rgba(accent, 0.55);
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(ap.x, padT);
      c.lineTo(ap.x, padT + plotH);
      c.stroke();
      c.restore();
    }

    // 4. Draw connecting rating curve
    if (points.length >= 2) {
      c.strokeStyle = rgba(accent, 0.82);
      c.lineWidth = 1.2;
      c.beginPath();
      points.forEach((pt, i) => {
        if (i === 0) c.moveTo(pt.x, pt.y);
        else c.lineTo(pt.x, pt.y);
      });
      c.stroke();
    }

    // 5. Draw small contest dots (Codeforces-style)
    const dotR = points.length > 35 ? 2.1 : 2.7;
    points.forEach((pt, i) => {
      const isHovered = i === activeIdx;
      const isPeak = pt.contest.newRating === rawMax;
      const r = isHovered ? 4.2 : dotR;

      c.beginPath();
      c.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      c.fillStyle = isHovered ? rgba(accent, 1.0) : palette.bg;
      c.fill();
      c.lineWidth = isHovered ? 1.4 : (isPeak ? 1.3 : 1.05);
      c.strokeStyle = isHovered ? rgba(ink, 0.95) : rgba(accent, isPeak ? 1.0 : 0.9);
      c.stroke();

      if (isHovered) {
        c.beginPath();
        c.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
        c.strokeStyle = rgba(accent, 0.35);
        c.lineWidth = 0.85;
        c.stroke();
      }
    });

    // 6. Start & end contest date axis labels
    const firstDate = formatContestDate(ratings[0].ratingUpdateTimeSeconds);
    const lastDate = formatContestDate(ratings[ratings.length - 1].ratingUpdateTimeSeconds);
    c.fillStyle = rgba(ink, 0.42);
    c.textBaseline = 'bottom';
    c.fillText(firstDate, padL, cssH - 1);
    if (ratings.length > 1) {
      const lw = c.measureText(lastDate).width;
      c.fillText(lastDate, cssW - padR - lw, cssH - 1);
    }
  }

  function bindCfGraphInteractions(canvasEl) {
    if (!canvasEl || cfGraphState.bound) return;
    cfGraphState.bound = true;

    function pickNearest(clientX, clientY) {
      const rect = canvasEl.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < cfGraphState.points.length; i++) {
        const pt = cfGraphState.points[i];
        const dx = pt.x - mx;
        const dy = (pt.y - my) * 0.35;
        const d = Math.hypot(dx, dy);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestDist <= 28 && bestIdx !== cfGraphState.activeIndex) {
        cfGraphState.activeIndex = bestIdx;
        drawCfRatingGraph(canvasEl);
        updateCfReadout(bestIdx);
      }
    }

    canvasEl.addEventListener('mousemove', (e) => pickNearest(e.clientX, e.clientY));
    canvasEl.addEventListener('click', (e) => pickNearest(e.clientX, e.clientY));
    canvasEl.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) pickNearest(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    canvasEl.addEventListener('mouseleave', () => {
      if (cfGraphState.activeIndex !== -1) {
        cfGraphState.activeIndex = -1;
        drawCfRatingGraph(canvasEl);
        updateCfReadout(-1);
      }
    });

    window.addEventListener('resize', () => drawCfRatingGraph(canvasEl));
    const themeObserver = new MutationObserver(() => drawCfRatingGraph(canvasEl));
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  function renderCodeforcesAnalytics(payload) {
    const { user, ratings, solvedCount, topTags } = payload;
    const kickerEl = document.getElementById('plate-2-kicker');
    const metaEl = document.getElementById('plate-2-meta');

    const handle = (user && user.handle) || CODEFORCES_HANDLE;
    const rank = user && user.rank ? String(user.rank).toUpperCase() : 'COMPETITIVE PROGRAMMING';
    const rating = user && typeof user.rating === 'number' ? user.rating : null;
    const maxRating = user && typeof user.maxRating === 'number' ? user.maxRating : null;
    const maxRank = user && user.maxRank ? String(user.maxRank) : null;

    if (kickerEl) {
      kickerEl.textContent = rating !== null
        ? `CODEFORCES · ${handle.toUpperCase()} · ${rank} · ${rating}`
        : `CODEFORCES · ${handle.toUpperCase()} · ${rank}`;
    }

    if (metaEl) {
      const parts = [handle, 'Codeforces'];
      if (rating !== null) {
        const maxStr = maxRating !== null ? ` (Max ${maxRating}${maxRank ? ' · ' + maxRank : ''})` : '';
        parts.push(`Rating ${rating}${maxStr}`);
      }
      parts.push('C++20');
      metaEl.textContent = parts.join(' · ');
    }

    const elRating = document.getElementById('cf-stat-rating');
    const elMax = document.getElementById('cf-stat-max');
    const elContests = document.getElementById('cf-stat-contests');
    const elSolved = document.getElementById('cf-stat-solved');
    const elTags = document.getElementById('cf-top-tags');
    const sparkCanvas = document.getElementById('cf-rating-spark');

    if (elRating) elRating.textContent = rating !== null ? String(rating) : '—';
    if (elMax) elMax.textContent = maxRating !== null ? String(maxRating) : '—';
    if (elContests) elContests.textContent = Array.isArray(ratings) ? String(ratings.length) : '—';
    if (elSolved) elSolved.textContent = typeof solvedCount === 'number' ? `${solvedCount}+` : '—';

    if (elTags && Array.isArray(topTags) && topTags.length > 0) {
      elTags.innerHTML = topTags
        .map(([tag, cnt]) => `<span class="cf-tag-chip">${escapeHTML(tag)} · ${cnt}</span>`)
        .join('');
    }

    if (sparkCanvas && Array.isArray(ratings) && ratings.length >= 1) {
      cfGraphState.ratings = ratings;
      cfGraphState.activeIndex = -1;
      bindCfGraphInteractions(sparkCanvas);
      drawCfRatingGraph(sparkCanvas);
      updateCfReadout(-1);
    }
  }

  async function loadCodeforcesProfile() {
    const kickerEl = document.getElementById('plate-2-kicker');
    const metaEl = document.getElementById('plate-2-meta');
    if (!kickerEl && !metaEl) return;

    try {
      let cachedPayload = null;
      try {
        const raw = sessionStorage.getItem(CF_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Date.now() - parsed.ts <= CACHE_TTL_MS && parsed.payload) {
            cachedPayload = parsed.payload;
          }
        }
      } catch (_) {
        // Ignore storage read errors
      }

      if (cachedPayload) {
        renderCodeforcesAnalytics(cachedPayload);
        return;
      }

      const enc = encodeURIComponent(CODEFORCES_HANDLE);
      const [infoRes, ratingRes, statusRes] = await Promise.all([
        fetch(`https://codeforces.com/api/user.info?handles=${enc}`),
        fetch(`https://codeforces.com/api/user.rating?handle=${enc}`).catch(() => null),
        fetch(`https://codeforces.com/api/user.status?handle=${enc}&from=1&count=500`).catch(() => null)
      ]);

      if (!infoRes.ok) return;
      const infoData = await infoRes.json();
      if (infoData.status !== 'OK' || !Array.isArray(infoData.result) || !infoData.result[0]) return;
      const user = infoData.result[0];

      let ratings = [];
      if (ratingRes && ratingRes.ok) {
        const rData = await ratingRes.json();
        if (rData.status === 'OK' && Array.isArray(rData.result)) {
          ratings = rData.result.map((c) => ({
            contestId: c.contestId,
            contestName: c.contestName,
            rank: c.rank,
            oldRating: c.oldRating,
            newRating: c.newRating,
            ratingUpdateTimeSeconds: c.ratingUpdateTimeSeconds
          }));
        }
      }

      let solvedCount = null;
      let topTags = [];
      if (statusRes && statusRes.ok) {
        const sData = await statusRes.json();
        if (sData.status === 'OK' && Array.isArray(sData.result)) {
          const solvedKeys = new Set();
          const tagCounts = new Map();
          sData.result.forEach((sub) => {
            if (sub.verdict !== 'OK' || !sub.problem) return;
            const key = `${sub.problem.contestId || ''}-${sub.problem.index || sub.problem.name}`;
            if (solvedKeys.has(key)) return;
            solvedKeys.add(key);
            if (Array.isArray(sub.problem.tags)) {
              sub.problem.tags.forEach((tag) => {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
              });
            }
          });
          solvedCount = solvedKeys.size;
          topTags = Array.from(tagCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4);
        }
      }

      const payload = { user, ratings, solvedCount, topTags };
      try {
        sessionStorage.setItem(CF_CACHE_KEY, JSON.stringify({ ts: Date.now(), payload }));
      } catch (_) {
        // Ignore storage quota errors
      }
      renderCodeforcesAnalytics(payload);
    } catch (_) {
      // Keep static fallback text in Plate II if Codeforces API is unreachable
    }
  }

  Manifold.github = {
    init: () => {
      bindControls();
      load(false);
      loadCodeforcesProfile();
    },
    refresh: () => {
      load(true);
      loadCodeforcesProfile();
    },
    getRepos: () => ghState.repos
  };
})(window);
