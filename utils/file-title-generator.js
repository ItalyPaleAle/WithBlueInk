#!/usr/local/bin/node

'use strict';

let unorm = require('unorm')
let XRegExp = require('xregexp')

// Get the title from the console
let titleWords = process.argv.slice(2)

// Merge all words with spaces
let title = titleWords.join(' ')

// Normalize, lowercase all the letters and replace spaces with dashes
title = transliterate(title)
title = title.toLowerCase()

console.log(title)

function transliterate(str) {
    // 1. Decompose Unicode sequences
    str = unorm.nfd(str)
    
    // 2. Remove all sequences that are part of the "Nonspacing" and "Other" planes, then replace all characters that are not numbers or latin digits with dashes
    str = str.replace(XRegExp('\\p{M}|\\p{C}', 'g'), '').replace(/[^A-Za-z0-9]/g, '-')
    
    // 3. Replace all multiple dashes with a single one
    str = str.replace(/\-{2,}/g, '-')
    
    // 4. Remove trailing dashes
    str = str.replace(/^\-{1,}/, '').replace(/\-{1,}$/, '')
    
    // 5. Compose the Unicode sequences again
    str = unorm.nfc(str)
    
    return str
}
