---
title: "Yes, you can run Docker on Raspbian"
description: "Very simple steps for getting Docker and Docker Compose on Raspberry Pi 2, 3 and 4"
date: 2019-07-13 10:14:00
aliases:
  - "/2017/12/31/yes-you-can-run-docker-on-raspbian.html"
author: "Alessandro Segala"
image: "img/pie.jpg"
comments: yes
authorTwitter: "@ItalyPaleAle"
coverImage:
  author: "Lucky Heath"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@capturebylucy"
---

> *This article is an updated version of the one posted in December 2017, with instructions for the new Raspberry Pi 4 and Raspbian Buster. It has been updated again on July 26 after stable packages for Raspbian Buster were released.*

This post is the definitive guide on using Docker on a Raspberry Pi, something I wish I had one week ago. I have a couple of Raspberry Pi's to provide services for my home and using Docker seemed the simplest way to deploy them. However, the number of guides for doing that on the internet is relatively low.

Turns out there's **plenty of good news**. Docker does run on Raspberry Pi 2, 3 and 4, and you don't need any other OS beside Raspbian, the most popular and widely supported distribution. Even better: you can also install Docker Compose.

Please note, however, that users are reporting issues with trying to install Docker on Raspberry Pi 1 and Zero, because of the different CPU architecture.

## Installing Docker

Installing Docker CE on Raspbian (Stretch or Buster) for Raspberry Pi is straightforward, and it's fully supported by Docker. Docker CE is not supported on Raspbian Jessie anymore, so I'd recommend upgrading to a more recent release.

We're going to install Docker from the **official Docker repositories**. While there are Docker packages on the Raspbian repos too, those are not kept up to date, which is something of an issue with a fast-evolving software like Docker.

To install Docker CE on Raspbian Stretch and Buster:

````sh
# Install some required packages first
sudo apt update
sudo apt install -y \
     apt-transport-https \
     ca-certificates \
     curl \
     gnupg2 \
     software-properties-common

# Get the Docker signing key for packages
curl -fsSL https://download.docker.com/linux/$(. /etc/os-release; echo "$ID")/gpg | sudo apt-key add -

# Add the Docker official repos
echo "deb [arch=armhf] https://download.docker.com/linux/$(. /etc/os-release; echo "$ID") \
     $(lsb_release -cs) stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list

# Install Docker
# The aufs package, part of the "recommended" packages, won't install on Buster just yet, because of missing pre-compiled kernel modules.
# We can work around that issue by using "--no-install-recommends"
sudo apt update
sudo apt install -y --no-install-recommends \
    docker-ce \
    cgroupfs-mount
````

That's it! The next step is about starting Docker and enabling it at boot:

````sh
sudo systemctl enable docker
sudo systemctl start docker
````

Now that we have Docker running, we can test it by running the "hello world" image:

````sh
sudo docker run --rm arm32v7/hello-world
````

If everything is working fine, the command above will output something similar to:

![Output of Docker "hello world" image](/assets/docker-pi-hello-world.png)

## About ARM images

This should hardly come as a surprise, but there's a caveat with running Docker on a Raspberry Pi. Since those small devices do not run on x86_64, but rather have ARM-based CPUs, you won't be able to use all the packages on the Docker Hub.

Instead, you need to look for images distributed by the **arm32v7** organization (called **armhf** before), or tagged with those labels. Good news is that the arm32v7 organization is officially supported by Docker, so you get high-quality images.

> While the CPUs inside Raspberry Pi 3's and 4's are using the ARMv8 (or ARM64) architecture, Raspbian is compiled as a 32-bit OS, so using Raspbian you're not able to run 64-bit applications or containers.

Many common applications are already pre-built for ARM, including a growing number of official images, and you can also find a list of [community-contributed arm32v7 images on Docker Hub](https://hub.docker.com/r/arm32v7). However, this is still a fraction of the number of images available for the x86_64 architecture.

## Installing Docker Compose

In this last step we're installing Docker Compose.

The official installation method for Linux, as in the Docker documentation, points users to the GitHub downloads page, which however does not offer pre-built binaries for the ARM architecture.

Luckily, we can still easily install Docker Compose from pip:

````sh
# Install required packages
sudo apt update
sudo apt install -y python3-pip libffi-dev

# Install Docker Compose from pip (using Python3)
# This might take a while
sudo pip3 install docker-compose
````

With this, you now have a complete Raspberry Pi mini-server running Docker and ready to accept your containers.
