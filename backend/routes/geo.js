/**
 * Resolve Google Maps short URLs (maps.app.goo.gl / goo.gl/maps) to lat/lng
 * by following redirects and extracting coordinates from the resolved URL.
 * Server-side only (browser CORS blocks this).
 */
const express = require('express');
const router = express.Router();

// Match patterns commonly found in Google Maps URLs after redirect
function extractCoords(url) {
  if (!url) return null;
  try { url = decodeURIComponent(url); } catch (_) {}

  // 1) /@LAT,LNG,zoom
  let m = url.match(/[@\/](-?\d+\.\d+),(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  // 2) !3dLAT!4dLNG (place data)
  m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  // 3) ?q=LAT,LNG  or  ?ll=LAT,LNG  or  &destination=LAT,LNG
  m = url.match(/[?&](?:q|ll|destination|center)=(-?\d+\.\d+)[,%2C ](-?\d+\.\d+)/i);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  return null;
}

async function followRedirects(url, maxHops = 8) {
  const visited = [url];
  let current = url;
  for (let i = 0; i < maxHops; i++) {
    const res = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        // Mimic a real browser; Google sometimes replies with a JS interstitial otherwise
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const loc = res.headers.get('location');
    if (loc) {
      const next = new URL(loc, current).toString();
      visited.push(next);
      current = next;
      const c = extractCoords(next);
      if (c) return { coords: c, finalUrl: next, chain: visited };
      continue;
    }
    // No redirect — try to read body & search for coords
    let body = '';
    try { body = await res.text(); } catch (_) {}
    const fromBody =
      extractCoords(body.match(/https?:\/\/www\.google\.com\/maps[^"'\s<>]+/)?.[0] || '') ||
      extractCoords(body);
    if (fromBody) return { coords: fromBody, finalUrl: current, chain: visited };
    break;
  }
  return { coords: null, finalUrl: current, chain: visited };
}

router.get('/resolve', async (req, res) => {
  const url = String(req.query.url || '').trim();
  if (!url) return res.status(400).json({ error: 'Missing url' });
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Invalid url' });

  // Direct extract first (long Google Maps URLs)
  const direct = extractCoords(url);
  if (direct) return res.json({ ...direct, source: 'direct', url });

  try {
    const { coords, finalUrl } = await followRedirects(url);
    if (!coords) return res.status(404).json({ error: 'No coordinates found', finalUrl });
    res.json({ ...coords, source: 'redirect', finalUrl });
  } catch (err) {
    console.error('geo.resolve error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
