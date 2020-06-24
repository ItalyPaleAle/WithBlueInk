---
title: "Cloud native, container-ready PHP"
description: "Building PHP apps and microservices for containers and high availability"
date: 2019-07-24 20:14:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
image: "img/php.jpg"
comments: yes
coverImage:
  author: "Sharon McCutcheon"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@sharonmccutcheon"
---

PHP is the language that everyone loves to hate. It was the first language many of us used to build web apps (including myself!), but it's fallen out of favors with developers. There is plenty of reason behind that, and most criticism is, or at least was, justifiable: PHP 5 suffered from multiple design and performance issues, had various inconsistencies, lacked any Unicode support, etc.

However, it's 2019, and this is not your dad’s PHP. PHP 7 is a robust language that can be used to build web applications really fast. Not only it lets developers build web apps in little time, but the interpreter is significantly more performing than it used to be. [Phoronix found](https://www.phoronix.com/scan.php?page=news_item&px=PHP-7.3-Performance-Benchmarks) PHP 7.3 to be almost three times faster than PHP 5.6, with [real-world benchmarks](https://kinsta.com/blog/php-benchmarks/) using popular applications showing similar results.

Despite the antipathy some carry for PHP, it's still widely used, with 26% of developers saying they use PHP in the [2019 StackOverflow survey](https://insights.stackoverflow.com/survey/2019). You'll find them working inside companies building both internal line-of-business applications and external-facing websites, including greenfield ones, and working as consultants. In the last year I've met many different companies, from high-growth startups to Fortune 500's, that are building apps of all kinds with PHP. If you're still curious, you might find Alexander Katrompas's [controversial piece](https://medium.com/@alexkatrompas/java-will-kill-your-startup-php-will-save-it-f3051968145d) *"Java will kill your startup. PHP will save it."* an inspiring read, whether you agree with it or not.

In short, PHP might not be sexy, yet it still rules the web.

## Principles for cloud native PHP

Enough selling PHP. Whether you're reading this because you enjoy writing PHP code, or because your boss asked you to, let's see how you can write PHP code that's for 2019, modern, and cloud native.

Cloud native apps follow certain design principles that make them ready to be run on commodity hardware, maintain high-availability, scale horizontally rather than vertically, and optionally be containerized. This makes those apps easier to maintain, dynamically scalable (for example depending on traffic), and able to run on *serverless* platforms (including Azure Web Apps, Heroku, AWS Elastic Beanstalk…). The redundancy and horizontal scalability makes it possible to guarantee uptime also in case of failures. The principles of cloud native apps should look familiar to you if you've heard of the [12‑factor app](https://12factor.net/), on which they're actually based.

There's nothing inherently wrong with PHP that would make it impossible to build cloud-native apps with it. Actually, the language itself has certain aspects that make it natively suited to build cloud native apps, starting from the fact that PHP pages are completely stateless, as you cannot share state between multiple requests.

The problem lies with the set of patterns and practices most PHP apps are built on, which mostly date back to the early 00s. Even very popular off-the-shelves PHP apps like WordPress or Drupal aren't built to be cloud native, and scaling them horizontally is not something for the faint-hearted.

When architecting cloud native PHP applications, there are four principles that I'd like to point out. I'm specifically highlighting these because they go against the traditional patterns and practices that have accompanied PHP development for the last 20 years.

### 1. Keep your content off the filesystem

This is by far the biggest thing, and it goes against one of the most common practice of PHP apps: all your generated content needs to stay off the local filesystem.

!["PHP Apps? Plan all the storage!" Meme](/assets/php-meme.jpg)

Since the PHP 4 days, virtually all apps have been storing content (e.g. user uploads, generated data, etc) in a folder on the local filesystem. For example, WordPress uses the famous `wp-content` directory to store both customizations (plugins and themes) and uploaded assets (post images, attachments…). When designing cloud-native apps, this is going to be a blocker, as data that is written on the local filesystem won't automatically replicate to other nodes when you scale horizontally, won't be available if you're failing over another server, won't persist when you destroy a container, etc.

There are three parts to solving this problem:

- User-generated content, uploads, etc should be put inside some sort of object storage, using the vendors' SDKs to store and retrieve them as needed. For example (with links to SDKs): [AWS S3](https://aws.amazon.com/sdk-for-php/), [Azure Blob Storage](https://github.com/Azure/azure-storage-php), etc. If you need something self-hosted, [MinIO](https://docs.min.io/docs/how-to-use-aws-sdk-for-php-with-minio-server.html) is a good option; deploy it on a separate server or cluster of servers.
- The entire filesystem where your app is stored (traditionally, that would be the webserver's root folder) should be considered read-only: you should not store any file on local disk. Only exceptions to this are temporary files that are used by the current page alone, for example image thumbnails before they're uploaded to object storage. However, temporary files that are shared between multiple pages/requests should not be on the local filesystem, because future requests from the same user might hit a different node.
- Customizations such as plugins and themes should be shipped together with the app. Check them into your source code repository and treat them as you'd do with any other PHP code.

At this point, it should also go without saying that you cannot use SQLite (or anything similar) as your datastore, as that is only accessed through a local filesystem.

### 2. Store sessions on Redis

PHP's [built-in sessions](https://www.php.net/manual/en/book.session.php) are great to maintain state between requests. They let you start a session with `session_start()` and then store and retrieve data using the `$_SESSION` global variable.

However, the default configuration is to store session data in a temporary file on the local disk. Again, this will not work if you're using multiple nodes: the best solution is to store sessions in a centralized Redis server or cluster. Redis is a very fast in-memory key-value store that can be queried over the network, and using it to store PHP sessions can be as easy as making a small configuration change (no new code necessary!).

You will need to have a Redis server installed on a separate node. You can also use Redis-as-a-Service if your cloud provider offers it (e.g. Azure Cache for Redis, AWS ElastiCache for Redis, etc).

Before enabling Redis for session storage, install the Redis PHP extension. The exact steps depend on your operating system and what binary packages are available; the [official documentation](https://github.com/phpredis/phpredis/blob/develop/INSTALL.markdown) has some details. There are then three ways to set up Redis for storing sessions.

In your `php.ini` file (exact location depends on the operating system and the server API used, e.g. FPM or mod_php) you can enable storing sessions in Redis for the entire server, by setting:

````ini
session.save_handler="redis"
; Replace "hostname-or-ip" with the address of your Redis server
session.save_path="tcp://hostname-or-ip:6379"
````

If you're using Apache as web server, you can also set this per-site or per-folder using an `.htaccess` file:

````htaccess
php_value session.save_handler "redis"
php_value session.save_path "tcp://hostname-or-ip:6379"
````

Lastly, you can set this directly from your PHP code, before invoking `session_start()`:

````php
<?php
ini_set("session.save_handler", "redis");
ini_set("session.save_path", "tcp://hostname-or-ip:6379");
session_start();
````

For advanced configuration, e.g. when using a cluster of Redis instances, check out the [official documentation](https://github.com/phpredis/phpredis#php-session-handler).

### 3. Replace config files with environmental variables

Forget `config.php` files. If you need to have configuration options, for example database connection strings, use environmental variables instead.

You can set environmental variables in multiple ways. If using Apache and mod_php, you can set them in a `.htaccess` file using the syntax `SetEnv MY_KEY "my value"`; if using PHP-FPM, you can set them in the `php-fpm.conf` file with `env[MY_KEY] = "my value"`. There are many other ways, depending on your operating system and setup.

Retrieving environmental variables can be done in multiple ways too. The three lines below are equivalent:

````php
<?php
// Use the $_SERVER and $_ENV superglobals
$_SERVER['MY_KEY']
$_ENV['MY_KEY']

// Use the getenv() function
getenv('MY_KEY')
````

### 4. No built-in installers or updaters

Many popular PHP applications available off-the-shelves ship with built-in installer scripts, and some even have built-in updaters. This practice made a lot of sense when apps were deployed by uploading a bunch of ZIP files to the production server via FTP.

However, cloud native apps need to be self-contained and the codebase must be read-only. This is because every change in the source code won't replicate to other nodes, and if you're containerizing your app, won't necessarily survive a restart of container either.

Cloud native apps should not come with installers that require any manual intervention. However, automated installers or scripts that set up an environment can work, as long as they can take input programmatically, e.g. via environmental variables. Every script performing setup tasks needs to take into account that there could already be another node running or that previously ran, so all setup steps might already be complete.

## Containerize PHP apps

Once you've built your app, you might find containers particularly useful to run it in production. While containers are most definitely not required to run apps, they do help with running at scale, replicating across multiple nodes, and simplifying management and deployments.

When running PHP apps inside a container, I personally find using the Apache web server and mod_php the simplest approach. Compared to using Nginx and PHP-FPM, you have a single process to maintain so it is not necessary to orchestrate multiple containers, and you also get the ability to use `.htaccess` files to manage certain features of the web server more easily. Performance-wise, it's widely accepted that Apache+mod_php is *marginally* faster at executing PHP code, although Nginx is much faster at serving static assets. Because most cloud native apps are microservices-oriented and the PHP code is often used to build APIs only, this shouldn't matter too much. Even if your app were to be more monolithical, when you use a CDN to cache your static assets your web server wouldn't be spending too much time serving non-PHP documents anyways.

Using the official PHP image from [Docker Hub](https://hub.docker.com/_/php), you can containerize your PHP application with a Dockerfile similar to this (tweak it depending on your needs):

````Dockerfile
# Based on the PHP image for PHP 7.3 running with Apache
FROM php:7.3-apache

# Run Apache and PHP as user www-data
ENV APACHE_RUN_USER=www-data APACHE_RUN_GROUP=www-data

RUN \
# Enable mod_rewrite
  ln -s "$APACHE_CONFDIR/mods-available/rewrite.load" "$APACHE_CONFDIR/mods-enabled/" \
# Use the default production configuration
  && mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
# Install the redis extension
  && pecl install redis-5.0.1 \
  && docker-php-ext-enable redis \
# Install the pdo and pdo_mysql extension
  && docker-php-ext-install pdo \
  && docker-php-ext-install pdo_mysql \
# Install the gd extension
  && apt-get update \
  && apt-get install -y \
    libfreetype6-dev \
    libjpeg62-turbo-dev \
    libpng-dev \
  && docker-php-ext-configure gd --with-freetype-dir=/usr/include/ --with-jpeg-dir=/usr/include/ \
  && docker-php-ext-install gd \
  && rm -rf /var/lib/apt/lists/* \

# Copy the source code from the current folder
COPY . /var/www/html/
````

The official [README file](https://github.com/docker-library/docs/blob/master/php/README.md) for the Docker image contains useful information for advanced configurations, changing the `php.ini` configuration, as well as on how to install other extensions.

Place the Dockerfile in the same folder as your PHP files, then run the `docker build -t myphpapp .` command to build a container image that you can deploy as you wish.

You'll notice there's one thing missing here: enabling Redis for storing sessions. Since the address of the Redis server is something that should be passed at runtime as environmental variable, you shouldn't hardcode it into a config file. Instead, I'd suggest configuring the session handler from your PHP code, similarly to the example above:

````php
<?php
ini_set("session.save_handler", "redis");
ini_set("session.save_path", $_ENV['REDIS_ADDR']);
session_start();
````

Then, you can pass the value of `REDIS_ADDR` when you're starting the container (via the Docker CLI or a Docker Compose file, for example):

````sh
docker run \
  -e "REDIS_ADDR=tcp://hostname-or-ip:6379" \
  -p 80:80 \
  myphpapp
````
