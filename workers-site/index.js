import {getAssetFromKV} from '@cloudflare/kv-asset-handler'
import assets from './assets'

/* global STORAGE_ACCOUNT, STORAGE_CONTAINER, DOMAINS, PLAUSIBLE_ANALYTICS */

/**
 * The DEBUG flag will do two things that help during development:
 * 1. we will skip caching on the edge, which makes it easier to debug
 * 2. we will return an error message on exception in your Response rather than the default 404.html page
 */
const DEBUG = false

addEventListener('fetch', (event) => {
    try {
        event.respondWith(handleEvent(event))
    }
    catch (e) {
        if (DEBUG) {
            return event.respondWith(
                new Response(e.message || e.toString(), {
                    status: 500,
                }),
            )
        }
        event.respondWith(new Response('Internal Error', {status: 500}))
    }
})

/**
 * Handles requests coming in from the client
 * @param {Event} event
 * @returns {Promise<Response>} Response object
 */
async function handleEvent(event) {
    // Check if we need to redirect the user
    const redirect = shouldRedirect(event)
    if (redirect) {
        return Response.redirect(redirect, 301)
    }

    // Check if the URL points to a static asset on Azure Storage
    const reqUrl = new URL(event.request.url)
    const useAsset = isAsset(reqUrl)
    if (useAsset) {
        return requestAsset(useAsset)
    }

    // Handle proxy for Plausible if enabled (if PLAUSIBLE_ANALYTICS contains the URL of the Plausible server, with https prefix)
    // 1. Proxy and cache the script (from /pls/index.js to ${PLAUSIBLE_ANALYTICS}/js/plausible.js) - in the script also replace $PLAUSIBLE_ANALYTICS with this URL
    // 2. Proxy (no cache) the message sending the request (from /pls/(event|error) to ${PLAUSIBLE_ANALYTICS}/api/(event|error))
    // Check if the URL is for the Plausible Analytics script
    if (PLAUSIBLE_ANALYTICS) {
        const path = reqUrl.pathname
        // Script
        if (path == '/pls/index.js') {
            // Request the asset and modify the response to replace $PLAUSIBLE_ANALYTICS with "" (so the same host as the app is used)
            return requestAsset(
                {
                    url: PLAUSIBLE_ANALYTICS + '/js/plausible.js',
                    // Cache in the edge for a day and in the browser for 2 hours
                    edgeTTL: 86400,
                    browserTTL: 7200
                },
                async (response) => {
                    // Get the body's text then replace the URL
                    const text = await response.text()
                    return text.replace(PLAUSIBLE_ANALYTICS, '/pls')
                }
            )
        }

        // APIs
        if (path == '/pls/api/event' || path == '/pls/api/error') {
            // Clone the request but change the URL
            const newReq = new Request(
                PLAUSIBLE_ANALYTICS + path.substr(4),
                new Request(event.request, {})
            )

            // Set the X-Forwarded-For header
            // Cloudflare automatically adds X-Real-IP and CF-Connecting-IP (and X-Forwarded-Proto), but we need X-Forwarded-For too
            // First, check if the request had an X-Forwarded-For already
            if (!newReq.headers.get('X-Forwarded-For')) {
                // Fallback to True-Client-IP if available
                // Then CF-Connecting-IP
                // Lastly, X-Real-IP
                if (newReq.headers.get('True-Client-IP')) {
                    newReq.headers.set('X-Forwarded-For', newReq.headers.get('True-Client-IP'))
                } else if (newReq.headers.get('CF-Connecting-IP')) {
                    newReq.headers.set('X-Forwarded-For', newReq.headers.get('CF-Connecting-IP'))
                } else if (newReq.headers.get('X-Real-IP')) {
                    newReq.headers.set('X-Forwarded-For', newReq.headers.get('X-Real-IP'))
                }
            }

            // Need to remove all Cloudflare headers (starting with cf-) and the Host header, or the request will fail
            newReq.headers.delete('Host')
            for (const key of newReq.headers.keys()) {
                if (key.startsWith('cf-')) {
                    newReq.headers.delete(key)
                }
            }

            // Make the request
            return fetch(newReq)
        }
    }

    // Request from the KV
    return requestFromKV(event)
}

/**
 * Checks if the user should be redirected, and returns the address.
 * Redirects from http to https, and from secondary domains (not in the DOMAINS environmental variable) to the primary one
 *
 * @param {Event} event
 * @returns {string|null} If the user should be redirected, return the location
 */
function shouldRedirect(event) {
    // Check the requested URL
    const url = new URL(event.request.url)
    if (!url || !url.host) {
        return null
    }

    // Ensure we're using https
    let redirect = null
    if (url.protocol != 'https:') {
        redirect = 'https://' + url.host + url.pathname + url.search
    }

    // If there's no list of allowed domains (as an env var, for this environment), return right away
    if (typeof DOMAINS == 'undefined' || !DOMAINS) {
        return redirect
    }

    // Look at the list of domains to see if the one being requested is allowed
    /** @type Array<string> */
    const domainList = DOMAINS.split(' ')
    if (domainList.includes(url.host)) {
        // Domain is in the allow-list, so just return
        return redirect
    }

    // Redirect to the first domain in the list
    return 'https://' + domainList[0] + url.pathname + url.search
}

/**
 * Loads the response from the Workers KV
 * @param {Event} event
 * @returns {Promise<Response>} Response object
 */
async function requestFromKV(event) {
    // Options for the request from the KV
    /** @type {import('@cloudflare/kv-asset-handler').Options} */
    const options = {
        // Set custom caching options
        cacheControl: {
            // Use Cloudflare cache
            bypassCache: false,
            // Cache for 1 day in browsers
            browserTTL: 86400,
            // Cache for 2 days in the edge
            edgeTTL: 86400 * 2,
        }
    }
    if (DEBUG) {
        // Disable caching while in debug mode
        options.cacheControl = {
            bypassCache: true,
            browserTTL: null,
        }
    }

    try {
        const response = await getAssetFromKV(event, options)

        // Opt out of the FLoC network
        flocOptOut(response.headers)

        return response
    }
    catch (e) {
        // If an error is thrown try to serve the asset at 404.html
        if (!DEBUG) {
            try {
                const notFoundResponse = await getAssetFromKV(event, {
                    mapRequestToAsset: req => new Request((new URL(req.url).origin) + '/404.html', req),
                })

                return new Response(notFoundResponse.body, {...notFoundResponse, status: 404})
            }
            // eslint-disable-next-line no-empty
            catch (e) {}
        }

        return new Response(e.message || e.toString(), {status: 500})
    }
}

/**
 * Requests an asset, optionally caching it in the edge. It also sets the correct headers in the response.
 * @param {object} useAsset
 * @param {(response: Response) => Promise<string>} [modifyBody] Optional method that can modify the response's body
 * @returns {Response} A Response object
 */
async function requestAsset(useAsset, modifyBody) {
    // Caching options
    const cfOpts = {}
    if (useAsset.edgeTTL) {
        // Cache everything, even if the response has no TTL
        cfOpts.cacheEverything = true
        cfOpts.cacheTtlByStatus = {
            '200-299': useAsset.edgeTTL,
            404: 3,
            '500-599': 0
        }
    }

    // Return a fetch invocation (promise) that retrieves data from the origin
    let response = await fetch(useAsset.url, cfOpts)

    // See if we want to modify the response's body
    let body = response.body
    if (modifyBody) {
        body = await modifyBody(response)
    }

    // Reconstruct the Response object to make its headers mutable
    response = new Response(body, response)

    // Delete all Azure Storage headers (x-ms-*)
    for (const key of response.headers.keys()) {
        if (key.startsWith('x-ms-')) {
            response.headers.delete(key)
        }
    }

    // Check if we need to set a Cache-Control for the browser
    if (response.status >= 200 && response.status <= 299 && useAsset.browserTTL) {
        response.headers.set('Cache-Control', 'max-age=' + useAsset.browserTTL)
    } else {
        response.headers.delete('Cache-Control')
    }

    // Opt out of the FLoC network
    flocOptOut(response.headers)

    // Return the data we requested (and cached)
    return response
}

/**
 * Sets the value in the Permissions-Policy header to opt out of the FLoC network
 * @param {Headers} headers 
 */
function flocOptOut(headers) {
    let policy = headers.get('Permissions-Policy')
    policy = (policy ? policy + '; ' : '') + 'interest-cohort=()'
    headers.set('Permissions-Policy', policy)
}

/**
 * Check if the requested URL corresponds to an asset in Azure Storage
 * @param {URL} url - URL of the original request
 */
function isAsset(url) {
    for (let i = 0; i < assets.length; i++) {
        const e = assets[i]
        if (!e || !e.match) {
            continue
        }
        const match = url.pathname.match(e.match)
        if (!match) {
            continue
        }

        // New request URL
        const assetUrl = 'https://' + STORAGE_ACCOUNT + '.blob.core.windows.net/' + STORAGE_CONTAINER + e.storagePath.replace(/\$([1-9][0-9]*)/g, (m) => {
            const index = parseInt(m.substr(1), 10)
            return match[index] || ''
        })

        // Return the request URL and caching options
        return {
            url: assetUrl,
            edgeTTL: e.edgeTTL,
            browserTTL: e.browserTTL
        }
    }

    return false
}
