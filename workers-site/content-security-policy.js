export default {
    'default-src': [
        `'none'`
    ],
    'script-src': [
        `'self'`,
        'https://*.italypaleale.me',
        'https://cdn.commento.io',
        'https://platform.twitter.com/',
        'https://gist.github.com/',
    ],
    'style-src': [
        `'self'`,
        `'unsafe-inline'`,
        'https://*.italypaleale.me',
        'https://cdn.commento.io',
        'https://github.githubassets.com/',
    ],
    'img-src': [
        `'self'`,
        'data:',
        'https://*.italypaleale.me',
        'https://cdn.commento.io',
    ],
    'font-src': [
        `'self'`,
        'https://*.italypaleale.me',
        'https://cdn.commento.io',
    ],
    'connect-src': [
        '*',
        'https://*.italypaleale.me',
        'https://cdn.commento.io',
    ],
    'media-src': [
        '*'
    ],
    'object-src': [
        `'none'`
    ],
    'child-src': [
        `'self'`,
        'https://www.youtube-nocookie.com',
        'https://platform.twitter.com/'
    ],
    'worker-src': [
        `'self'`
    ],
    'frame-ancestors': [
        `'self'`
    ],
    'form-action': [
        `'self'`
    ],
    'block-all-mixed-content': true,
    'upgrade-insecure-requests': true,
    'report-uri': [
        'https://8af2e721dd06ac65ebfdd369c011d469.report-uri.com/r/d/csp/reportOnly'
    ]
}
