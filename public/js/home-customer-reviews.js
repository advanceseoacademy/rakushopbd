/**
 * Homepage customer reviews — approved DB reviews (admin-managed), with synthetic fallback.
 */
(function () {
  const AVATAR_CLASSES = ['', 'accent', 'amber'];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initials(name) {
    return (name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  function starsHtml(rating) {
    const r = Math.max(1, Math.min(5, Math.round(Number(rating) || 5)));
    let html = '';
    for (let i = 1; i <= 5; i++) {
      const filled = i <= r;
      html += `<i class="ti ti-star-filled${filled ? '' : ' dim'}" aria-hidden="true"></i>`;
    }
    return html;
  }

  function reviewMeta(review) {
    const city = String(review.reviewer_city || review.city || '').trim();
    if (city) return city;
    const productName = String(review.product_name || review.productName || '').trim();
    if (productName) return productName.length > 42 ? productName.slice(0, 39) + '…' : productName;
    return 'Verified buyer';
  }

  function avatarHtml(review, index) {
    const url = String(review.reviewer_avatar_url || review.avatarUrl || '').trim();
    const avClass = AVATAR_CLASSES[index % AVATAR_CLASSES.length];
    const avatarCls = avClass ? ` home-review-avatar ${avClass}` : ' home-review-avatar';
    const name = review.customer_name || review.customerName || 'Customer';
    if (url) {
      return `<div class="home-review-avatar-wrap">${`<img class="home-review-avatar-img" src="${escapeHtml(url)}" alt="" width="52" height="52" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false;">`}<div class="${avatarCls.trim()}" hidden>${escapeHtml(initials(name))}</div></div>`;
    }
    return `<div class="${avatarCls.trim()}">${escapeHtml(initials(name))}</div>`;
  }

  function reviewCardHtml(review, index) {
    const productId = review.product_id || review.productId;
    const dataId = productId ? ` data-product-id="${productId}"` : '';
    const name = review.customer_name || review.customerName || 'Customer';
    const text = review.comment || '';
    const rating = review.rating || 5;

    return `<article class="home-review-card"${dataId}>
      <div class="home-review-top">
        ${avatarHtml(review, index)}
        <div class="home-review-who">
          <div class="home-review-name">${escapeHtml(name)}</div>
          <div class="home-review-meta">${escapeHtml(reviewMeta(review))}</div>
        </div>
        <span class="home-review-verified"><i class="ti ti-circle-check-filled"></i> Verified</span>
      </div>
      <div class="home-review-stars" role="img" aria-label="${rating} out of 5 stars">${starsHtml(rating)}</div>
      <p class="home-review-text">${escapeHtml(text)}</p>
    </article>`;
  }

  function bindReviewProductClicks() {
    document.querySelectorAll('.home-review-card[data-product-id]').forEach((card) => {
      if (card._rakuReviewClick) return;
      card._rakuReviewClick = true;
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        const id = Number(card.dataset.productId);
        if (id && window.openProduct) window.openProduct(id);
      });
    });
  }

  async function fetchHomeReviews() {
    const base = window.RAKU_API_BASE || '';
    try {
      const res = await fetch(`${base}/api/reviews/home?limit=25`, { credentials: 'same-origin' });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.reviews)) return data.reviews;
    } catch (_) {}
    return [];
  }

  let lastReviewKey = '';

  async function paintHomeCustomerReviews() {
    const track = document.getElementById('track-customer-reviews');
    if (!track) return;

    const reviews = await fetchHomeReviews();
    if (!reviews.length) {
      track.innerHTML =
        '<p class="home-scroll-empty">Customer reviews will appear when products are available.</p>';
      track._rakuReviewsPainted = true;
      return;
    }

    const key = reviews.map((r) => r.id).join(',');
    if (key === lastReviewKey && track._rakuReviewsPainted) return;
    lastReviewKey = key;

    track.innerHTML = reviews.map(reviewCardHtml).join('');
    track._rakuReviewsPainted = true;
    bindReviewProductClicks();

    requestAnimationFrame(() => {
      if (window._rakuSyncHomeScrollCardWidths) {
        window._rakuSyncHomeScrollCardWidths('track-customer-reviews', '.home-review-card', 140);
      }
      if (window._rakuInitHomeScrollAuto) {
        window._rakuInitHomeScrollAuto('track-customer-reviews', 3800);
      }
    });
  }

  document.addEventListener('raku:ready', () => {
    if (window.rakuWhenVisible) {
      window.rakuWhenVisible('section-customer-reviews', () => void paintHomeCustomerReviews(), { rootMargin: '240px' });
    } else {
      void paintHomeCustomerReviews();
    }
  });
  document.addEventListener('raku:bootstrap', () => {
    if (window.rakuWhenVisible) {
      window.rakuWhenVisible('section-customer-reviews', () => void paintHomeCustomerReviews(), { rootMargin: '240px' });
    } else if (window.rakuScheduleIdle) {
      window.rakuScheduleIdle(() => void paintHomeCustomerReviews(), { timeout: 3000 });
    } else {
      void paintHomeCustomerReviews();
    }
  });

  if (document.readyState !== 'loading' && !window.rakuWhenVisible) {
    void paintHomeCustomerReviews();
  }
})();
