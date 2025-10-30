import { getCache, getEnv, type RuntimeCache } from '@vercel/functions'

// Cache the proxied script for 7 days in the runtime cache
const runtimeCacheDuration = 86400 * 7
// Cache the proxied script for 12 hours in the browser and edge cache
const clientCacheDuration = 32400

type CachedScript = {
  content: string
  headers: Record<string, string>
}

// Handle proxy for Plausible if enabled (if the PLAUSIBLE_ANALYTICS env var contains the URL of the Plausible server, with https prefix)
// Proxy and cache the script (from /pls/index.*.js to ${PLAUSIBLE_ANALYTICS}/js/plausible.outbound-links.js)
export default {
  async fetch(request: Request) {
    if (!process.env.PLAUSIBLE_ANALYTICS) {
      return new Response('', {
        status: 204,
      })
    }

    const upstreamUrl = `${process.env.PLAUSIBLE_ANALYTICS}/js/plausible.outbound-links.js`

    let scriptContent: string | undefined
    let headers: Headers | undefined
    let cache: RuntimeCache | undefined

    // Check if we have the script in the Vercel runtime cache
    const { VERCEL, VERCEL_DEPLOYMENT_ID } = getEnv()
    if (VERCEL == '1') {
      cache = getCache({
        namespace: VERCEL_DEPLOYMENT_ID,
      })
      const cached = (await cache.get(upstreamUrl)) as CachedScript | null
      if (cached) {
        scriptContent = cached.content
        headers = new Headers(cached.headers)
      }
    }

    // If there's no cached value, fetch from the upstream Plausible server
    if (!scriptContent || !headers) {
      try {
        // Fetch from the upstream Plausible server
        const upstreamResponse = await fetch(upstreamUrl)

        if (!upstreamResponse.ok) {
          const text = await upstreamResponse.text()
          throw new Error(`Failed to fetch script with status code ${upstreamResponse.status}: ${text}`)
        }

        // Get the response text as script content
        scriptContent = await upstreamResponse.text()

        // Save specific headers
        const preserveHeaders = [
          'access-control-allow-origin',
          'content-type',
          'cross-origin-resource-policy',
          'last-modified',
        ]
        const responseHeaders: Record<string, string> = {}
        for (const key of upstreamResponse.headers.keys()) {
          if (preserveHeaders.includes(key)) {
            responseHeaders[key] = upstreamResponse.headers.get(key)!
          }
        }
        headers = new Headers(responseHeaders)

        // Store the script in the cache
        if (cache) {
          cache.set(upstreamUrl, { content: scriptContent, headers: responseHeaders } as CachedScript, {
            ttl: runtimeCacheDuration,
            tags: ['plausible'],
          })
        }
      } catch (error) {
        console.error('Error proxying script: ' + error)
        return new Response('Error proxying script', { status: 500 })
      }
    }

    // Add padding
    const num = Math.floor(Math.random() * 100000)
    if (Math.random() < 0.5) {
      scriptContent += `\n;'` + num + `'`
    } else {
      scriptContent = `'` + num + `';\n` + scriptContent
    }

    // Set cache headers
    headers.set('Cache-Control', `public, max-age=${clientCacheDuration}`)

    // Create response with caching headers
    return new Response(scriptContent, {
      status: 200,
      headers,
    })
  },
}
