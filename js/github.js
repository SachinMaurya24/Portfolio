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
  const CF_CACHE_KEY = `manifold-cf-${CODEFORCES_HANDLE}-v1`;
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
     BIND PLATES I–IV DIRECTLY TO REAL GITHUB REPOSITORIES
     Pins Barnes-Hut-N-Body-Simulator to Plate I (top), then orders the
     remaining non-fork repos by stars and most recently pushed.
     ----------------------------------------------------------------------- */
  function bindPlatesToGitHubRepos(repos) {
    if (!Array.isArray(repos)) return;

    const TOP_REPO = 'barnes-hut-n-body-simulator';
    const candidates = repos
      .filter((r) => !r.fork && (r.name || '').toLowerCase() !== GITHUB_USER.toLowerCase())
      .sort((a, b) => {
        const aTop = (a.name || '').toLowerCase() === TOP_REPO ? 1 : 0;
        const bTop = (b.name || '').toLowerCase() === TOP_REPO ? 1 : 0;
        if (aTop !== bTop) return bTop - aTop;
        const starDiff = (b.stargazers_count || 0) - (a.stargazers_count || 0);
        if (starDiff !== 0) return starDiff;
        return new Date(b.pushed_at || b.updated_at || 0) - new Date(a.pushed_at || a.updated_at || 0);
      });

    for (let idx = 0; idx < 4; idx++) {
      const plateNum = idx + 1;
      if (plateNum === 2) continue; // Plate II is dedicated to Competitive Programming (Codeforces)
      const repo = candidates[idx];

      const kickerEl = document.getElementById(`plate-${plateNum}-kicker`);
      const titleEl = document.getElementById(`plate-${plateNum}-title`);
      const metaEl = document.getElementById(`plate-${plateNum}-meta`);
      const descEl = document.getElementById(`plate-${plateNum}-desc`);
      const repoLinkEl = document.getElementById(`plate-${plateNum}-repo-link`);
      const demoLinkEl = document.getElementById(`plate-${plateNum}-demo-link`);

      if (!repo) {
        if (kickerEl) kickerEl.textContent = `PLATE 0${plateNum} · MATHEMATICAL STUDY`;
        continue;
      }

      const lang = repo.language || 'Repository';
      const topics = Array.isArray(repo.topics) ? repo.topics.slice(0, 3) : [];
      const updated = formatRelativeDate(repo.pushed_at || repo.updated_at);
      const stars = repo.stargazers_count || 0;

      if (kickerEl) {
        kickerEl.textContent = `GITHUB REPO 0${plateNum} · ${lang.toUpperCase()} · ★ ${stars}`;
      }

      if (titleEl) {
        titleEl.textContent = formatRepoDisplayName(repo.name);
      }

      if (metaEl) {
        const parts = [repo.name, lang, ...topics, `Updated ${updated}`].filter(Boolean);
        metaEl.textContent = parts.join(' · ');
      }

      if (descEl && !descEl.hasAttribute('data-preserve-desc')) {
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
    }
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

  async function loadCodeforcesProfile() {
    const kickerEl = document.getElementById('plate-2-kicker');
    const metaEl = document.getElementById('plate-2-meta');
    if (!kickerEl && !metaEl) return;

    try {
      let user = null;
      try {
        const raw = sessionStorage.getItem(CF_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Date.now() - parsed.ts <= CACHE_TTL_MS && parsed.user) {
            user = parsed.user;
          }
        }
      } catch (_) {
        // Ignore storage read errors
      }

      if (!user) {
        const res = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(CODEFORCES_HANDLE)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status !== 'OK' || !Array.isArray(data.result) || !data.result[0]) return;
        user = data.result[0];
        try {
          sessionStorage.setItem(CF_CACHE_KEY, JSON.stringify({ ts: Date.now(), user }));
        } catch (_) {
          // Ignore storage quota errors
        }
      }

      const handle = user.handle || CODEFORCES_HANDLE;
      const rank = user.rank ? String(user.rank).toUpperCase() : 'COMPETITIVE PROGRAMMING';
      const rating = typeof user.rating === 'number' ? user.rating : null;
      const maxRating = typeof user.maxRating === 'number' ? user.maxRating : null;
      const maxRank = user.maxRank ? String(user.maxRank) : null;

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
    }
  };
})(window);
