(() => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const toggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  // Right-edge scroll progress bar
  const progressBar = document.getElementById('scroll-progress-bar');
  if (progressBar) {
    const updateBar = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const scrollHeight = doc.scrollHeight - window.innerHeight;
      const ratio = scrollHeight > 0 ? Math.min(1, Math.max(0, scrollTop / scrollHeight)) : 0;
      const trackHeight = window.innerHeight - 16;
      const barHeight = Math.max(24, trackHeight * ratio);
      progressBar.style.height = `${barHeight}px`;
    };
    window.addEventListener('scroll', updateBar, { passive: true });
    window.addEventListener('resize', updateBar, { passive: true });
    updateBar();
  }

  // --- SPA & BLOG LOGIC ---

  const postsContainer = document.getElementById('posts');
  const articlePage = document.querySelector('article.page');

  // Create a container for the single post view if it doesn't exist
  let postViewContainer = document.getElementById('post-view-container');
  if (!postViewContainer && articlePage) {
    postViewContainer = document.createElement('div');
    postViewContainer.id = 'post-view-container';
    postViewContainer.style.display = 'none'; // hidden by default
    postViewContainer.innerHTML = `
      <div class="post-actions" style="margin-bottom: 2rem;">
        <button id="back-button" class="post-tab" style="cursor:pointer;">← Back to Posts</button>
      </div>
      <div id="post-content-area" class="post-content markdown-body"></div>
    `;
    articlePage.appendChild(postViewContainer);

    document.getElementById('back-button').addEventListener('click', () => {
      goToHome();
    });
  }

  // Elements for list view to toggle visibility
  const listElements = [
    document.querySelector('.page-header'),
    document.querySelector('.post-toolbar'),
    document.getElementById('post-tabs'),
    document.getElementById('posts'),
    document.getElementById('pager')
  ];

  let state = { allPosts: [], view: [], page: 1, pageSize: 10, filterFormat: 'all', term: '', sort: 'newest' };

  const loadPostsData = async () => {
    try {
      if (state.allPosts.length > 0) return true;
      const res = await fetch('data/posts.json', { cache: 'no-store' });
      state.allPosts = await res.json();
      return true;
    } catch {
      return false;
    }
  };

  // --- ROUTER ---
  const handleRoute = async () => {
    const params = new URLSearchParams(location.search);
    const postId = params.get('post'); // use ?post=id

    if (postId) {
      // Show Post Detail
      await showPost(postId);
    } else {
      // Show Post List
      showList();
    }
  };

  window.addEventListener('popstate', handleRoute);

  // Switch to List View
  const showList = () => {
    if (!postsContainer) return;

    // Show list elements
    listElements.forEach(el => { if (el) el.style.display = ''; });
    // Hide post detail
    if (postViewContainer) postViewContainer.style.display = 'none';

    // Render list (re-apply filters to be sure)
    applyFilters();
    window.scrollTo(0, 0);
  };

  const goToHome = () => {
    const u = new URL(location.href);
    u.searchParams.delete('post');
    history.pushState({}, '', u.toString());
    showList();
  };

  // Switch to Post View
  const showPost = async (id) => {
    // Hide list elements
    listElements.forEach(el => { if (el) el.style.display = 'none'; });
    // Show post container
    if (postViewContainer) postViewContainer.style.display = 'block';

    const contentArea = document.getElementById('post-content-area');
    contentArea.innerHTML = '<p>Loading...</p>';

    // Find post metadata
    await loadPostsData();
    const post = state.allPosts.find(p => p.id === id);

    if (!post) {
      contentArea.innerHTML = '<p>Post not found.</p>';
      return;
    }

    try {
      const res = await fetch(post.file);
      if (!res.ok) throw new Error('Failed to load markdown');
      const md = await res.text();

      const html = marked.parse(md);
      contentArea.innerHTML = `
        <header class="post-header-detail" style="margin-bottom:2rem; border-bottom:1px solid #333; padding-bottom:1rem;">
          <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem; color: #f3d37a;">${post.title}</h1>
          <div class="meta">${post.date} • ${post.mins || 5} min read</div>
        </header>
        <div>
          ${html}
        </div>
      `;
      // Syntax highlighting
      if (typeof hljs !== 'undefined') hljs.highlightAll();
      window.scrollTo(0, 0);

      // Add simple styles for markdown content dynmically if needed
      // (Or rely on styles.css globally)

    } catch (err) {
      contentArea.innerHTML = `<p>Error loading post: ${err.message}</p>`;
    }
  };


  // --- LIST LOGIC ---

  const applyFilters = () => {
    if (!postsContainer) return;

    const url = new URL(location.href);
    // Only check 'tag' param if we are NOT in post mode
    const activeTag = (url.searchParams.get('tag') || '').trim();

    let arr = [...state.allPosts];
    if (state.filterFormat !== 'all') {
      arr = arr.filter(p => (p.format || '').toLowerCase() === state.filterFormat);
    }

    if (activeTag && !url.searchParams.get('post')) {
      arr = arr.filter(p => (p.tags || []).map(x => String(x).toLowerCase()).includes(activeTag.toLowerCase()));
    }

    if (state.term) {
      const q = state.term.toLowerCase();
      arr = arr.filter(p => (p.title + ' ' + (p.excerpt || '') + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q));
    }

    // sort
    if (state.sort === 'newest') arr.sort((a, b) => new Date(b.date) - new Date(a.date));
    else if (state.sort === 'oldest') arr.sort((a, b) => new Date(a.date) - new Date(b.date));
    else if (state.sort === 'views') arr.sort((a, b) => (b.views || 0) - (a.views || 0));

    // pinned first
    arr.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    state.view = arr;
    state.page = 1;
    renderPage();
  };

  const renderCard = (p) => {
    const a = document.createElement('a');
    a.className = 'post-card';
    a.href = `?post=${p.id}`; // Fallback href
    a.style.cursor = 'pointer';

    a.addEventListener('click', (e) => {
      e.preventDefault();
      const u = new URL(location.href);
      u.searchParams.set('post', p.id);
      history.pushState({}, '', u.toString());
      showPost(p.id);
    });

    const badge = `<span class="badge">${(p.format || '').toUpperCase() || 'POST'}</span>`;
    const chips = (p.tags || []).slice(0, 4).map(t => `<button class=\"post-chip\" data-tag=\"${t}\" type=\"button\">${t}</button>`).join('');
    const mins = p.mins ? ` • ~${p.mins} min` : '';
    a.innerHTML = `
      <h3 class="post-title">${p.title}</h3>
      <p class="post-excerpt">${p.excerpt || ''}</p>
      <div class="post-meta">${p.date}${mins} • <span class="chips inline">${chips}</span> ${badge}</div>
    `;
    return a;
  };

  const renderPage = () => {
    if (!postsContainer) return;
    const start = (state.page - 1) * state.pageSize;
    const slice = state.view.slice(start, start + state.pageSize);
    postsContainer.innerHTML = '';
    if (slice.length === 0) {
      postsContainer.innerHTML = '<div style="color:#b8b8b8">No posts match the filter.</div>';
    } else {
      slice.forEach(p => postsContainer.appendChild(renderCard(p)));

      // bind tag chips inside cards
      postsContainer.querySelectorAll('button.post-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const t = btn.dataset.tag;
          const u = new URL(location.href);
          u.searchParams.set('tag', t);
          u.searchParams.delete('post');
          history.pushState({}, '', u.toString());
          state.term = '';
          const searchInput = document.getElementById('post-search');
          if (searchInput) searchInput.value = '';
          showList();
        });
      });
    }

    // pager
    const btnPrev = document.getElementById('prev-page');
    const btnNext = document.getElementById('next-page');
    if (btnPrev && btnNext) {
      btnPrev.disabled = state.page === 1;
      btnNext.disabled = start + state.pageSize >= state.view.length;
    }
  };

  const init = async () => {
    await loadPostsData();

    // UI events
    const searchInput = document.getElementById('post-search');
    const sortSelect = document.getElementById('post-sort');
    const tabs = document.getElementById('post-tabs');
    const btnPrev = document.getElementById('prev-page');
    const btnNext = document.getElementById('next-page');

    const debounce = (fn, ms) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };

    if (searchInput) searchInput.addEventListener('input', debounce((e) => { state.term = e.target.value.trim(); applyFilters(); }, 250));
    if (sortSelect) sortSelect.addEventListener('change', (e) => { state.sort = e.target.value; applyFilters(); });
    if (tabs) tabs.addEventListener('click', (e) => {
      const b = e.target.closest('.post-tab');
      if (!b) return;
      tabs.querySelectorAll('.post-tab').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      state.filterFormat = b.dataset.filter;
      applyFilters();
    });
    if (btnPrev) btnPrev.addEventListener('click', () => { if (state.page > 1) { state.page--; renderPage(); } });
    if (btnNext) btnNext.addEventListener('click', () => { const max = Math.ceil(state.view.length / state.pageSize); if (state.page < max) { state.page++; renderPage(); } });

    // Sidebar tag clicks
    document.querySelectorAll('.chip').forEach(chip => {
      chip.style.cursor = 'pointer';
      chip.addEventListener('click', () => {
        const t = chip.textContent.trim();
        const u = new URL(location.href);
        u.searchParams.set('tag', t);
        u.searchParams.delete('post');
        history.pushState({}, '', u.toString());
        state.term = '';
        if (searchInput) searchInput.value = '';
        showList();
      });
    });

    handleRoute();
  };

  if (document.getElementById('posts')) {
    init();
  }

})();
