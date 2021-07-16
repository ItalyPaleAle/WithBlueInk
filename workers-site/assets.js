export default [
    {
        match: /^\/images\/(.*?)$/,
        storagePath: '/public/images/$1',
        // Cache in the edge for 3 months
        edgeTTL: 86400 * 90,
        // Cache in the browser for 2 weeks
        browserTTL: 86400 * 14,
        // Not immutable
        immutable: false
    },
    {
        match: /^\/fonts\/(.*?)$/,
        storagePath: '/public/fonts/$1',
        // Cache in the edge for 4 months
        edgeTTL: 86400 * 120,
        // Cache in the browser for 1 month
        browserTTL: 86400 * 30,
        // Not immutable
        immutable: false
    },
]
