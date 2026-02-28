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

  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const normalizeType = (post) => {
    const rawType = String(post?.type || post?.format || '').toLowerCase().trim();
    return rawType === 'paper' || rawType === 'pdf' ? 'paper' : 'blog';
  };

  const normalizePost = (post = {}, index = 0) => ({
    ...post,
    id: String(post.id || `post-${index + 1}`),
    title: String(post.title || `Untitled ${index + 1}`),
    excerpt: String(post.excerpt || ''),
    date: String(post.date || '1970-01-01'),
    file: String(post.file || post.url || ''),
    tags: Array.isArray(post.tags) ? post.tags.map((tag) => String(tag)) : [],
    type: normalizeType(post)
  });

  const toResourcePath = (filePath = '') => encodeURI(String(filePath || '').trim());

  const postsContainer = document.getElementById('posts');
  const articlePage = document.querySelector('article.page');
  const homeMetaEl = document.getElementById('home-meta');

  // Create a container for the single post view if it doesn't exist
  let postViewContainer = document.getElementById('post-view-container');
  if (!postViewContainer && articlePage) {
    postViewContainer = document.createElement('div');
    postViewContainer.id = 'post-view-container';
    postViewContainer.style.display = 'none';
    postViewContainer.innerHTML = `
      <div class="post-actions" style="margin-bottom: 2rem;">
        <button id="back-button" class="post-tab" style="cursor:pointer;" type="button">← Back to Posts</button>
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

  let state = { allPosts: [], view: [], page: 1, pageSize: 10, filterType: 'all', term: '', sort: 'newest' };

  const updateMeta = () => {
    if (!homeMetaEl) return;

    const total = state.allPosts.length;
    const paperCount = state.allPosts.filter((post) => post.type === 'paper').length;
    const latestDate = [...state.allPosts]
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date || new Date().toISOString().slice(0, 10);

    homeMetaEl.textContent = `${latestDate} · ${total} posts · ${paperCount} papers`;
  };

  const loadPostsData = async () => {
    try {
      if (state.allPosts.length > 0) return true;
      const res = await fetch('data/posts.json', { cache: 'no-store' });
      const raw = await res.json();
      state.allPosts = Array.isArray(raw) ? raw.map(normalizePost) : [];
      updateMeta();
      return true;
    } catch {
      return false;
    }
  };

  // --- ROUTER ---
  const handleRoute = async () => {
    const params = new URLSearchParams(location.search);
    const postId = params.get('post');

    if (postId) {
      await showPost(postId);
    } else {
      showList();
    }
  };

  window.addEventListener('popstate', handleRoute);

  // Switch to List View
  const showList = () => {
    if (!postsContainer) return;

    listElements.forEach((el) => { if (el) el.style.display = ''; });
    if (postViewContainer) postViewContainer.style.display = 'none';

    applyFilters();
    window.scrollTo(0, 0);
  };

  const goToHome = () => {
    const u = new URL(location.href);
    u.searchParams.delete('post');
    history.pushState({}, '', u.toString());
    showList();
  };

  const renderPaperPost = (post, contentArea) => {
    const filePath = toResourcePath(post.file);

    if (!filePath) {
      contentArea.innerHTML = '<p>Missing PDF file path.</p>';
      return;
    }

    contentArea.innerHTML = `
      <header class="post-header-detail" style="margin-bottom:2rem; border-bottom:1px solid #333; padding-bottom:1rem;">
        <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem; color: #f3d37a;">${escapeHtml(post.title)}</h1>
        <div class="meta">${escapeHtml(post.date)} • Paper</div>
        <p style="color:#cfcfcf; margin-top:.8rem;">${escapeHtml(post.excerpt || '')}</p>
      </header>
      <div style="margin-bottom: 1rem;">
        <a href="${escapeHtml(filePath)}" target="_blank" rel="noopener noreferrer">Open PDF in new tab</a>
      </div>
      <iframe class="post-paper-frame" src="${escapeHtml(filePath)}#view=FitH" title="${escapeHtml(post.title)}"></iframe>
    `;
  };

  const renderBlogPost = async (post, contentArea) => {
    const filePath = toResourcePath(post.file);

    if (!filePath) {
      contentArea.innerHTML = '<p>Missing markdown file path.</p>';
      return;
    }

    try {
      const res = await fetch(filePath);
      if (!res.ok) throw new Error('Failed to load markdown');
      const md = await res.text();

      const html = marked.parse(md);
      contentArea.innerHTML = `
        <header class="post-header-detail" style="margin-bottom:2rem; border-bottom:1px solid #333; padding-bottom:1rem;">
          <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem; color: #f3d37a;">${escapeHtml(post.title)}</h1>
          <div class="meta">${escapeHtml(post.date)} • ${post.mins || 5} min read</div>
        </header>
        <div>
          ${html}
        </div>
      `;
      if (typeof hljs !== 'undefined') hljs.highlightAll();
    } catch (err) {
      contentArea.innerHTML = `<p>Error loading post: ${escapeHtml(err.message)}</p>`;
    }
  };

  // Switch to Post View
  const showPost = async (id) => {
    listElements.forEach((el) => { if (el) el.style.display = 'none'; });
    if (postViewContainer) postViewContainer.style.display = 'block';

    const contentArea = document.getElementById('post-content-area');
    contentArea.innerHTML = '<p>Loading...</p>';

    await loadPostsData();
    const post = state.allPosts.find((p) => p.id === id);

    if (!post) {
      contentArea.innerHTML = '<p>Post not found.</p>';
      return;
    }

    if (post.type === 'paper') {
      renderPaperPost(post, contentArea);
    } else {
      await renderBlogPost(post, contentArea);
    }

    window.scrollTo(0, 0);
  };

  // --- LIST LOGIC ---

  const applyFilters = () => {
    if (!postsContainer) return;

    const url = new URL(location.href);
    const activeTag = (url.searchParams.get('tag') || '').trim();

    let arr = [...state.allPosts];
    if (state.filterType !== 'all') {
      arr = arr.filter((p) => p.type === state.filterType);
    }

    if (activeTag && !url.searchParams.get('post')) {
      arr = arr.filter((p) => (p.tags || []).map((x) => String(x).toLowerCase()).includes(activeTag.toLowerCase()));
    }

    if (state.term) {
      const q = state.term.toLowerCase();
      arr = arr.filter((p) => (p.title + ' ' + (p.excerpt || '') + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q));
    }

    if (state.sort === 'newest') arr.sort((a, b) => new Date(b.date) - new Date(a.date));
    else if (state.sort === 'oldest') arr.sort((a, b) => new Date(a.date) - new Date(b.date));
    else if (state.sort === 'views') arr.sort((a, b) => (b.views || 0) - (a.views || 0));

    arr.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    state.view = arr;
    state.page = 1;
    renderPage();
  };

  const renderCard = (p) => {
    const a = document.createElement('a');
    a.className = 'post-card';
    a.href = `?post=${encodeURIComponent(p.id)}`;
    a.style.cursor = 'pointer';

    a.addEventListener('click', (e) => {
      e.preventDefault();
      const u = new URL(location.href);
      u.searchParams.set('post', p.id);
      history.pushState({}, '', u.toString());
      showPost(p.id);
    });

    const badge = `<span class="badge">${p.type === 'paper' ? 'PAPER' : 'BLOG'}</span>`;
    const chips = (p.tags || [])
      .slice(0, 4)
      .map((t) => `<button class="post-chip" data-tag="${escapeHtml(t)}" type="button">${escapeHtml(t)}</button>`)
      .join('');
    const mins = p.mins ? ` • ~${p.mins} min` : '';
    a.innerHTML = `
      <h3 class="post-title">${escapeHtml(p.title)}</h3>
      <p class="post-excerpt">${escapeHtml(p.excerpt || '')}</p>
      <div class="post-meta">${escapeHtml(p.date)}${mins} • <span class="chips inline">${chips}</span> ${badge}</div>
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
      slice.forEach((p) => postsContainer.appendChild(renderCard(p)));

      // bind tag chips inside cards
      postsContainer.querySelectorAll('button.post-chip').forEach((btn) => {
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

    const btnPrev = document.getElementById('prev-page');
    const btnNext = document.getElementById('next-page');
    if (btnPrev && btnNext) {
      btnPrev.disabled = state.page === 1;
      btnNext.disabled = start + state.pageSize >= state.view.length;
    }
  };

  const init = async () => {
    await loadPostsData();

    const searchInput = document.getElementById('post-search');
    const sortSelect = document.getElementById('post-sort');
    const tabs = document.getElementById('post-tabs');
    const btnPrev = document.getElementById('prev-page');
    const btnNext = document.getElementById('next-page');

    const debounce = (fn, ms) => {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
      };
    };

    if (searchInput) {
      searchInput.addEventListener('input', debounce((e) => {
        state.term = e.target.value.trim();
        applyFilters();
      }, 250));
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        state.sort = e.target.value;
        applyFilters();
      });
    }

    if (tabs) {
      tabs.addEventListener('click', (e) => {
        const b = e.target.closest('.post-tab');
        if (!b) return;
        tabs.querySelectorAll('.post-tab').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        state.filterType = b.dataset.filter;
        applyFilters();
      });
    }

    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (state.page > 1) {
          state.page--;
          renderPage();
        }
      });
    }

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        const max = Math.ceil(state.view.length / state.pageSize);
        if (state.page < max) {
          state.page++;
          renderPage();
        }
      });
    }

    // Sidebar tag clicks
    document.querySelectorAll('.chip').forEach((chip) => {
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
