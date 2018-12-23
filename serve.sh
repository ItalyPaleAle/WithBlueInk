#!/bin/sh

echo "\033[0;1mBuilding for environment: \033[0;1;35mdevelopment\033[0;0m"

# Run "npm install" in the theme folder
echo "\033[0;1mRefreshing theme dependencies\033[0;0m"
(cd themes/clean-blog && npm install)

# Compile the code with the "production" environment
echo "\033[0;1mBuilding and starting web server...\033[0;0m"
HUGO_ENV=development hugo serve
