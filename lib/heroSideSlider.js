/**
 * Homepage hero banner — full-width image slider (admin-managed slides).
 */
function getHeroSideSlider(settings) {
  const enabled = settings?.hero_side_slider_enabled !== '0';
  let slides = [];
  try {
    const raw = settings?.hero_side_slides;
    if (typeof raw === 'string' && raw.trim()) slides = JSON.parse(raw);
    else if (Array.isArray(raw)) slides = raw;
  } catch (_) {
    slides = [];
  }

  slides = slides
    .map((s) => ({
      image: String(s?.image || s?.imageUrl || '').trim(),
      link: String(s?.link || s?.linkUrl || '').trim(),
      alt: String(s?.alt || s?.title || '').trim(),
    }))
    .filter((s) => s.image);

  const intervalMs = Math.max(
    2500,
    Math.min(12000, Number(settings?.hero_side_slider_interval) || 4500)
  );

  return {
    enabled: enabled && slides.length > 0,
    slides,
    intervalMs,
  };
}

module.exports = { getHeroSideSlider };
