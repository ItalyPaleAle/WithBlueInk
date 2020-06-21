module.exports = {
    theme: {
        extend: {},
        textShadow: {
            default: '0 2px 5px rgba(0, 0, 0, 0.5)',
            lg: '0 2px 10px rgba(0, 0, 0, 0.5)',
            xl: '2px 4px 8px rgba(0, 0, 0, 0.725)',
        },
    },
    variants: {},
    corePlugins: {
        container: false
    },
    plugins: [
        require('tailwindcss-typography'),
        function ({ addComponents }) {
            addComponents({
                '.container': {
                    width: '100%',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    paddingLeft: '1rem',
                    paddingRight: '1rem',
                    '@screen sm': {
                        maxWidth: '640px',
                    },
                    '@screen md': {
                        maxWidth: '768px',
                    },
                    '@screen lg': {
                        maxWidth: '820px',
                    },
                    '@screen xl': {
                        maxWidth: '820px',
                    },
                }
            })
        }
    ]
}
