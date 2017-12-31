---
layout:     post
title:      "Yes, you can run Docker on Raspbian"
subtitle:   "Very simple steps for getting Docker and Docker Compose on Raspberry Pi 2 and 3"
date:       2017-12-31 10:14:00
author:     "Alessandro Segala"
header-img: "img/pie.jpg"
comments:   yes
---

This post is the definitive guide on using Docker on a Raspberry Pi 2 or 3, something I wish I had one week ago. I have a couple of Raspberry Pi's to provide services for my home and using Docker seemed the simplest way to deploy them. However, the number of guides for doing that on the internet is relatively low.

Turns out there's **plenty of good news**. Docker does run on Raspberry Pi 2 and 3, and you don't need any other OS beside Raspbian, the most popular and widely supported distribution. Even better: you can also install Docker Compose.

## Installing Docker

Installing Docker CE on Raspbian (Jessie or Stretch) for Raspberry Pi 2 and 3 is straightforward, and it's fully supported by Docker.

We're going to install Docker from the **official Docker repositories**. While there are Docker packages on the Raspbian repos too, those are not kept up to date, which is something of an issue with a fast-evolving software like Docker.

To install Docker CE on Raspbian Jessie/Stretch:

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
sudo apt update
sudo apt install docker-ce
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

Many common applications are already pre-built for ARM, and you can find the list of [official arm32v7 images on Docker Hub](https://hub.docker.com/r/arm32v7); however, this is still a fraction of the number of images available for the x86_64 architecture.

## Installing Docker Compose

In this last step we're installing Docker Compose.

The official installation method for Linux, as in the Docker documentation, points users to the GitHub downloads page, which however does not offer pre-built binaries for the ARM architecture.

Luckily, we can still easily install Docker Compose from pip:

````sh
# Install required packages
apt update
apt install -y python python-pip

# Install Docker Compose from pip
pip install docker-compose
````

With this, you now have a complete Raspberry Pi mini-server running Docker and ready to accept your containers.


<small>*Cover photo by Lucky Heath ([Unsplash](https://unsplash.com/@capturebylucy))*</small>