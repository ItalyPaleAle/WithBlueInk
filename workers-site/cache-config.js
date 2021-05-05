// Configure how to cache files from KV

// Match by path
export const cachePaths = [
    {
        // JS and CSS files
        // They have a unique hash in the file name
        match: /^\/(js|css)\/(.*?)$/,
        // Cache in the edge for 3 months
        edgeTTL: 86400 * 90,
        // Cache in the browser for 1 week
        browserTTL: 86400 * 7,
    }
]

// Default
export const cacheDefault = {
    // Cache in the edge for 5 minutes
    edgeTTL: 300,
    // Cache in the browser for 10 minutes
    browserTTL: 600,
}

/**
 * Returns the cache settings for a given URL.
 * @param {string} url - URL of the original request
 */
export function cacheSettings(urlStr) {
    // Convert to an URL object
    const url = new URL(urlStr)
    if (!url || !url.host) {
        return null
    }

    // Check if there are special cache settings for this URL
    for (let i = 0; i < cachePaths.length; i++) {
        const e = cachePaths[i]
        if (!e || !e.match) {
            continue
        }
        const match = url.pathname.match(e.match)
        if (!match) {
            continue
        }

        // Return the request URL and caching options
        return {
            edgeTTL: e.edgeTTL,
            browserTTL: e.browserTTL
        }
    }

    return cacheDefault
}
