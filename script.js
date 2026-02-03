/* ================================
   VašeSRO – minimal JS
   - Mobile nav open/close
   - Theme toggle (light/dark)
   - Header shadow on scroll
================================ */
(() => {
  const btn = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  const header = document.querySelector('[data-header]');

  // Mobile nav
  if (btn && nav) {
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    };

    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      setOpen(open);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!nav.classList.contains('is-open')) return;
      if (e.target.closest('[data-nav]')) return;
      if (e.target.closest('[data-nav-toggle]')) return;
      setOpen(false);
    });

    // Close after clicking a link
    nav.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (a) setOpen(false);
    });

    // Close on Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });

    // Reset on resize
    window.addEventListener('resize', () => {
      if (window.innerWidth > 980) setOpen(false);
    });
  }

  // Theme toggle
  const html = document.documentElement;
  const themeBtn = document.querySelector('[data-theme-toggle]');
  const themeEmoji = document.querySelector('[data-theme-emoji]');

  const savedTheme = localStorage.getItem('theme');
  const initialTheme = savedTheme || 'light';

  const applyTheme = (theme) => {
    html.setAttribute('data-theme', theme);
    if (themeEmoji) themeEmoji.textContent = theme === 'light' ? '☀️' : '🌙';
  };

  applyTheme(initialTheme);

  themeBtn?.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('theme', next);
  });

  // Header shadow on scroll
  const onScroll = () => {
    header?.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
