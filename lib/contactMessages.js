const SUBJECT_LABELS = {
  order: 'Order status',
  delivery: 'Delivery issue',
  product: 'Product question',
  return: 'Return / exchange',
  payment: 'Payment',
  other: 'Other',
};

function subjectLabel(key) {
  return SUBJECT_LABELS[key] || key || 'General';
}

function contactToPublic(row) {
  if (!row) return null;
  const subject = row.subject || '';
  return {
    id: row.id,
    customerName: row.customer_name || row.customerName,
    customerPhone: row.customer_phone || row.customerPhone,
    customerEmail: row.customer_email || row.customerEmail,
    subject,
    subjectLabel: subjectLabel(subject),
    message: row.message,
    status: row.status || 'new',
    createdAt: row.created_at || row.createdAt,
  };
}

module.exports = { SUBJECT_LABELS, subjectLabel, contactToPublic };
