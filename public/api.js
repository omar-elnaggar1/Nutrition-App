// Talks to our own server (server.js). The phone never calls the Claude API
// directly — it sends the photo to our server, which holds the secret key.

import { SCAN_SERVER_URL, SCAN_SERVER_MISSING } from './config.js';

const TIMEOUT_MS = 90_000; // a sleeping free server can take ~1 minute to wake up

// Friendly messages for each problem. `retry: true` means trying the same photo again may work.
const MESSAGES = {
  blurry: { title: 'The photo is too blurry to read', help: 'Hold the phone steady, get closer so the label fills the screen, and avoid glare.' },
  not_label: { title: 'That doesn’t look like a nutrition label', help: 'Take a photo of the “Nutrition Facts” / “Nutrition Information” table on the pack.' },
  unreadable: { title: 'Couldn’t find the nutrition numbers', help: 'Make sure the whole nutrition table is in the photo, in good light.' },
  offline: { title: 'No internet connection', help: 'Check your Wi-Fi or mobile data, then try again.', retry: true },
  timeout: { title: 'The scan took too long', help: 'The server may have been waking up. Try again — it’s usually quick the second time.', retry: true },
  server_unreachable: { title: 'Couldn’t reach the scanning server', help: 'It may be waking up or the address in config.js may be wrong. Try again in a moment.', retry: true },
  busy: { title: 'Claude is busy right now', help: 'Wait a few seconds and try again.', retry: true },
  too_many_scans: { title: 'Too many scans this hour', help: 'Wait a while before scanning again, or enter the values manually.' },
  claude_unreachable: { title: 'Couldn’t reach Claude', help: 'This is usually temporary. Try again in a moment.', retry: true },
  api_error: { title: 'Claude couldn’t process this scan', help: 'Try again. If it keeps happening, check that your Anthropic account has credit.', retry: true },
  bad_api_key: { title: 'The API key on the server isn’t working', help: 'Check the ANTHROPIC_API_KEY in your .env file (no spaces or quotes), then restart the server.' },
  not_configured: { title: 'Scanning isn’t set up yet', help: 'The server has no ANTHROPIC_API_KEY. Follow “Set up label scanning” in the README.' },
  no_server: { title: 'Scanning isn’t connected yet', help: 'Paste your server address into public/config.js (see the README).' },
  bad_image: { title: 'Couldn’t open that photo', help: 'Try a different photo, or take a new one.' },
  too_large: { title: 'That photo is too large', help: 'Try a different photo, or take a new one.' },
  unknown: { title: 'Something went wrong', help: 'Try again, or enter the values manually.', retry: true },
};

export class ScanProblem extends Error {
  constructor(code) {
    const info = MESSAGES[code] || MESSAGES.unknown;
    super(info.title);
    this.code = code;
    this.help = info.help;
    this.retry = Boolean(info.retry);
  }
}

/**
 * Sends a shrunk photo ({ base64, mediaType }) and returns
 * { productName, servingSizeG, per100: {calories, protein, carbs, fat, fiber, sugar, sodium}, missing, convertedFromServing, blurry }.
 * Throws a ScanProblem with a friendly message on failure.
 */
export async function scanLabel({ base64, mediaType }) {
  if (SCAN_SERVER_MISSING) throw new ScanProblem('no_server');
  if (!navigator.onLine) throw new ScanProblem('offline');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${SCAN_SERVER_URL}/api/scan-label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mediaType }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new ScanProblem('timeout');
    throw new ScanProblem(navigator.onLine ? 'server_unreachable' : 'offline');
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new ScanProblem(data?.error && MESSAGES[data.error] ? data.error : res.status === 429 ? 'busy' : 'unknown');
  return data;
}
