#!/bin/sh

set -e

echo "\033[0;1mBuilding for environment: \033[0;1;35mproduction\033[0;0m"

echo "\033[0;1mHugo version\033[0;0m"
hugo version

# Remove old compiled data
echo "\033[0;1mCleaning destination directory...\033[0;0m"
rm -rf public

# Run "npm install" in the theme folder
# Then symlink node_modules so hugo can build the site
echo "\033[0;1mRefreshing theme dependencies...\033[0;0m"
(cd themes/withblueink && npm ci)
[ ! -e node_modules ] && ln -s -v themes/withblueink/node_modules

# Compile the code with the "production" environment
echo "\033[0;1mBuilding...\033[0;0m"
#hugo --environment=production --buildFuture
hugo --environment=production --minify

# Copy static files
#echo "\033[0;1mCopy static files...\033[0;0m"
#cp -v _statiko.yaml public/

# Remove files that shouldn't be published
echo "\033[0;1mRemoving unnecessary files...\033[0;0m"
rm -v public/*.sh || true
rm -v public/.dockerignore || true
rm -v public/Makefile || true
rm -v public/Dockerfile || true
rm -rvf public/docker || true
rm -v public/**/.gitignore || true
