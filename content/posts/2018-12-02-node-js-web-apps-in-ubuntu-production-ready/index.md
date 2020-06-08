---
title: "Node.js web apps in Ubuntu, production-ready"
description: "Step-by-step instructions for running Node.js in production with systemd"
date: 2018-12-02 12:05:00
author: "Alessandro Segala"
image: "img/node.jpg"
comments: yes
slug: "node-js-web-apps-in-ubuntu-production-ready"
authorTwitter: "@ItalyPaleAle"
---

I've been managing Node.js web apps in production on Linux servers for quite a few years, and I thought only now to document it publicly, hoping it can help others. There are too many ways to run Node.js apps, and I won't try to cover them all; if you're looking for a simple, straightforward way to run a Node.js web app on a VM with Ubuntu 18.04 (without containers), this article is for you.

## Prerequisites

I'm assuming that you'll be starting from a freshly-installed, minimal Ubuntu 18.04 LTS server or virtual machine. This can be on a cloud provider (including Azure, etc) or in your own datacenter.

In this article, I'll be using this sample code from [shapeshed/express_example](https://github.com/shapeshed/express_example), which is a very simple web app based on Express and doesn't use a database. While the actual application you want to run doesn't really matter, I am going to make three assumptions about the structure of the app; if yours is different you might need to make small changes to scripts used in this article:

- You can launch the app with the file `bin/www`
- The app has its static assets (e.g. images, stylesheets, fonts…) in the `public` folder
- You can choose what port your Node.js app is listening on by passing the `PORT` environmental variable (e.g. launching the app with `PORT=3001 node bin/www`)

Assuming you have Node.js installed, you can test the app locally on your laptop with:

````sh
git clone https://github.com/shapeshed/express_example
cd express_example
npm install
node bin/www
````

If you visit `http://localhost:3000`, you'll see the app running:

![App running locally on localhost:3000](/assets/nodejs-ubuntu/app-local.png)

## Install Node.js

To start, connect to the VM via SSH.

We'll be installing Node.js using the [official binaries](https://nodejs.org/en/download/) for Linux. There are a few reasons why I recommend this:

1. Packages available in the repositories of Linux distributions (including Ubuntu) tend to be quite old. Node.js evolves fast, and the maintainers of Linux distributions don't keep up.
2. Installing from the official binaries lets us have more control around the version of Node.js we want to use. We have the flexibility to use Node.js 10 (the current LTS as of writing), or any other version (although I'd recommend sticking to LTS versions for production apps, there are situations where the latest version is desirable).
3. Lastly, we can have multiple versions of Node.js installed side-by-side, so we can use a different version of the runtime for different applications.

To install Node.js, run the following commands:

````sh
# 10.14.1 is the latest LTS version as of writing; you can pick any other newer (or older) version from https://nodejs.org/
NODE_VERSION="v10.14.1"

# Download the binary tarball in /tmp
cd /tmp
curl -LO http://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.gz

# Extract the tarball into a subfolder in /usr/local/
sudo tar -xzvf node-$NODE_VERSION-linux-x64.tar.gz -C /usr/local/

# You can check that Node.js is installed with
sudo ls /usr/local/node-$NODE_VERSION-linux-x64/bin/node
````

The Node.js interpreter will be available in `/usr/local/node-$NODE_VERSION-linux-x64/bin/node`:

````sh
$ NODE_VERSION="v10.14.1"

# Check Node.js
$ /usr/local/node-$NODE_VERSION-linux-x64/bin/node -v
v10.14.1
````

In order to be able to use Node.js and NPM without too much hassle, we should first create a symlink so `/usr/local/node` points to `/usr/local/node-$NODE_VERSION-linux-x64`, so there's less typing. We will then add the `/usr/local/node/bin` folder to the `$PATH`. You can read why I recommend doing this, rather than uncompressing the tarball into `/usr/local/node` or than putting the Node.js binary in `/usr/bin` directly, in this [StackOverflow answer](https://stackoverflow.com/questions/23082242/how-to-install-nodejs-0-10-26-from-binaries-in-ubuntu/23084499#23084499).

````sh
NODE_VERSION="v10.14.1"

# Create the symlink so /usr/local/node points to the Node.js install folder
sudo ln -s /usr/local/node-$NODE_VERSION-linux-x64 /usr/local/node

# Add /usr/local/node/bin to the $PATH, then refresh the $PATH in the current shell
echo "export PATH=\${PATH}:/usr/local/node/bin" >> ~/.bashrc
source ~/.bashrc
````

Node.js and NPM are now easier to invoke:

````sh
# "node" should be in the $PATH
$ which node
/usr/local/node/bin/node

# "node" and "npm" are easy to invoke
$ node -v
v10.14.1
$ npm -v
6.4.1
````

### Update Node.js

Updating Node.js is easy: first, download the new binary tarball and uncompress it, and then update the `/usr/local/node/bin` symlink.

For example, to install Node.js 11 on the same system:

````sh
# Use version 11.3.0 (Current) now
NODE_VERSION="v11.3.0"

# Same commands as before
cd /tmp
curl -LO http://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.gz
sudo tar -xzvf node-$NODE_VERSION-linux-x64.tar.gz -C /usr/local/

# Update the symlink so /usr/local/node points to the new version
# Node the "fn" flags, so ln replaces the old link
sudo ln -sfn /usr/local/node-$NODE_VERSION-linux-x64 /usr/local/node
````

Check that Node.js has been updated:

````sh
$ node -v
v11.3.0
````

> Why not using [NVM](https://github.com/creationix/nvm)? In my opinion, tools like NVM are great for development, but they keep the Node.js runtime in a folder they manage, inside a user's home folder. For these reasons, I am not a big fan of this approach for running apps in production.

## Run the application

It's now time to run the application on our server!

We'll be placing our apps' code inside the home folder of the current (non-root) user. In my case, the user is called `alessandro`:

````sh
cd /home/alessandro

# Clone the sample code
git clone https://github.com/shapeshed/express_example
cd express_example

# Install NPM dependencies
# Note the "--production" switch, so packages inside "devDependencies" won't be installed
npm install --production
````

Done! We can test that the app works with:

````sh
# sudo is necessary to bind to a port below 1024
# /usr/local/node/bin is not in the $PATH for the root user (we're using sudo), so we need to write the full path to the node binary
sudo PORT=80 /usr/local/node/bin/node bin/www
````

Open the browser to the IP (or hostname) of your server, and you should see the app live (if not, check if there's a firewall blocking port 80). Then, stop the app with CTRL+C.

## Run the app in background

Next, we're going to run the app as a background process, which is launched when the server boots and is restarted automatically if it crashes.

There are many ways to daemonize a Node.js app on Linux, but my favorite one is using systemd. If you're not familiar with it, systemd is a tool installed in essentially all modern Linux distributions, which has the task (among many others *– too many, according to some critics*) of managing background services.

> Another very popular option is to use a process manager like PM2. However, PM2 itself is a Node.js app, and it needs to be supervised by systemd, so at the end of the day it's the same story, but with an extra layer. Using PM2 can help in certain situations, however, such as when you frequently add or remove apps/services.

The first step is creating a systemd unit file, which is a text file defining our Node.js application as a service. Create a file called `express_example.service` in `/etc/systemd/system/`. You can replace `express_example` with the name of your app, but note the `.service` extension. Copy the text below in the file `/etc/systemd/system/express_example.service` (owned by the root user):

````ini
[Unit]
# Custom description, set as you wish
Description=Node.js sample Express app
After=network.target

[Service]
Type=simple
# Name of the system user running the app
User=alessandro
# Port the app is bound to, in this case 3000 (must be greater than 1024)
# If your app needs more environmental variables, just add more "Environment=" lines, or load them from a file (e.g. a "dotfile") with the "EnvironmentFile" rule
Environment=PORT=3000
# Path where the code is
WorkingDirectory=/home/alessandro/express_example
# Full path to the Node.js binary - if you prefer to specify a version, use the full path like "/usr/local/node-v10.14.1-linux-x64/bin/node"
# If your app's entrypoint isn't "bin/www", change this line
ExecStart=/usr/local/node/bin/node bin/www
# This tells systemd to restart the app if it crashes
Restart=always

[Install]
WantedBy=multi-user.target
````

We can now enable the systemd unit so it's automatically started at boot, and then start it right away:

````sh
# Enable the "express_example" unit (name of the file) so it's started automatically at boot
sudo systemctl enable express_example

# Start the service right away
sudo systemctl start express_example

# Check that the app is running; status should contain "running"
sudo systemctl status express_example
````

You can now connect to your VM's IP (or hostname) on port 3000 (e.g. `http://52.175.200.192:3000/`) to see the website live (if you can't connect, check if there are firewall rules blocking port 3000).

Other useful commands when using systemd are:

````sh
# Run this every time after you modify the unit file on disk
sudo systemctl daemon-reload

# Restart the service
sudo systemctl restart express_example

# Stop the service
sudo systemctl stop express_example

# The command above will stop the service, but it will still be started automatically at boot; to disable that, do:
sudo systemctl disable express_example

# Check the logs of the app
sudo journalctl -u express_example

# To get a live stream of the logs as the app is running, you can add the -f flag
# If you refresh the web page, you'll see the requests flowing live in the terminal
sudo journalctl -f -u express_example
````

## Adding Nginx

In the previoius step we started the app on port 3000, and not 80. In addition to the fact that binding to port 80 would require running the app as root, which is a security risk (although there are workarounds for that), it's best practice to not expose a Node.js app directly on the Internet, but proxying it using Nginx (or another reverse proxy). There are multiple reasons for that, including:

1. It allows for more efficient usage of the Node.js CPU time by letting Nginx doing TLS termination and serving static assets
2. It lets you run multiple apps on the same server/port listening on a different hostname, and lets you scale your app on multi-core processors better (see next section)
3. It's potentially safer

Let's start by installing Nginx:

````sh
sudo apt-get update
sudo apt-get install -y nginx
````

Next, we need to configure Nginx. In this example I'm showing you the most basic configuration, without TLS; if you have multiple Node.js apps, you will want to add multiple sites listening to different hostnames. Edit the file `/etc/nginx/sites-available/default` so it looks like:

````conf
upstream backend {
    # Address of the Node.js app
    server localhost:3000;
}

server {
    listen 80 default_server;

    server_name _;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
     }
}
````

Start Nginx (and enable it to start at boot) with:

````sh
sudo systemctl enable nginx
sudo systemctl restart nginx
````

If you open the IP (or hostname) of your server in a web browser, you should see the web app correctly running on port 80 (in addition to port 3000, which you should block in your firewall from now on).

The sample app we're using serves a bunch of static files (CSS, fonts) from the "public" directory. It could be a good idea (though optional) to serve those files directly from Nginx, which is highly optimized for returning static assets, rather than wasting cycles in our Node.js app. This can be done relatively easily, with a small change in the Nginx configuration file:

````conf
upstream backend {
    # Address of the Node.js app
    server localhost:3000;
}

server {
    listen 80 default_server;

    server_name _;

    # The folder containing the static assets
    root /home/alessandro/express_example/public;

    location / {
        # First, try if the file exists locally, otherwise request it from the app
        try_files $uri @app;
    }

    # The proxy, same as above
    location @app {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
     }
}
````

Restart Nginx:

````sh
sudo systemctl restart nginx
````

When you look at the logs for the Node.js app now (`sudo journalctl -f -u express_example`), you'll see that only the requests for pages that aren't static assets get proxied, and everything else is served by Nginx directly.

## Scaling on multi-core processors

Node.js is single-threaded, which means that your code can only run on a single processor (*I know technically it's [not true](https://medium.com/@FloSloot/node-js-is-not-single-threaded-88928ada5838), but bear with me this time*). What if you have a multi-core server?

There are multiple ways to make Node.js apps scale horizontally on multiple cores. One way is to use the [cluster](https://nodejs.org/api/cluster.html) module, which has some advantages but also requires code changes. My preferred way to scale horizontally is to just… launch multiple instances of the same app! For as long as your app is stateless (see [The Twelve-Factor App](https://12factor.net/)), this will let you scale "infinitely", also across multiple servers, and doesn't require code changes.

This can be done pretty easily. To start, create a new systemd unit file (make sure you stop and disable the service created in the previous step) called `/etc/systemd/system/express_example@.service`. This is very similar to the previous example, but note the `@` character in the file name, which will let us start multiple instances of the same service, listening on different ports.

````ini
[Unit]
# Custom description, set as you wish
Description=Node.js sample Express app
After=network.target

[Service]
Type=simple
# Name of the system user running the app
User=alessandro
# Port will be specified when starting the systemd service
Environment=PORT=%i
# Path where the code is
WorkingDirectory=/home/alessandro/express_example
# Full path to the Node.js binary - if you prefer to specify a version, use the full path like "/usr/local/node-v10.14.1-linux-x64/bin/node"
# If your app's entrypoint isn't "bin/www", change this line
ExecStart=/usr/local/node/bin/node bin/www
# This tells systemd to restart the app if it crashes
Restart=always

[Install]
WantedBy=multi-user.target
````

The only difference from the previous example is that the port is dynamically defined: note the `Environment=PORT=%i` line.

Let's start two instances of the same app, listening on two different ports (any port works, as long as it's greater than 1024):

````sh
# Enable the services on ports 3000 and 3001, so they start at boot
sudo systemctl enable \
  express_example@3000 \
  express_example@3001

# Start the services right away
sudo systemctl start \
  express_example@3000 \
  express_example@3001

# Check the status
sudo systemctl status express_example@3000
sudo systemctl status express_example@3001
````

A good rule of thumb is to start as many instances as your VM's cores (assuming you only have one app running on the server). In practice, this depends on the characteristics of your app, and you should run some load tests to see what the optimal instance count is.

Now, let's modify the Nginx configuration so it uses both instances. Edit the file `/etc/nginx/sites-available/default` and change the `upstream backend` block:

````conf
#...

upstream backend {
    # Addresses of each instance
    server localhost:3000;
    server localhost:3001;
}

#... Rest is unchanged
````

Restart Nginx with:

````sh
sudo systemctl restart nginx
````

You can now browse your website on port 80. Nginx will perform a "round-robin" load balancing, alternating between the two backend apps to serve the requests. If you follow the logs for each service, you'll notice the requests coming to them alternately (use `sudo journalctl -f -u express_example@3000` and `sudo journalctl -f -u express_example@3001` in two separate terminal windows). If one backend app is stopped or crashes, Nginx will remove it from the rotation automatically, until it's back online.


<small>*Original cover photo by Ferdinand Stöhr ([Unsplash](https://unsplash.com/@fellowferdi))*</small>
