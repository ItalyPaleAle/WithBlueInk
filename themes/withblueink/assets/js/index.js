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
 
