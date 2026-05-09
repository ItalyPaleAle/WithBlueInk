const path = require('node:path')

const purgecss = require('@fullhuman/postcss-purgecss')({
    content: ['./hugo_stats.json'],
    preserveHtmlElements: false,
    defaultExtractor: (content) => {
        const els = JSON.parse(content).htmlElements
        return els.tags.concat(els.classes, els.ids)
    }
})

const browserslist = [
    'last 1 version',
    '> 1%',
    'maintained node versions',
    'not dead'
]

const themeCssPath = path.join(__dirname, 'assets/css')
const localCssImports = new Set([
    'font-cascadia-code.css',
    'font-lato.css',
    'font-merriweather.css',
    'chroma.css',
    'themes.css'
])

module.exports = {
    plugins: [
        require('postcss-import')({
            path: [themeCssPath],
            resolve: (id) => {
                const normalizedId = id.replace(/^\.\//, '')

                if (localCssImports.has(normalizedId)) {
                    return path.join(themeCssPath, normalizedId)
                }

                return id
            }
        }), 
        require('tailwindcss')({
            config: __dirname + '/tailwind.config.js'
        }),
        require('autoprefixer')({
            overrideBrowserslist: browserslist,
            stats: {}
        }),
        ...(process.env.HUGO_ENVIRONMENT === 'production' ? [purgecss] : [])
    ]
}
