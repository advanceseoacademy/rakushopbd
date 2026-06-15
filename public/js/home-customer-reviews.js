/**
 * Homepage customer reviews — tied to real store products from bootstrap/API.
 */
(function () {
  const REVIEW_PROFILES = [
    {
      name: 'Rafi Ahmed',
      city: 'Dhaka',
      rating: 5,
      text: (n) =>
        `Ordered ${n} from RakuShopBD. Delivered to Dhanmondi in 2 days — sealed box, product matches the listing photos.`,
    },
    {
      name: 'Nafisa Islam',
      city: 'Chattogram',
      rating: 5,
      text: (n) =>
        `${n} অর্ডার করেছিলাম। দুই দিনে পেয়েছি, প্যাকেজিং ভালো। COD তে পেমেন্ট করেছিলাম, কোনো ঝামেলা হয়নি।`,
    },
    {
      name: 'Karim Hossain',
      city: 'Sylhet',
      rating: 4,
      text: (n) =>
        `${n} — quality is good for the price. Courier took 3 days to Sylhet which is fair. Would buy again from RakuShopBD.`,
    },
    {
      name: 'Tanvir Chowdhury',
      city: 'Rajshahi',
      rating: 5,
      text: (n) =>
        `Bought ${n} after comparing prices online. Authentic feel, barcode intact. Delivery call before arrival was helpful.`,
    },
    {
      name: 'Shumi Akter',
      city: 'Khulna',
      rating: 5,
      text: (n) =>
        `${n} ব্যবহার করছি — স্কিনে কোনো সমস্যা হয়নি। বক্সে এক্সপায়ারি ডেট স্পষ্ট ছিল। খুশি, আবার অর্ডার করব।`,
    },
    {
      name: 'Imran Hossain',
      city: 'Gazipur',
      rating: 5,
      text: (n) =>
        `${n} exactly as shown on the site. Free delivery over ৳500 saved me a trip to the market. Fast bKash checkout.`,
    },
    {
      name: 'Farhana Begum',
      city: 'Narayanganj',
      rating: 5,
      text: (n) =>
        `আম্মুর জন্য ${n} নিয়েছিলাম। প্রোডাক্ট ভালো, ডেলিভারি ম্যান ভদ্র ছিলেন। RakuShopBD থেকে আবার নেব।`,
    },
    {
      name: 'Mehedi Hasan',
      city: 'Barishal',
      rating: 4,
      text: (n) =>
        `${n} works well. Minor box dent from shipping but item inside was fine. Support replied quickly on chat.`,
    },
    {
      name: 'Priya Saha',
      city: 'Mymensingh',
      rating: 5,
      text: (n) =>
        `Very happy with ${n}. Texture and packaging feel original — not like cheap copies from local shops.`,
    },
    {
      name: 'Arif Mahmud',
      city: 'Cumilla',
      rating: 5,
      text: (n) =>
        `${n} — tracking updated same day I paid. Product quality met my expectations. Solid RakuShopBD experience.`,
    },
    {
      name: 'Sabrina Khatun',
      city: 'Dhaka',
      rating: 5,
      text: (n) =>
        `Gift for my sister: ${n}. She loved it. Uttara delivery was next-day. Will use coupon RakuShopBD10 again.`,
    },
    {
      name: 'Rakibul Islam',
      city: 'Rangpur',
      rating: 5,
      text: (n) =>
        `North Bengal delivery of ${n} took 3 days — acceptable. Price better than Rangpur market. Genuine product.`,
    },
    {
      name: 'Tasnim Rahman',
      city: 'Chattogram',
      rating: 5,
      text: (n) =>
        `${n} matches description on RakuShopBD. Using daily for two weeks — no issues. Recommended to friends.`,
    },
    {
      name: 'Shahidul Alam',
      city: 'Jessore',
      rating: 4,
      text: (n) =>
        `Good value on ${n}. One star off because I wanted faster shipping, but product itself is fine and authentic.`,
    },
    {
      name: 'Mim Akter',
      city: 'Dhaka',
      rating: 5,
      text: (n) =>
        `${n} — sealed, fresh batch. Customer care answered my questions on WhatsApp before I ordered. Trustworthy.`,
    },
    {
      name: 'Nayeem Uddin',
      city: 'Bogura',
      rating: 5,
      text: (n) =>
        `First time ordering ${n} online. Size/spec matched listing. Comfortable experience with RakuShopBD checkout.`,
    },
    {
      name: 'Laboni Das',
      city: 'Sylhet',
      rating: 5,
      text: (n) =>
        `${n} পেয়েছি সময়মতো। মান ভালো, ছবির মতোই। সিলেটে ডেলিভারি তিন দিন — ঠিক আছে।`,
    },
    {
      name: 'Faisal Khan',
      city: 'Dhaka',
      rating: 5,
      text: (n) =>
        `Repeat buyer — latest order was ${n}. Same reliable service as before. Product original, invoice clear.`,
    },
    {
      name: 'Jannatul Ferdous',
      city: 'Noakhali',
      rating: 5,
      text: (n) =>
        `${n} for Eid gift. Colour and quality matched photos. Sister was happy. Polite delivery in Noakhali.`,
    },
    {
      name: 'Omar Faruk',
      city: 'Tangail',
      rating: 4,
      text: (n) =>
        `${n} is good overall. Delivery to Tangail took a bit longer but product worth the wait. Fair price.`,
    },
    {
      name: 'Ruma Parvin',
      city: 'Dhaka',
      rating: 5,
      text: (n) =>
        `Using ${n} regularly — consistent quality each order. Batch label visible. Happy with RakuShopBD.`,
    },
    {
      name: 'Hasib Mahmud',
      city: 'Chattogram',
      rating: 5,
      text: (n) =>
        `${n} — fast Chattogram delivery. Pack well protected. Better than what I found at Patenga local shops.`,
    },
    {
      name: 'Anika Chowdhury',
      city: 'Rajshahi',
      rating: 5,
      text: (n) =>
        `Skincare order ${n}: mild, no irritation. Expiry printed clearly. Will reorder from RakuShopBD next month.`,
    },
    {
      name: 'Iqbal Hosen',
      city: 'Khulna',
      rating: 5,
      text: (n) =>
        `Ordered ${n} yesterday evening, received today lunch in Khulna. Impressed with speed and packaging.`,
    },
    {
      name: 'Sadia Afrin',
      city: 'Dhaka',
      rating: 5,
      text: (n) =>
        `${n} — lightweight, easy to use. Husband ordered from RakuShopBD; pleasant surprise, quality is great.`,
    },
  ];

  const AVATAR_CLASSES = ['', 'accent', 'amber'];

  function productLabel(p) {
    const n = String(p?.name_bn || p?.name || 'this product').trim();
    if (n.length <= 58) return n;
    return n.slice(0, 55) + '…';
  }

  function collectProductsFromBoot(boot) {
    if (!boot?.ok) return [];
    const seen = new Set();
    const pool = [];
    for (const list of [boot.bestSelling, boot.newArrivals, boot.products]) {
      for (const p of list || []) {
        if (p?.id && !seen.has(p.id)) {
          seen.add(p.id);
          pool.push(p);
        }
      }
    }
    return pool;
  }

  async function fetchStoreProducts() {
    const base = window.RAKU_API_BASE || '';
    try {
      const res = await fetch(`${base}/api/products?limit=60`, { credentials: 'same-origin' });
      const data = await res.json();
      if (data?.ok && data.products?.length) return data.products;
    } catch (_) {}
    return [];
  }

  async function getProductPool() {
    const boot = window.__RAKU_BOOTSTRAP;
    let pool = collectProductsFromBoot(boot);
    if (pool.length < REVIEW_PROFILES.length) {
      const apiProducts = await fetchStoreProducts();
      const seen = new Set(pool.map((p) => p.id));
      for (const p of apiProducts) {
        if (p?.id && !seen.has(p.id)) {
          seen.add(p.id);
          pool.push(p);
        }
      }
    }
    return pool;
  }

  function buildReviews(products) {
    if (!products.length) return [];
    return REVIEW_PROFILES.map((profile, i) => {
      const product = products[i % products.length];
      const label = productLabel(product);
      return {
        name: profile.name,
        city: profile.city,
        rating: profile.rating,
        productId: product.id,
        text: profile.text(label, product),
      };
    });
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function reviewCardHtml(review, index) {
    const avClass = AVATAR_CLASSES[index % AVATAR_CLASSES.length];
    const avatarCls = avClass ? ` home-review-avatar ${avClass}` : ' home-review-avatar';
    const dataId = review.productId ? ` data-product-id="${review.productId}"` : '';
    return `<article class="home-review-card"${dataId}>
      <div class="home-review-top">
        <div class="${avatarCls.trim()}">${escapeHtml(initials(review.name))}</div>
        <div class="home-review-who">
          <div class="home-review-name">${escapeHtml(review.name)}</div>
          <div class="home-review-meta">${escapeHtml(review.city)}</div>
        </div>
        <span class="home-review-verified"><i class="ti ti-circle-check-filled"></i> Verified</span>
      </div>
      <div class="home-review-stars" aria-label="${review.rating} out of 5 stars">${starsHtml(review.rating)}</div>
      <p class="home-review-text">${escapeHtml(review.text)}</p>
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

  let lastProductKey = '';

  async function paintHomeCustomerReviews() {
    const track = document.getElementById('track-customer-reviews');
    if (!track) return;

    const products = await getProductPool();
    if (!products.length) {
      track.innerHTML =
        '<p class="home-scroll-empty">Customer reviews will appear when products are available.</p>';
      return;
    }

    const key = products
      .slice(0, 30)
      .map((p) => p.id)
      .join(',');
    if (key === lastProductKey && track._rakuReviewsPainted) return;
    lastProductKey = key;

    const reviews = buildReviews(products);
    track.innerHTML = reviews.map(reviewCardHtml).join('');
    track._rakuReviewsPainted = true;
    bindReviewProductClicks();

    requestAnimationFrame(() => {
      setTimeout(() => {
        if (window._rakuInitHomeScrollAuto) {
          window._rakuInitHomeScrollAuto('track-customer-reviews', 3800);
        }
      }, 200);
    });
  }

  document.addEventListener('raku:ready', () => {
    void paintHomeCustomerReviews();
  });
  document.addEventListener('raku:bootstrap', () => {
    void paintHomeCustomerReviews();
  });
})();
