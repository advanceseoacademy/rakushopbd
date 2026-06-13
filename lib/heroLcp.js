const { mediaUrl } = require('./imageResize');

function heroImageSrc(url, width = 1200) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  const path = u.startsWith('/') ? u : `/${u}`;
  return mediaUrl(path, width);
}

function buildHeroLcp(bootstrap, isHome) {
  if (!isHome || !bootstrap?.ok) return null;
  const hero = bootstrap.heroSideSlider;
  if (hero?.enabled === false || !hero.slides?.length) return null;
  const slide = hero.slides[0];
  const src = heroImageSrc(slide.image, 1200);
  if (!src) return null;

  let link = String(slide.link || '').trim();
  if (link && link !== '#' && !link.startsWith('/') && !/^https?:\/\//i.test(link)) {
    link = `/${link}`;
  }

  return {
    src,
    alt: String(slide.alt || 'Homepage banner').trim(),
    link: link && link !== '#' ? link : '',
  };
}

module.exports = { buildHeroLcp, heroImageSrc };
