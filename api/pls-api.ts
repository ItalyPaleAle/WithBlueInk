// Handle proxy for Plausible if enabled (if the PLAUSIBLE_ANALYTICS env var contains the URL of the Plausible server, with https prefix)
// Proxy (no cache) the message sending the request (from /pls/(event|error) to ${PLAUSIBLE_ANALYTICS}/api/(event|error))
export default {
  async fetch(request: Request) {
    const url = new URL(request.url)
    const newReq = new Request(process.env.PLAUSIBLE_ANALYTICS + url.pathname.slice(4), new Request(request, {}))

    // Set the X-Forwarded-For header
    // First, check if the request had an X-Forwarded-For already
    if (!newReq.headers.get('X-Forwarded-For')) {
      // Fallback to X-Real-IP
      const val = newReq.headers.get('X-Real-IP')
      if (val) {
        newReq.headers.set('X-Forwarded-For', val)
      }
    }

    // Need to remove the Host and Cookie headers, or the request will fail
    // Should also remove all Vercel headers, except x-vercel-oidc-token
    newReq.headers.delete('Host')
    newReq.headers.delete('Cookie')
    for (const key of newReq.headers.keys()) {
      if (key != 'x-vercel-oidc-token' && key.startsWith('x-vercel-')) {
        newReq.headers.delete(key)
      }
    }

    // Make the request
    return fetch(newReq)
  },
}
