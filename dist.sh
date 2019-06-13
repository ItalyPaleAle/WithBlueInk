#!/bin/sh

echo "\033[0;1mBuilding for environment: \033[0;1;35mproduction\033[0;0m"

# Remove old compiled data
echo "\033[0;1mCleaning destination directory...\033[0;0m"
rm -rf public

# Run "npm install" in the theme folder
echo "\033[0;1mRefreshing theme dependencies\033[0;0m"
(cd themes/clean-blog && npm ci)

# Compile the code with the "production" environment
echo "\033[0;1mBuilding...\033[0;0m"
hugo --environment=production --buildFuture

# Remove files that shouldn't be published
echo "\033[0;1mRemoving unnecessary files...\033[0;0m"
rm -v public/*.sh
rm -v public/.dockerignore
rm -v public/Makefile
rm -v public/Dockerfile
rm -rvf public/docker
rm -rvf public/assets-source
rm -v public/**/.gitignore
