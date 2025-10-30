// Handle proxy for Plausible if enabled (if the PLAUSIBLE_ANALYTICS env var contains the URL of the Plausible server, with https prefix)
// Proxy (no cache) the message sending the request (from /pls/(event|error) to ${PLAUSIBLE_ANALYTICS}/api/(event|error))
export default {
  async fetch(request: Request) {
    return new Response(`Plausible API ${request.method} ${request.url}`)
  },
}
