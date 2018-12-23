###
### Stage 1: builder
###

# We need Node.js and NPM for the modules
FROM node:10-stretch AS builder

# Version of Hugo
ENV HUGO_VERSION=0.52

# Add Hugo
RUN cd /tmp && \
    curl -fsSL "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_Linux-64bit.tar.gz" -o hugo.tar.gz && \ 
    tar -zxvf hugo.tar.gz && \
    mv hugo /usr/local/bin

# Allow running NPM postinstall scripts as root
RUN npm set unsafe-perm true

# Copy the site's content
WORKDIR /build
COPY . /build

# Build the website
RUN sh dist.sh

###
### Stage 2: blog
###
FROM nginx:stable-alpine

# Copy HTML files
COPY --from=builder /build/public /www

# Copy Nginx configuration
RUN rm /etc/nginx/conf.d/*
COPY docker/withblueink.conf docker/ssl.conf docker/gzip.conf /etc/nginx/conf.d/
