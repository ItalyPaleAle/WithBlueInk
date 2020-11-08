module.exports = {
    theme: {
        extend: {
            colors: {
                'background': 'var(--color-background)',
                'border': 'var(--color-border)',
                'shade-100': 'var(--color-shade-100)',
                'shade-200': 'var(--color-shade-200)',
                'shade-300': 'var(--color-shade-300)',
                'shade-400': 'var(--color-shade-400)',
                'shade-500': 'var(--color-shade-500)',
                'shade-600': 'var(--color-shade-600)',
                'accent-100': 'var(--color-accent-100)',
                'accent-200': 'var(--color-accent-200)',
                'accent-300': 'var(--color-accent-300)',
            }
        },
        textShadow: {
            'sm': '0 1px 2px rgba(0, 0, 0, 0.25)',
            'default': '0 1px 2px rgba(0, 0, 0, 0.375)',
            'lg': '0 2px 10px rgba(0, 0, 0, 0.5)',
            'xl': '2px 4px 8px rgba(0, 0, 0, 0.725)',
        },
        fontSize: {
            'xs': ['.75rem', '1'],
            'sm': ['.875rem', '1.25'],
            'base': ['1rem', '1.5'],
            'lg': ['1.125rem', '1.5'],
            'xl': ['1.25rem', '1.5'],
            '2xl': ['1.5rem', '1.5'],
            '3xl': ['1.875rem', '1.25'],
            '4xl': ['2.25rem', '1.25'],
            '5xl': ['3rem', '1'],
            '6xl': ['4rem', '1'],
            '7xl': ['5rem', '1'],
        },
        fontFamily: {
            'sans': ['Lato', 'sans-serif'],
            'serif': ['Merriweather', 'serif'],
            'mono': ['Cascadia Code', 'Menlo', 'Monaco', 'Consolas', 'monospace']
        },
        textStyles: theme => ({
            heading: {
                output: false,
                fontWeight: theme('fontWeight.bold'),
                lineHeight: theme('lineHeight.tight'),
                fontFamily: theme('fontFamily.sans'),
                color: theme('colors.shade.600'),
            },
            h1: {
                extends: 'heading',
                fontSize: theme('fontSize.4xl'),
                '@screen sm': {
                    fontSize: theme('fontSize.5xl'),
                },
            },
            h2: {
                extends: 'heading',
                fontSize: theme('fontSize.3xl'),
                '@screen sm': {
                    fontSize: theme('fontSize.4xl'),
                },
            },
            h3: {
                extends: 'heading',
                fontSize: theme('fontSize.2xl'),
            },
            h4: {
                extends: 'heading',
                fontSize: theme('fontSize.xl'),
            },
            h5: {
                extends: 'heading',
                fontSize: theme('fontSize.lg'),
            },
            h6: {
                extends: 'heading',
                fontSize: theme('fontSize.lg'),
            },
            link: {
                textDecoration: 'underline',
                color: theme('colors.accent.300'),
                '&:hover': {
                    color: theme('colors.accent.200'),
                },
            },
            listing: {
                output: false,
                margin: theme('spacing.4'),
                paddingLeft: theme('spacing.4')
            },
            richText: {
                fontWeight: theme('fontWeight.normal'),
                fontSize: theme('fontSize.base'),
                fontFamily: theme('fontFamily.serif'),
                lineHeight: theme('lineHeight.relaxed'),
                letterSpacing: theme('letterSpacing.wider'),
                color: theme('colors.shade.500'),
                '> * + *': {
                    marginTop: theme('spacing.6'),
                    marginBottom: theme('spacing.6')
                },
                'h1': {
                    extends: 'h1',
                    marginTop: theme('spacing.8'),
                },
                'h2': {
                    extends: 'h2',
                    marginTop: theme('spacing.8'),
                },
                'h3': {
                    extends: 'h3',
                    marginTop: theme('spacing.8'),
                },
                'h4': {
                    extends: 'h4',
                    marginTop: theme('spacing.8'),
                },
                'h5': {
                    extends: 'h5',
                    marginTop: theme('spacing.8'),
                },
                'h6': {
                    extends: 'h6',
                    marginTop: theme('spacing.8'),
                },
                'ul': {
                    extends: 'listing',
                    listStyleType: 'disc',
                },
                'ol': {
                    extends: 'listing',
                    listStyleType: 'decimal',
                },
                'a': {
                    extends: 'link',
                },
                'b, strong': {
                    fontWeight: theme('fontWeight.bold'),
                },
                'i, em': {
                    fontStyle: 'italic',
                },
                'img': {
                    margin: '0 auto',
                    backgroundColor: '#ffffff',
                },
                'figcaption': {
                    fontStyle: 'italic',
                    fontSize: theme('fontSize.sm'),
                    textAlign: 'center',
                },
                'p > code, li > code': {
                    marginLeft: theme('spacing.1'),
                    marginRight: theme('spacing.1'),
                    color: theme('colors.altaccent.300'), //theme('colors.teal.700')
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word',
                },
                'pre': {
                    width: '100%',
                    overflowY: 'scroll',
                    fontSize: theme('fontSize.sm'),
                    '@screen md': {
                        fontSize: theme('fontSize.base'),
                    },
                    tabSize: '6',
                    padding: theme('spacing.1'),
                },
                'blockquote': {
                    marginLeft: theme('spacing.4'),
                    paddingLeft: theme('spacing.4'),
                    borderLeftWidth: '4px',
                    borderColor: theme('colors.shade.100'),
                    color: theme('colors.shade.300'),
                    fontStyle: 'italic',
                },
                'blockquote i, blockquote em': {
                    fontStyle: 'normal'
                },
                'blockquote p': {
                    marginTop: theme('spacing.4'),
                    marginBottom: theme('spacing.4')
                },
                'hr': {
                    border: 'none',
                    borderColor: theme('colors.shade.100'),
                    borderTop: '2px dashed',
                    width: '25%',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    marginTop: theme('spacing.12'),
                    marginBottom: theme('spacing.12'),
                },
            },
        }),
    },
    variants: {
        textColor: ['responsive', 'hover', 'focus', 'group-hover'],
    },
    corePlugins: {
        // Disable the container class as we'll define our own
        container: false
    },
    plugins: [
        require('tailwindcss-typography'),
        function ({ addComponents }) {
            addComponents({
                // Overwrite the container class
                '.container': {
                    'width': '100%',
                    'marginLeft': 'auto',
                    'marginRight': 'auto',
                    'paddingLeft': '1rem',
                    'paddingRight': '1rem',
                    '@screen sm': {
                        'maxWidth': '640px',
                    },
                    '@screen md': {
                        'maxWidth': '768px',
                    },
                    '@screen lg': {
                        'maxWidth': '768px',
                    },
                    '@screen xl': {
                        'maxWidth': '768px',
                    },
                }
            })
        }
    ]
}
