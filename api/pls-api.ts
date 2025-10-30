// Handle proxy for Plausible if enabled (if the PLAUSIBLE_ANALYTICS env var contains the URL of the Plausible server, with https prefix)
// Proxy (no cache) the message sending the request (from /pls/(event|error) to ${PLAUSIBLE_ANALYTICS}/api/(event|error))
export default {
  async fetch(request: Request) {
    const url = new URL(request.url)
    const newReq = new Request(process.env.PLAUSIBLE_ANALYTICS + url.pathname.slice(4), new Request(request, {}))

    // Set the X-Forwarded-For header
    // First, check if the request had an X-Forwarded-For already
    if (!newReq.headers.get('x-forwarded-for')) {
      // Fallback to X-Real-IP
      const val = newReq.headers.get('x-real-ip')
      if (val) {
        newReq.headers.set('x-forwarded-for', val)
      }
    }

    // Set the Authorization header with the Vercel OIDC token
    const oidcToken = request.headers.get('x-vercel-oidc-token')
    if (oidcToken) {
      // Add the Vercel OIDC token to the request
      newReq.headers.set('authorization', 'Bearer ' + oidcToken)
    }

    // Need to remove the Host and Cookie headers, or the request will fail
    // Should also remove all Vercel headers
    newReq.headers.delete('Host')
    newReq.headers.delete('Cookie')
    for (const key of newReq.headers.keys()) {
      if (key.startsWith('x-vercel-')) {
        newReq.headers.delete(key)
      }
    }

    // Make the request
    return fetch(newReq)
  },
}
