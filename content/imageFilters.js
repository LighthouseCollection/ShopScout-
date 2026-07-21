/* =============================================================
   ShopScout — Shared image URL filters for extraction stages.
   Keeps product images and user-uploaded review photos out of SVG,
   icon, sprite, and thumbnail traps across marketplace adapters.
   ============================================================= */
(function initImageFilters(root) {
  const NS = (root.SSExtract = root.SSExtract || {});

  const THUMB_MARKERS = [
    '_thumb', '-thumbnail', '_thumbnail', '/thumb/', '/thumbs/',
    '_sm.', '_small.', '-small.', '_tn.', '-tn.',
    '_100x100', '_120x120', '_150x150', '_200x200',
    '?w=100', '?w=120', '?w=150', '?w=200',
    '&w=100', '&w=120', '&w=150', '&w=200',
    'size=small', 'size=thumb'
  ];

  function absoluteUrl(url) {
    if (!url) return '';
    try { return new URL(String(url), location.href).href; }
    catch { return ''; }
  }

  function parseSrcset(srcset) {
    return String(srcset || '')
      .split(',')
      .map(part => {
        const bits = part.trim().split(/\s+/);
        const url = bits[0] || '';
        const descriptor = bits[1] || '';
        let score = 1;
        const width = descriptor.match(/^(\d+)w$/i);
        const density = descriptor.match(/^([\d.]+)x$/i);
        if (width) score = Number(width[1]) || 1;
        else if (density) score = (Number(density[1]) || 1) * 1000;
        return { url, score };
      })
      .filter(item => item.url);
  }

  function largestFromSrcset(srcset) {
    const candidates = parseSrcset(srcset);
    if (!candidates.length) return '';
    candidates.sort((a, b) => b.score - a.score);
    return absoluteUrl(candidates[0].url);
  }

  function bestImageUrl(img) {
    if (!img) return '';
    const srcset = img.getAttribute && (img.getAttribute('srcset') || img.getAttribute('data-srcset'));
    const fromSrcset = largestFromSrcset(srcset);
    if (fromSrcset) return fromSrcset;
    const raw = (img.getAttribute && (
      img.getAttribute('data-zoom-image') ||
      img.getAttribute('data-large-image') ||
      img.getAttribute('data-original') ||
      img.getAttribute('data-src') ||
      img.getAttribute('src')
    )) || img.currentSrc || img.src || '';
    return absoluteUrl(raw);
  }

  function isSvgOrUiAsset(url) {
    const lower = String(url || '').toLowerCase();
    return !lower ||
      lower.endsWith('.svg') ||
      lower.includes('/s/sash/') ||
      lower.includes('sprite') ||
      lower.includes('icon') ||
      lower.includes('placeholder') ||
      lower.includes('loading');
  }

  function isThumbnailUrl(url) {
    const lower = String(url || '').toLowerCase();
    return THUMB_MARKERS.some(marker => lower.includes(marker));
  }

  function hasLargeEnoughNaturalSize(img, minSize) {
    if (!img) return true;
    const min = minSize || 300;
    const width = Number(img.naturalWidth || img.width || 0);
    const height = Number(img.naturalHeight || img.height || 0);
    if (!width && !height) return true;
    return width >= min && height >= min;
  }

  function isReviewImageCandidate(img, options) {
    const opts = options || {};
    const url = opts.url || bestImageUrl(img);
    if (!/^https?:/i.test(url)) return false;
    if (isSvgOrUiAsset(url)) return false;
    if (isThumbnailUrl(url)) return false;
    return hasLargeEnoughNaturalSize(img, opts.minSize || 300);
  }

  NS.imageFilters = {
    absoluteUrl,
    bestImageUrl,
    largestFromSrcset,
    isSvgOrUiAsset,
    isThumbnailUrl,
    isReviewImageCandidate
  };
})(globalThis);
