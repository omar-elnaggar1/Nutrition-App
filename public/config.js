// Where the label-scanning server lives.
//
// - Opened from your own server (npm start, or Render): leave it as '' (same address).
// - Opened from GitHub Pages: paste your Render address below, e.g.
//   'https://nutrition-app-xxxx.onrender.com' (no slash at the end).
const SCAN_SERVER_FOR_GITHUB_PAGES = '';

export const SCAN_SERVER_URL = location.hostname.endsWith('github.io') ? SCAN_SERVER_FOR_GITHUB_PAGES : '';

/** True when scanning can't work because the GitHub Pages copy doesn't know the server address yet. */
export const SCAN_SERVER_MISSING = location.hostname.endsWith('github.io') && !SCAN_SERVER_FOR_GITHUB_PAGES;
