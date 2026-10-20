// Talks to our own server (server.js). The phone never calls the Claude API
// directly — it sends the photo to our server, which holds the secret key.

/**
 * Phase 2: send a nutrition-label photo and get back per-100 g values.
 * The server route exists but returns "not implemented" until Phase 2.
 */
export async function scanLabel(imageFile) {
  const body = new FormData();
  body.append('image', imageFile);
  const res = await fetch('/api/scan-label', { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Scan failed');
  return data; // expected shape: { name, calories, protein, carbs, fat, fiber }
}
