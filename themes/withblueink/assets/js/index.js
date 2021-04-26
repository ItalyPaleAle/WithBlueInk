import * as lightbox from 'basiclightbox'

const themes = ['theme-auto', 'theme-light', 'theme-dark']

// Sets a theme
window.setTheme = (theme) => {
    // Remove all previous themes from the tag
    document.body.classList.remove(...themes)

    // Set the new theme
    document.body.classList.add('theme-' + theme)

    // Set in the storage
    localStorage.setItem('theme', theme)
}

// Check if we already have a favorite theme
let theme = localStorage.getItem('theme')
if (!theme || themes.indexOf('theme-' + theme) < 0) {
    // Default is auto
    theme = 'auto'
}

// Set the theme
setTheme(theme)

// Enable lightbox for all tags with "data-lightbox"
const lbs = []
document.querySelectorAll('[data-lightbox]').forEach((el) => {
    const attr = el.getAttribute('data-lightbox')
    if (!attr) {
        return
    }
    if (attr.startsWith('image:')) {
        const lb = lightbox.create(`<img src="${attr.slice(6)}" style="background: #ffffff">`)
        el.addEventListener('click', (event) => {
            console.log(event)
            event.preventDefault()
            lb.show()
        })
        el.style.cursor = 'pointer'
        lbs.push(lb)
    }
})
// When pressing the ESC key, close all open lightbox
document.addEventListener('keydown', (event) => {
    // ESC key
    if (
        (event.key && event.key == 'Escape') ||
        (event.keyCode && event.keyCode === 27)
    ) {
        lbs.forEach((lb) => {
            if (lb) {
                lb.close()
            }
        })
    }
})
