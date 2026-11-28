/* =========================================================================
   SWISS-HAIRLINE COMMAND PALETTE (⌘K / Ctrl+K)
   - Instant navigation across sections, all 7 mathematical fields, actions,
     contact/CV tools, and live-synced GitHub repositories
   ========================================================================= */
(function (global) {
  'use strict';

  const Manifold = global.Manifold;
  const { state, MODE_META } = Manifold;

  let overlayEl = null;
  let inputEl = null;
  let listEl = null;
  let isOpen = false;
  let selectedIdx = 0;
  let currentItems = [];

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function copyText(text, label) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        Manifold.notify(`${label} COPIED TO CLIPBOARD`);
      }).catch(() => {
        Manifold.notify(text);
      });
    } else {
      Manifold.notify(text);
    }
  }

  function buildCatalog() {
    const items = [];
    const contact = Manifold.CONTACT || {};

    // 1. Sections
    const sections = [
      { id: 'hero', title: '§ 00 Field — Hero & Scalar Potential', hint: 'SECTION' },
      { id: 'plates', title: '§ 01 Plates — Featured Projects & Competitive Programming', hint: 'SECTION' },
      { id: 'repositories', title: '§ 02 GitHub — Public Repository Index', hint: 'SECTION' },
      { id: 'foundations', title: '§ 03 Axioms — Foundations & Discipline', hint: 'SECTION' },
      { id: 'correspondence', title: '§ 04 Correspondence & Curriculum Vitae', hint: 'SECTION' },
      { id: 'colophon', title: '§ 05 Colophon & External Indices', hint: 'SECTION' }
    ];
    sections.forEach((s) => {
      items.push({
        group: 'SECTIONS',
        title: s.title,
        meta: s.hint,
        keywords: `${s.title} section navigate jump`,
        run: () => scrollToSection(s.id)
      });
    });

    // 2. Mathematical Fields (0–6)
    MODE_META.forEach((m) => {
      items.push({
        group: 'FIELDS',
        title: `Lock Field ${m.short} — ${m.label}`,
        meta: `KEY ${m.id}`,
        keywords: `field simulation math ${m.label} ${m.hint}`,
        run: () => {
          state.lockedMode = m.id;
          Manifold.ui.updateScrollTargets();
          if (Manifold.dockLab) Manifold.dockLab.setOpen(true);
          Manifold.notify(`FIELD LOCKED · ${m.label}`);
        }
      });
    });

    items.push({
      group: 'FIELDS',
      title: 'Unlock Field (Resume Scroll Morphing)',
      meta: 'AUTO',
      keywords: 'unlock scroll morphing field',
      run: () => {
        state.lockedMode = null;
        Manifold.ui.updateScrollTargets();
        Manifold.notify('FIELD UNLOCKED · SCROLL MORPHING');
      }
    });

    // 3. Actions & Monograph Tools
    items.push(
      {
        group: 'ACTIONS',
        title: 'Export Active Mathematical Plate as PNG',
        meta: 'PNG',
        keywords: 'export download save png snapshot screenshot plate',
        run: () => Manifold.dockLab && Manifold.dockLab.exportPlatePNG()
      },
      {
        group: 'ACTIONS',
        title: 'Toggle Field Parameter Lab (All 7 Modes)',
        meta: 'LAB',
        keywords: 'lab sliders parameters stochastic flow controls',
        run: () => {
          const btn = document.getElementById('dock-lab-btn');
          if (btn) btn.click();
        }
      },
      {
        group: 'ACTIONS',
        title: 'Toggle Inspect Field Mode (Full-Screen Math)',
        meta: 'KEY I',
        keywords: 'inspect fade prose fullscreen math',
        run: () => {
          const btn = document.getElementById('inspect-btn');
          if (btn) btn.click();
        }
      },
      {
        group: 'ACTIONS',
        title: 'Switch Surface Theme (Obsidian / Archival Paper)',
        meta: 'KEY T',
        keywords: 'theme dark light obsidian archival paper',
        run: () => {
          const btn = document.getElementById('theme-btn');
          if (btn) btn.click();
        }
      },
      {
        group: 'ACTIONS',
        title: 'Toggle Ambient Background Audio',
        meta: 'KEY M',
        keywords: 'audio music sound mute unmute',
        run: () => Manifold.audio && Manifold.audio.toggleMute()
      },
      {
        group: 'ACTIONS',
        title: 'Print / Save Monograph Curriculum Vitae',
        meta: 'PRINT',
        keywords: 'cv resume print pdf download',
        run: () => window.print()
      }
    );

    if (contact.email) {
      items.push({
        group: 'CONTACT',
        title: `Copy Email Address (${contact.email})`,
        meta: 'COPY',
        keywords: `email contact mail copy ${contact.email}`,
        run: () => copyText(contact.email, 'EMAIL')
      });
    }
    if (contact.linkedin) {
      items.push({
        group: 'CONTACT',
        title: 'Open LinkedIn Profile',
        meta: 'LINK ↗',
        keywords: 'linkedin profile contact',
        run: () => window.open(contact.linkedin, '_blank', 'noopener,noreferrer')
      });
    }
    if (contact.resumeUrl) {
      items.push({
        group: 'CONTACT',
        title: 'Open Resume / CV (PDF)',
        meta: 'PDF ↗',
        keywords: 'resume cv pdf download',
        run: () => window.open(contact.resumeUrl, '_blank', 'noopener,noreferrer')
      });
    }

    // 4. External Indices (read live from the Colophon links so they stay in sync)
    const extLinks = Array.from(document.querySelectorAll('#colophon a[href^="http"]'));
    extLinks.forEach((a) => {
      const label = (a.textContent || '').replace(/↗/g, '').trim();
      const url = a.getAttribute('href');
      if (!url || !label) return;
      items.push({
        group: 'INDICES',
        title: `Open ${label}`,
        meta: 'LINK ↗',
        keywords: `${label} external profile link`,
        run: () => window.open(url, '_blank', 'noopener,noreferrer')
      });
    });

    // 5. Live-Synced GitHub Repositories
    const repos = Manifold.github && Manifold.github.getRepos ? Manifold.github.getRepos() : [];
    repos.filter((r) => !r.fork).slice(0, 18).forEach((repo) => {
      items.push({
        group: 'REPOSITORIES',
        title: repo.name,
        meta: (repo.language || 'REPO').toUpperCase() + ' ↗',
        keywords: `github repo ${repo.name} ${repo.description || ''} ${repo.language || ''}`,
        run: () => window.open(repo.html_url, '_blank', 'noopener,noreferrer')
      });
    });

    return items;
  }

  function renderList(query) {
    if (!listEl) return;
    const q = (query || '').trim().toLowerCase();
    const all = buildCatalog();

    currentItems = q
      ? all.filter((item) => {
          const hay = `${item.group} ${item.title} ${item.meta} ${item.keywords}`.toLowerCase();
          return q.split(/\s+/).every((tok) => hay.includes(tok));
        })
      : all;

    if (selectedIdx >= currentItems.length) selectedIdx = 0;

    if (currentItems.length === 0) {
      listEl.innerHTML = `<div class="px-4 py-6 font-mono-spec text-[11px] text-muted">No matching commands or repositories for "${escapeHTML(query)}".</div>`;
      return;
    }

    let lastGroup = '';
    const html = [];
    currentItems.forEach((item, idx) => {
      if (item.group !== lastGroup) {
        lastGroup = item.group;
        html.push(
          `<div class="px-4 pt-3 pb-1 font-mono-spec text-[9px] tracking-[0.14em] uppercase text-muted">${escapeHTML(item.group)}</div>`
        );
      }
      const activeClass = idx === selectedIdx ? ' is-selected' : '';
      html.push(
        `<button type="button" data-cmd-idx="${idx}" class="cmd-item${activeClass} w-full px-4 py-2 flex items-center justify-between gap-3 text-left font-mono-spec text-[11px]">
          <span class="truncate text-ink">${escapeHTML(item.title)}</span>
          <span class="shrink-0 text-[9.5px] tracking-[0.1em] uppercase text-accent">${escapeHTML(item.meta)}</span>
        </button>`
      );
    });

    listEl.innerHTML = html.join('');
    listEl.querySelectorAll('[data-cmd-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.getAttribute('data-cmd-idx'), 10);
        executeItem(i);
      });
      btn.addEventListener('mouseenter', () => {
        selectedIdx = parseInt(btn.getAttribute('data-cmd-idx'), 10);
        highlightSelected();
      });
    });
  }

  function highlightSelected() {
    if (!listEl) return;
    const rows = listEl.querySelectorAll('[data-cmd-idx]');
    rows.forEach((row) => {
      const i = parseInt(row.getAttribute('data-cmd-idx'), 10);
      const sel = i === selectedIdx;
      row.classList.toggle('is-selected', sel);
      if (sel) row.scrollIntoView({ block: 'nearest' });
    });
  }

  function executeItem(idx) {
    const item = currentItems[idx];
    if (!item) return;
    close();
    item.run();
  }

  function open() {
    if (!overlayEl) return;
    isOpen = true;
    selectedIdx = 0;
    overlayEl.classList.add('is-open');
    overlayEl.setAttribute('aria-hidden', 'false');
    if (inputEl) {
      inputEl.value = '';
      renderList('');
      requestAnimationFrame(() => inputEl.focus());
    }
  }

  function close() {
    if (!overlayEl) return;
    isOpen = false;
    overlayEl.classList.remove('is-open');
    overlayEl.setAttribute('aria-hidden', 'true');
  }

  function init() {
    overlayEl = document.getElementById('cmd-palette-overlay');
    inputEl = document.getElementById('cmd-palette-input');
    listEl = document.getElementById('cmd-palette-list');

    const triggerBtn = document.getElementById('cmd-btn');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => (isOpen ? close() : open()));
    }

    const closeBtn = document.getElementById('cmd-palette-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', close);
    }

    if (overlayEl) {
      overlayEl.addEventListener('click', (e) => {
        if (e.target === overlayEl) close();
      });
    }

    if (inputEl) {
      inputEl.addEventListener('input', (e) => {
        selectedIdx = 0;
        renderList(e.target.value);
      });
    }

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (isOpen) close();
        else open();
        return;
      }

      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentItems.length > 0) {
          selectedIdx = (selectedIdx + 1) % currentItems.length;
          highlightSelected();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentItems.length > 0) {
          selectedIdx = (selectedIdx - 1 + currentItems.length) % currentItems.length;
          highlightSelected();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        executeItem(selectedIdx);
      }
    });
  }

  Manifold.commandPalette = {
    init,
    open,
    close
  };
})(window);
