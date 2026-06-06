const SERVICE_TYPES = [
  { value: 'consultation', label: 'Product Consultation' },
  { value: 'store_visit', label: 'In-Store Visit' },
  { value: 'skincare', label: 'Skincare & Beauty Advice' },
  { value: 'pickup', label: 'Order Pickup / Collection' },
  { value: 'support', label: 'Customer Support Call' },
];

const TIME_SLOTS = [
  '10:00 AM – 11:00 AM',
  '11:00 AM – 12:00 PM',
  '12:00 PM – 1:00 PM',
  '2:00 PM – 3:00 PM',
  '3:00 PM – 4:00 PM',
  '4:00 PM – 5:00 PM',
  '5:00 PM – 6:00 PM',
];

function normalizePhone(phone) {
  return String(phone || '')
    .replace(/\s+/g, '')
    .replace(/^\+880/, '0')
    .replace(/^880/, '0');
}

function generateReference() {
  return `APT-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`;
}

function appointmentToPublic(row) {
  if (!row) return null;
  return {
    referenceNumber: row.reference_number || row.referenceNumber,
    customerName: row.customer_name || row.customerName,
    customerPhone: row.customer_phone || row.customerPhone,
    appointmentDate: row.appointment_date || row.appointmentDate,
    appointmentTime: row.appointment_time || row.appointmentTime,
    serviceType: row.service_type || row.serviceType,
    status: row.status,
    notes: row.notes || null,
    createdAt: row.created_at || row.createdAt,
  };
}

function serviceLabel(value) {
  const hit = SERVICE_TYPES.find((s) => s.value === value);
  return hit ? hit.label : value;
}

module.exports = {
  SERVICE_TYPES,
  TIME_SLOTS,
  normalizePhone,
  generateReference,
  appointmentToPublic,
  serviceLabel,
};
