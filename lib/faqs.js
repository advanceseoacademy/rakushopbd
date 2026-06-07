const DEFAULT_FAQS = [
  {
    question: 'How do I place an order?',
    answer:
      'Browse products, click <strong>Add to Cart</strong>, then go to Cart and complete checkout with your name, phone and delivery address. You will receive an Order ID on the success page.',
    sortOrder: 1,
  },
  {
    question: 'Which payment methods do you accept?',
    answer:
      'We accept bKash, Nagad, and Cash on Delivery (where available). Payment details are shown at checkout. Always pay only through official RakuShopBD channels.',
    sortOrder: 2,
  },
  {
    question: 'How long does delivery take?',
    answer:
      'Inside Dhaka: usually 1–3 business days. Outside Dhaka: 2–5 business days depending on your district. You can track your order anytime from the <a href="/track">Track Order</a> page.',
    sortOrder: 3,
  },
  {
    question: 'How can I track my order?',
    answer:
      'Copy your Order ID from the order success page (example: RKS-2026-...) and paste it on our <a href="/track">Track Order</a> page to see status and details.',
    sortOrder: 4,
  },
  {
    question: 'Are your products authentic?',
    answer:
      'Yes. RakuShopBD sources genuine Japanese and international products from trusted suppliers. If you ever receive a damaged or wrong item, contact us within 48 hours of delivery.',
    sortOrder: 5,
  },
  {
    question: 'What is your return policy?',
    answer:
      'Unopened products in original packaging may be eligible for exchange within 7 days if damaged or incorrect. Personal care items opened for hygiene reasons cannot be returned unless defective.',
    sortOrder: 6,
  },
  {
    question: 'Can I book an in-store visit or consultation?',
    answer:
      'Yes. Use our <a href="/appointment">Book Appointment</a> page to choose a date and time. We are open Saturday–Thursday and closed on Fridays.',
    sortOrder: 7,
  },
  {
    question: 'How do I contact customer support?',
    answer:
      'Call or message us during store hours, or send a message through our <a href="/contact">Contact page</a>. We aim to reply within 24 hours on business days.',
    sortOrder: 8,
  },
];

function faqToPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    isActive: Boolean(row.is_active ?? row.isActive ?? true),
    createdAt: row.created_at || row.createdAt,
  };
}

async function listPublicFaqs(queryFn) {
  try {
    const rows = await queryFn(
      'SELECT id, question, answer, sort_order FROM faqs WHERE is_active = 1 ORDER BY sort_order ASC, id ASC'
    );
    if (rows?.length) return rows.map(faqToPublic);
  } catch (_) {
    /* table may not exist yet */
  }
  return DEFAULT_FAQS.map((f, i) => ({
    id: i + 1,
    question: f.question,
    answer: f.answer,
    sortOrder: f.sortOrder,
    isActive: true,
  }));
}

module.exports = { DEFAULT_FAQS, faqToPublic, listPublicFaqs };
