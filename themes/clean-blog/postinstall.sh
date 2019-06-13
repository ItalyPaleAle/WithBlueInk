#!/bin/sh

# Copy the fonts from Font Awesome into static/webfonts
cp -v node_modules/@fortawesome/fontawesome-free/webfonts/* static/webfonts/

# Copy the jQuery, Popper.js and Bootstrap JS files into assets/vendor (they'll be minified later)
cp -v node_modules/jquery/dist/jquery.slim.js assets/vendor/
cp -v node_modules/jquery/dist/jquery.js assets/vendor/
cp -v node_modules/popper.js/dist/umd/popper.js assets/vendor/
cp -v node_modules/bootstrap/js/dist/util.js assets/vendor/
cp -v node_modules/bootstrap/js/dist/tooltip.js assets/vendor/
