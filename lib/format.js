/** Format number as English locale price string */
function formatPrice(amount) {
  const n = Math.round(Number(amount) || 0);
  return '৳' + n.toLocaleString('en-US');
}

function starsFromRating(rating) {
  const r = Math.round(Number(rating) || 0);
  return '★'.repeat(Math.min(5, r)) + '☆'.repeat(Math.max(0, 5 - r));
}

function toBnNumber(num) {
  return Number(num).toLocaleString('en-US');
}

module.exports = { formatPrice, starsFromRating, toBnNumber };
