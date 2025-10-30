// Cache the proxied script for 1 day in the edge cache
// const edgeCacheDuration = 86400
// Cache the proxied script for 12 hours in the browser
const clientCacheDuration = 32400

// Handle proxy for Plausible if enabled (if the PLAUSIBLE_ANALYTICS env var contains the URL of the Plausible server, with https prefix)
// Proxy and cache the script (from /pls/index.*.js to ${PLAUSIBLE_ANALYTICS}/js/plausible.outbound-links.js)
export default {
  async fetch(request: Request) {
    if (!process.env.PLAUSIBLE_ANALYTICS) {
      return new Response('', {
        status: 204,
      })
    }

    try {
      // Fetch from the upstream Plausible server
      const upstreamUrl = `${process.env.PLAUSIBLE_ANALYTICS}/js/plausible.outbound-links.js`
      const upstreamResponse = await fetch(upstreamUrl)

      if (!upstreamResponse.ok) {
        return new Response('Failed to fetch script', { status: upstreamResponse.status })
      }

      // Get the script content and add padding
      let scriptContent = await upstreamResponse.text()
      const num = Math.floor(Math.random() * 100000)
      if (Math.random() < 0.5) {
        scriptContent += `\n;'` + num + `'`
      } else {
        scriptContent = `'` + num + `';\n` + scriptContent
      }

      // Response headers
      const headers = upstreamResponse.headers
      headers.set('Cache-Control', `public, max-age=${clientCacheDuration}`)

      // Create response with caching headers
      return new Response(scriptContent, {
        status: 200,
        headers,
      })
    } catch (error) {
      return new Response('Error proxying script', { status: 500 })
    }
  },
}
