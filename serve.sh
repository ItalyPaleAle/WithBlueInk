#!/bin/sh

set -e

echo "\033[0;1mBuilding for environment: \033[0;1;35mdevelopment\033[0;0m"

echo "\033[0;1mHugo version\033[0;0m"
hugo version

# Install required dependencies
echo "\033[0;1mEnsure dependencies...\033[0;0m"
npm ci
#npm install -g postcss-cli autoprefixer tailwindcss postcss-import

# Run "npm install" in the theme folder
echo "\033[0;1mRefreshing theme dependencies...\033[0;0m"
(cd themes/withblueink && npm install)

# Syntax highlighting CSS
echo "\033[0;1mSyntax highlighting CSS...\033[0;0m"
hugo gen chromastyles --style=monokailight > themes/withblueink/assets/css/chroma-monokailight.css

# Compile the code with the "production" environment
echo "\033[0;1mBuilding and starting web server...\033[0;0m"
hugo serve --environment=development --buildFuture --buildDrafts --disableFastRender
