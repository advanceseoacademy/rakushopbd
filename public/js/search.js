/**
 * Live product search — suggestions as you type
 */
(function () {
  const API = (window.RAKU_API_BASE || '') + '/api';
  let debounceTimer = null;
  let activeIndex = -1;
  let lastResults = [];

  const input = document.getElementById('search-input');
  const dropdown = document.getElementById('search-suggest');
  const categorySelect = document.getElementById('search-category');
  const searchBtn = document.getElementById('search-btn');
  const clearBtn = document.getElementById('search-clear');

  if (!input || !dropdown) return;

  function updateClearBtn() {
    if (!clearBtn) return;
    const hasText = input.value.trim().length > 0;
    clearBtn.hidden = !hasText;
  }

  function fmtPrice(n) {
    return '৳' + Number(n).toLocaleString('en-US');
  }

  function getCategory() {
    return categorySelect?.value || 'all';
  }

  function hideSuggest() {
    dropdown.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  }

  function showSuggest() {
    dropdown.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function suggestThumbHtml(p) {
    if (p.image_url) {
      const alt = escapeHtml((p.image_alt || p.name_bn || 'Product').trim());
      const src = escapeHtml(p.image_url);
      return `<img src="${src}" alt="${alt}" width="48" height="48" loading="lazy" decoding="async">`;
    }
    const raw = String(p.icon || 'ti-package').trim();
    const iconClass = raw.startsWith('ti ') ? raw : raw.startsWith('ti-') ? `ti ${raw}` : raw;
    return `<i class="${escapeHtml(iconClass)}" style="color:${escapeHtml(p.icon_color || '#2D6B32')};"></i>`;
  }

  function renderSuggest(list, state) {
    if (state === 'loading') {
      dropdown.innerHTML = '<div class="search-suggest-loading"><i class="ti ti-loader"></i> Searching...</div>';
      showSuggest();
      return;
    }
    if (!list.length) {
      dropdown.innerHTML = '<div class="search-suggest-empty">No products found</div>';
      showSuggest();
      return;
    }
    lastResults = list;
    const q = escapeHtml(input.value.trim());
    dropdown.innerHTML = `
      <div class="search-suggest-head">${list.length} result${list.length > 1 ? 's' : ''} for “${q}”</div>
      <div class="search-suggest-list">
        ${list
          .map(
            (p, i) => `<div class="search-suggest-item" role="option" id="search-opt-${i}" aria-selected="false" data-index="${i}" data-id="${p.id}">
          <div class="search-suggest-thumb" style="background:${escapeHtml(p.image_url ? '#fff' : p.bg_color)};">${suggestThumbHtml(p)}</div>
          <div class="search-suggest-info">
            <span class="search-suggest-name">${escapeHtml(p.name_bn)}</span>
            <span class="search-suggest-cat">${escapeHtml(p.category_name)}</span>
          </div>
          <span class="search-suggest-price">${fmtPrice(p.price)}</span>
        </div>`
          )
          .join('')}
      </div>
      <button type="button" class="search-suggest-footer" id="search-view-all" aria-label="View all search results">View all results</button>`;
    dropdown.querySelectorAll('.search-suggest-item').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        pickProduct(Number(el.dataset.id));
      });
    });
    document.getElementById('search-view-all')?.addEventListener('mousedown', (e) => {
      e.preventDefault();
      runFullSearch();
    });
    showSuggest();
  }

  async function fetchSuggestions(q) {
    const cat = getCategory();
    const params = new URLSearchParams({ search: q, limit: '8' });
    if (cat !== 'all') params.set('category', cat);
    const res = await fetch(`${API}/products?${params}`, { credentials: 'same-origin' });
    return res.json();
  }

  async function runSuggest() {
    const q = input.value.trim();
    if (q.length < 1) {
      hideSuggest();
      return;
    }
    renderSuggest([], 'loading');
    try {
      const data = await fetchSuggestions(q);
      if (input.value.trim() !== q) return;
      if (data.ok) renderSuggest(data.products || []);
      else renderSuggest([]);
    } catch (_) {
      renderSuggest([]);
    }
  }

  function pickProduct(id) {
    hideSuggest();
    input.blur();
    if (window.openProduct) window.openProduct(id);
    else if (window.showPage) window.showPage('product');
    else window.location.href = `/product/${encodeURIComponent(id)}`;
  }

  async function runFullSearch() {
    const q = input.value.trim();
    hideSuggest();
    updateClearBtn();
    if (!q) return;

    const cat = getCategory();
    if (window.openCategory) {
      const slug = cat !== 'all' ? cat : 'all';
      await window.openCategory(slug, { search: q });
      return;
    }

    if (window.showPage) window.showPage('home');
    else if (window.RAKU_STANDALONE) {
      const params = new URLSearchParams({ search: q });
      if (cat !== 'all') params.set('category', cat);
      window.location.href = `/?${params.toString()}`;
      return;
    }

    const params = new URLSearchParams({ search: q, limit: '24' });
    if (cat !== 'all') params.set('category', cat);

    try {
      const res = await fetch(`${API}/products?${params}`, { credentials: 'same-origin' });
      const data = await res.json();
      const grid = document.getElementById('main-product-grid');
      const titleEl = document.getElementById('products-section-title');
      if (!data.ok || !grid) return;

      if (titleEl) {
        titleEl.textContent = q ? `Results for “${q}”` : 'Popular Products';
      }

      if (!data.products.length) {
        grid.innerHTML =
          '<p style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">No products found. Try another keyword.</p>';
        return;
      }

      if (window.productCardHtml && window.bindProductGridEvents) {
        grid.innerHTML = data.products.map((p) => window.productCardHtml(p)).join('');
        window.bindProductGridEvents();
      }

      document.getElementById('products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (_) {}
  }

  function setActiveItem(idx) {
    const items = dropdown.querySelectorAll('.search-suggest-item');
    items.forEach((el, i) => {
      const active = i === idx;
      el.classList.toggle('active', active);
      el.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    activeIndex = idx;
    if (idx >= 0 && items[idx]) {
      input.setAttribute('aria-activedescendant', items[idx].id);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  input.addEventListener('input', () => {
    updateClearBtn();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(runSuggest, 280);
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      updateClearBtn();
      hideSuggest();
      input.focus();
    });
  }

  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.search-suggest-item');
    if (e.key === 'ArrowDown' && !dropdown.hidden && items.length) {
      e.preventDefault();
      setActiveItem(Math.min(activeIndex + 1, items.length - 1));
    } else if (e.key === 'ArrowUp' && !dropdown.hidden && items.length) {
      e.preventDefault();
      setActiveItem(Math.max(activeIndex - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!dropdown.hidden && activeIndex >= 0 && lastResults[activeIndex]) {
        pickProduct(lastResults[activeIndex].id);
      } else {
        runFullSearch();
      }
    } else if (e.key === 'Escape') {
      hideSuggest();
    }
  });

  if (searchBtn) {
    searchBtn.addEventListener('click', runFullSearch);
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      if (input.value.trim()) runSuggest();
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#header-search-wrap')) hideSuggest();
  });

  window.__RAKU_READY__ = true;
  document.dispatchEvent(new CustomEvent('raku:ready'));
})();
