/** Storefront review templates — human-style copy for homepage + product pages. */
const REVIEW_TEMPLATES = [
  {
    name: 'Rafi Ahmed',
    city: 'Dhaka',
    rating: 5,
    text: (n) =>
      `Ordered ${n} last week. Box was sealed properly and the delivery guy called before arriving. Exactly what I expected.`,
  },
  {
    name: 'Nafisa Islam',
    city: 'Chattogram',
    rating: 5,
    text: (n) =>
      `${n} অর্ডার করেছিলাম। দুই দিনে পেয়েছি, প্যাকেজিং ভালো ছিল। COD তে কোনো ঝামেলা হয়নি।`,
  },
  {
    name: 'Karim Hossain',
    city: 'Sylhet',
    rating: 4,
    text: (n) =>
      `${n} — quality is good for the price. Courier took 3 days to Sylhet, which is fair. Would order again.`,
  },
  {
    name: 'Tanvir Chowdhury',
    city: 'Rajshahi',
    rating: 5,
    text: (n) =>
      `Compared a few sites before buying ${n}. Barcode and packaging looked original. Delivery update was helpful.`,
  },
  {
    name: 'Shumi Akter',
    city: 'Khulna',
    rating: 5,
    text: (n) =>
      `${n} ব্যবহার করছি — স্কিনে কোনো সমস্যা হয়নি। এক্সপায়ারি ডেট স্পষ্ট ছিল। খুশি।`,
  },
  {
    name: 'Imran Hossain',
    city: 'Gazipur',
    rating: 5,
    text: (n) =>
      `${n} matches the photos on the site. Saved on delivery too. Checkout with bKash was smooth.`,
  },
  {
    name: 'Farhana Begum',
    city: 'Narayanganj',
    rating: 5,
    text: (n) =>
      `আম্মুর জন্য ${n} নিয়েছিলাম। মান ভালো, ডেলিভারি ম্যান ভদ্র ছিলেন।`,
  },
  {
    name: 'Mehedi Hasan',
    city: 'Barishal',
    rating: 4,
    text: (n) =>
      `${n} works fine. Outer box had a small dent but the product inside was okay. Support replied on chat quickly.`,
  },
  {
    name: 'Priya Saha',
    city: 'Mymensingh',
    rating: 5,
    text: (n) =>
      `Very happy with ${n}. Texture and packaging feel genuine — not like the cheap copies in local shops.`,
  },
  {
    name: 'Arif Mahmud',
    city: 'Cumilla',
    rating: 5,
    text: (n) =>
      `Tracking updated the same day I paid. ${n} met my expectations. Solid shopping experience overall.`,
  },
  {
    name: 'Sabrina Khatun',
    city: 'Dhaka',
    rating: 5,
    text: (n) =>
      `Gift for my sister — ${n}. She loved it. Uttara delivery came next day. Will order again.`,
  },
  {
    name: 'Rakibul Islam',
    city: 'Rangpur',
    rating: 5,
    text: (n) =>
      `Got ${n} in 3 days to Rangpur. Price was better than local market and product felt authentic.`,
  },
  {
    name: 'Tasnim Rahman',
    city: 'Chattogram',
    rating: 5,
    text: (n) =>
      `Using ${n} daily for two weeks now. No issues so far. Already told two friends about it.`,
  },
  {
    name: 'Shahidul Alam',
    city: 'Jessore',
    rating: 4,
    text: (n) =>
      `Good value on ${n}. Took a bit longer to ship than I hoped, but the item itself is fine.`,
  },
  {
    name: 'Mim Akter',
    city: 'Dhaka',
    rating: 5,
    text: (n) =>
      `${n} arrived sealed with a fresh batch label. Asked a question on WhatsApp before ordering — quick reply.`,
  },
  {
    name: 'Nayeem Uddin',
    city: 'Bogura',
    rating: 5,
    text: (n) =>
      `First time buying ${n} online. Size and details matched the listing. Checkout felt easy and safe.`,
  },
  {
    name: 'Laboni Das',
    city: 'Sylhet',
    rating: 5,
    text: (n) =>
      `${n} পেয়েছি সময়মতো। মান ভালো, ছবির মতোই। সিলেটে তিন দিন — acceptable.`,
  },
  {
    name: 'Faisal Khan',
    city: 'Dhaka',
    rating: 5,
    text: (n) =>
      `Repeat order — ${n} again. Same good quality as last time. Invoice was clear in the package.`,
  },
  {
    name: 'Jannatul Ferdous',
    city: 'Noakhali',
    rating: 5,
    text: (n) =>
      `Bought ${n} as an Eid gift. Colour and quality matched the photos. Delivery person was polite.`,
  },
  {
    name: 'Omar Faruk',
    city: 'Tangail',
    rating: 4,
    text: (n) =>
      `${n} is good overall. Tangail delivery took an extra day but worth the wait for this price.`,
  },
  {
    name: 'Ruma Parvin',
    city: 'Dhaka',
    rating: 5,
    text: (n) =>
      `I reorder ${n} every few months. Quality stays consistent. Batch date always visible on box.`,
  },
  {
    name: 'Hasib Mahmud',
    city: 'Chattogram',
    rating: 5,
    text: (n) =>
      `${n} — fast delivery to Chattogram. Well packed. Better than what I found near Patenga market.`,
  },
  {
    name: 'Anika Chowdhury',
    city: 'Rajshahi',
    rating: 5,
    text: (n) =>
      `Skincare order: ${n}. Mild formula, no irritation on my sensitive skin. Expiry printed clearly.`,
  },
  {
    name: 'Iqbal Hosen',
    city: 'Khulna',
    rating: 5,
    text: (n) =>
      `Ordered ${n} yesterday evening, got it today after lunch. Impressed with the speed and packaging.`,
  },
  {
    name: 'Sadia Afrin',
    city: 'Dhaka',
    rating: 5,
    text: (n) =>
      `${n} — lightweight and easy to use. My husband ordered it; pleasant surprise, quality is great.`,
  },
  {
    name: 'Zahid Hasan',
    city: 'Dhaka',
    rating: 5,
    text: (n) =>
      `Honest review: ${n} does what it says. No fancy claims, just a good product at a fair price.`,
  },
  {
    name: 'Mahmudul Islam',
    city: 'Chattogram',
    rating: 4,
    text: (n) =>
      `${n} is decent. Packaging could be a little tighter but product inside was untouched and fresh.`,
  },
  {
    name: 'Tania Rahman',
    city: 'Sylhet',
    rating: 5,
    text: (n) =>
      `My sister recommended ${n}. She was right — works well and smells/feels like the real thing.`,
  },
  {
    name: 'Kamal Uddin',
    city: 'Rajshahi',
    rating: 5,
    text: (n) =>
      `COD order of ${n}. Counted the change, checked the seal — all good. Will buy from here again.`,
  },
  {
    name: 'Samira Khan',
    city: 'Dhaka',
    rating: 5,
    text: (n) =>
      `Was skeptical about ordering ${n} online but it arrived properly wrapped. Using it for 10 days — no complaints.`,
  },
  {
    name: 'Rubel Mia',
    city: 'Mymensingh',
    rating: 4,
    text: (n) =>
      `${n} — good product. Delivery to Mymensingh took 4 days. One star off only for the wait.`,
  },
  {
    name: 'Nusrat Jahan',
    city: 'Barishal',
    rating: 5,
    text: (n) =>
      `${n} পছন্দ হয়েছে। বক্স ভালোভাবে প্যাক করা ছিল। Barishal এ তিন দিনে পেয়েছি।`,
  },
  {
    name: 'Ashikur Rahman',
    city: 'Gazipur',
    rating: 5,
    text: (n) =>
      `Got ${n} for my wife. She uses it every day now. Original looking seal and batch number on pack.`,
  },
  {
    name: 'Priyanka Das',
    city: 'Khulna',
    rating: 5,
    text: (n) =>
      `Love ${n}! Texture is exactly what I wanted. Khulna delivery was faster than I expected.`,
  },
  {
    name: 'Habibur Rahman',
    city: 'Cumilla',
    rating: 5,
    text: (n) =>
      `Third time buying ${n}. Never had a bad batch. Reliable store for skincare in my opinion.`,
  },
  {
    name: 'Lamia Akter',
    city: 'Dhaka',
    rating: 4,
    text: (n) =>
      `${n} is nice. Slightly smaller than I imagined from the photo but quality is still good.`,
  },
  {
    name: 'Shohel Rana',
    city: 'Rangpur',
    rating: 5,
    text: (n) =>
      `North Bengal is hard for delivery sometimes but ${n} came in good condition. Happy customer.`,
  },
  {
    name: 'Mousumi Begum',
    city: 'Narayanganj',
    rating: 5,
    text: (n) =>
      `অফিসের পর ${n} ব্যবহার করি। দুই সপ্তাহ হয়ে গেছে, ভালো ফল পাচ্ছি।`,
  },
  {
    name: 'Tanvir Ahmed',
    city: 'Jessore',
    rating: 5,
    text: (n) =>
      `Quick order, quick delivery. ${n} looks legit — hologram/sticker on box was intact.`,
  },
  {
    name: 'Farzana Yasmin',
    city: 'Chattogram',
    rating: 5,
    text: (n) =>
      `Bought ${n} during a sale. Still would have been worth full price. Skin feels better already.`,
  },
  {
    name: 'Rony Das',
    city: 'Sylhet',
    rating: 4,
    text: (n) =>
      `${n} — overall satisfied. Box corner was bent but product was fine inside. 4 stars.`,
  },
  {
    name: 'Ayesha Siddika',
    city: 'Dhaka',
    rating: 5,
    text: (n) =>
      `Finally found ${n} at a reasonable price online. Original pack, not opened. Very relieved.`,
  },
  {
    name: 'Masud Rana',
    city: 'Bogura',
    rating: 5,
    text: (n) =>
      `Simple review: ${n} good, delivery good, price good. Nothing to complain about.`,
  },
  {
    name: 'Ishrat Hossain',
    city: 'Tangail',
    rating: 5,
    text: (n) =>
      `My mom asked me to order ${n}. She said quality is better than the shop near our house.`,
  },
  {
    name: 'Nabil Chowdhury',
    city: 'Dhaka',
    rating: 5,
    text: (n) =>
      `Used ${n} for about a month. Consistent results. Reordering before this one runs out.`,
  },
  {
    name: 'Sharmin Akter',
    city: 'Khulna',
    rating: 4,
    text: (n) =>
      `${n} works well on my dry skin. Wish the bottle was a bit bigger but no issue with quality.`,
  },
  {
    name: 'Jahid Hasan',
    city: 'Rajshahi',
    rating: 5,
    text: (n) =>
      `Delivery man was on time with ${n}. Product sealed, expiry date 2027 — fresh stock.`,
  },
  {
    name: 'Mariya Islam',
    city: 'Gazipur',
    rating: 5,
    text: (n) =>
      `Got ${n} as a trial. Liked it enough to order two more. Fast response from customer care too.`,
  },
  {
    name: 'Saiful Islam',
    city: 'Cumilla',
    rating: 5,
    text: (n) =>
      `No drama — paid, got ${n}, product matches listing. That's all I wanted.`,
  },
  {
    name: 'Tahmina Begum',
    city: 'Noakhali',
    rating: 5,
    text: (n) =>
      `${n} ভালো প্রোডাক্ট। Noakhala এ ডেলিভারি একটু দেরি হলেও মানে কোনো সমস্যা নেই।`,
  },
  {
    name: 'Adnan Karim',
    city: 'Dhaka',
    rating: 4,
    text: (n) =>
      `${n} is solid. Not the cheapest online but you can tell it's not fake. That matters to me.`,
  },
  {
    name: 'Rina Das',
    city: 'Mymensingh',
    rating: 5,
    text: (n) =>
      `Friend in Dhaka suggested ${n}. Ordered here — same product she uses. Very satisfied.`,
  },
  {
    name: 'Parvez Ahmed',
    city: 'Barishal',
    rating: 5,
    text: (n) =>
      `Winter dry skin — ${n} helped a lot. Arrived in 3 days to Barishal, well packed in bubble wrap.`,
  },
  {
    name: 'Nadia Sultana',
    city: 'Chattogram',
    rating: 5,
    text: (n) =>
      `I've tried local copies before. This ${n} feels different — smoother texture, proper label.`,
  },
  {
    name: 'Emran Ali',
    city: 'Sylhet',
    rating: 5,
    text: (n) =>
      `Good experience end to end. ${n} authentic, invoice included, delivery person was respectful.`,
  },
  {
    name: 'Shila Rani',
    city: 'Rajshahi',
    rating: 4,
    text: (n) =>
      `${n} — happy with purchase. Took 5 days to Rajshahi but product quality made up for it.`,
  },
  {
    name: 'Biplob Saha',
    city: 'Dhaka',
    rating: 5,
    text: (n) =>
      `Office colleague uses ${n}. Ordered the same — no regret. Genuine and fairly priced.`,
  },
  {
    name: 'Humaira Khan',
    city: 'Rangpur',
    rating: 5,
    text: (n) =>
      `First online beauty order for me. ${n} came safely to Rangpur. Will trust this shop again.`,
  },
  {
    name: 'Delwar Hossain',
    city: 'Jessore',
    rating: 5,
    text: (n) =>
      `${n} — using since Ramadan. Still going strong. Good value for money honestly.`,
  },
  {
    name: 'Sumaiya Akter',
    city: 'Dhaka',
    rating: 5,
    text: (n) =>
      `Packaging was cute and secure 😊 ${n} exactly as described. Already in my routine.`,
  },
  {
    name: 'Kazi Rafiq',
    city: 'Gazipur',
    rating: 4,
    text: (n) =>
      `${n} does the job. Not perfect but real product and fair delivery time to Gazipur.`,
  },
  {
    name: 'Orchi Das',
    city: 'Khulna',
    rating: 5,
    text: (n) =>
      `Sensitive skin here — ${n} caused no redness. That alone earns 5 stars from me.`,
  },
  {
    name: 'Mizanur Rahman',
    city: 'Cumilla',
    rating: 5,
    text: (n) =>
      `Ordered at night, got SMS next morning, ${n} delivered day after. Smooth process.`,
  },
  {
    name: 'Afroza Begum',
    city: 'Tangail',
    rating: 5,
    text: (n) =>
      `${n} নিয়ে স্বামী খুশি। মান ভালো, দামও ঠিক আছে। আবার নেব।`,
  },
  {
    name: 'Sakib Mahmud',
    city: 'Dhaka',
    rating: 5,
    text: (n) =>
      `Short and sweet — ${n} is good. Fast delivery to Mirpur. Recommended.`,
  },
  {
    name: 'Tamanna Islam',
    city: 'Chattogram',
    rating: 4,
    text: (n) =>
      `${n} — liked it. Minor delay on courier side but seller kept me updated. Product is fine.`,
  },
  {
    name: 'Hridoy Khan',
    city: 'Sylhet',
    rating: 5,
    text: (n) =>
      `Bought ${n} after reading reviews here. Can confirm — worth it. Original packaging.`,
  },
  {
    name: 'Nazma Khatun',
    city: 'Barishal',
    rating: 5,
    text: (n) =>
      `দামে ভালো ${n} পেয়েছি। ব্যবহার করে বলছি — মান আছে।`,
  },
  {
    name: 'Alamin Hossain',
    city: 'Bogura',
    rating: 5,
    text: (n) =>
      `Trust issue with online shops — but ${n} came sealed from a proper warehouse. Relieved.`,
  },
  {
    name: 'Puja Saha',
    city: 'Mymensingh',
    rating: 5,
    text: (n) =>
      `${n} for daily use. Light feel, absorbs well. Delivery to Mymensingh in 3 days.`,
  },
  {
    name: 'Rashidul Islam',
    city: 'Narayanganj',
    rating: 4,
    text: (n) =>
      `Good ${n}. Would give 5 if shipping was one day faster. Product itself no problem.`,
  },
  {
    name: 'Mithila Akter',
    city: 'Dhaka',
    rating: 5,
    text: (n) =>
      `Been using ${n} for 3 weeks. Skin looks healthier. Will update if anything changes but so far so good.`,
  },
];

/** Homepage carousel — first 25 templates (one card per profile). */
const REVIEW_PROFILES = REVIEW_TEMPLATES.slice(0, 25);

function productLabel(name) {
  const n = String(name || 'this product').trim();
  if (n.length <= 58) return n;
  return `${n.slice(0, 55)}…`;
}

function reviewsCountForPoolIndex(poolIndex) {
  if (poolIndex < 6) return 5;
  if (poolIndex < 10) return 4;
  if (poolIndex < 16) return 2;
  return 1;
}

function syntheticReviewDate(productId, reviewIndex) {
  const daysAgo = 8 + ((Number(productId) * 11 + reviewIndex * 17) % 165);
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

/** Map product id → array of review templates (top products get 4–5 each). */
function buildReviewAssignments(pool) {
  const map = new Map();
  if (!Array.isArray(pool) || !pool.length) return map;

  let templateIndex = 0;
  pool.forEach((product, poolIndex) => {
    const id = Number(product?.id);
    if (!id) return;
    const count = reviewsCountForPoolIndex(poolIndex);
    const profiles = [];
    for (let j = 0; j < count; j++) {
      profiles.push(REVIEW_TEMPLATES[templateIndex % REVIEW_TEMPLATES.length]);
      templateIndex += 1;
    }
    map.set(id, profiles);
  });
  return map;
}

function buildSyntheticStatsFromAssignments(assignments) {
  const map = new Map();
  if (!assignments) return map;
  for (const [id, profiles] of assignments) {
    const count = profiles.length;
    const ratingSum = profiles.reduce((s, p) => s + Number(p.rating || 0), 0);
    map.set(id, { count, ratingSum });
  }
  return map;
}

function syntheticReviewsForProduct(productId, productName, pool, assignments) {
  const pid = Number(productId);
  if (!pid || !Array.isArray(pool) || !pool.length) return [];

  const label = productLabel(productName);
  const assignMap = assignments || buildReviewAssignments(pool);
  const profiles = assignMap.get(pid) || [];

  return profiles.map((profile, index) => ({
    customer_name: profile.name,
    rating: profile.rating,
    comment: profile.text(label),
    created_at: syntheticReviewDate(pid, index),
    city: profile.city,
    source: 'storefront',
  }));
}

module.exports = {
  REVIEW_PROFILES,
  REVIEW_TEMPLATES,
  productLabel,
  buildReviewAssignments,
  buildSyntheticStatsFromAssignments,
  syntheticReviewsForProduct,
};
