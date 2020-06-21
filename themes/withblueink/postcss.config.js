const purgecss = require('@fullhuman/postcss-purgecss')({
    content: [ './hugo_stats.json' ],
    defaultExtractor: (content) => {
        let els = JSON.parse(content).htmlElements;
        return els.tags.concat(els.classes, els.ids);
    }
})

module.exports = {    
    plugins: [        
        require('postcss-import')({
            path: __dirname + '/assets/css'
        }), 
        require('tailwindcss')({
            config: __dirname + '/tailwind.config.js'
        }),
        require('autoprefixer'),
        ...(process.env.HUGO_ENVIRONMENT === 'production' ? [purgecss] : [])
    ]
}
