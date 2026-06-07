function subscriberToPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    customerPhone: row.customer_phone || row.customerPhone,
    source: row.source || 'marketing',
    status: row.status || 'new',
    createdAt: row.created_at || row.createdAt,
  };
}

module.exports = { subscriberToPublic };
