---
title: "Solving FreeNAS jails on a dedicated NIC"
description: "A simple, working solution for jails in different VLANs, or just with dedicated IPs"
date: 2017-09-17 15:42:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
comments: yes
coverImage:
  author: "Nick Hillier"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@nhillier"
resourceBundle: freenas-jails
---

I have been using FreeNAS as my main NAS system for many months, running in a virtualized environment ([*Yes, you can virtualize FreeNAS*](http://www.freenas.org/blog/yes-you-can-virtualize-freenas/)) with multiple HDDs and SSDs. One of the nicest features of FreeNAS is the support for FreeBSD jails, which is a container-like technology offering a more lightweight alternative to VMs. Jails are great; however, the FreeNAS interface for creating and managing jails is quite limited in functionality, in particular regarding networking.

Recently I faced a situation in which I needed a jail to be connected to a dedicated network interface, with its own subnet and gateway. In my specific case, this is because I have multiple VLANs, and I needed one of the jails to be in a different VLAN than the FreeNAS host. There could be other situations that require jails to have a dedicated interface, however, and this guide will still be helpful.

This document was tested against FreeNAS 11.0, using the "legacy" UI (not the experimental, Angular-based UI), but it should work also with FreeNAS 9.x.

## My network topology

My network has the following topology:

- `10.1.0.0/16` is the main VLAN, where most clients are.
   - The gateway is `10.1.0.1`, which also serves as DNS server.
   - I needed the jail to be in this VLAN, with static IP `10.1.10.10`.
- `10.2.0.0/16` is the "safe" VLAN.
   - The FreeNAS host is in this VLAN, with IP `10.2.2.1`.
   - The gateway and DNS server for this VLAN is `10.2.0.1`.

## 1. Make sure FreeNAS has an unused network interface

Whether it's a physical NIC or a virtual one, make sure it's connected and ready for FreeNAS to use.

In my case, I attached a new virtual NIC named *vmx2* to the FreeNAS VM, and placed it into the "main" VLAN (the primary NIC for FreeNAS is in the "safe" VLAN).

It's important that you do **not** configure the new interface for FreeNAS to use. Since this is dedicated to the jail, we do not want any FreeNAS service to be bound to that, so do not enable it in the "Network / Interfaces" section of the FreeNAS web UI.

## 2. Create a new jail

Using the FreeNAS web interface, create a new FreeBSD jail in the usual way. Click on "Advanced mode", then configure the jail with:

1. Give the jail a name, for example *MyJail*.
2. Configure a static IPv4, without using DHCP. In my case, this was `10.1.10.10/16`. Beside setting up the address and subnet mask, I left all other IPv4-related options empty, and I did not configure IPv6.
3. Enable VIMAGE, but do not enable NAT.

Once the jail is created, it will be started automatically, so stop it using the FreeNAS web UI (select the jail, then press on the red "semaphore" below the list).

## 3. Configure the jail to use the secondary NIC

The next step requires connecting to the FreeNAS host via SSH, as root.

Navigate to the folder containing the "jail root", which can be seen in the FreeNAS web UI in the Configuration tab inside the Jails section. In my case, this was `/mnt/vhd1/jail`.

````sh
# This is probably different on your system - check the correct jail root
$ cd /mnt/vhd1/jails
````

Inside the jail root you can see the folder containing the filesystem for the jail, plus the "meta" folder, which contains its configuration. Navigate to the "meta" folder for the jail, in my case *.MyJail.meta*:

````sh
$ ls -al
drwxr-xr-x  10 root  wheel  10 Sep 17 21:21 .
drwxr-xr-x   3 root  wheel   3 Jun 11 05:13 ..
drwxrwxrwx   2 root  wheel  17 Sep 17 21:21 .MyJail.meta
drwxrwxrwx   5 root  wheel   5 Jun 11 05:40 .warden-files-cache
drwxr-xr-x  17 root  wheel  21 Jun 11 05:40 .warden-template-standard
drwxr-xr-x  17 root  wheel  21 Jun 11 05:40 MyJail

$ cd .MyJail.meta
````

Now we need to configure the jail to use the secondary NIC. Because the NIC is on another VLAN, we also need to change the configuration for the default gateway the jail uses. In the "meta" folder, execute:

````sh
# Set the jail to use the secondary NIC, which is vmx2 in my case
$ echo "vmx2" > iface

# Configure the default gateway in the new subnet; replace with the IP of your gateway
$ echo "10.1.0.1" > defaultrouter-ipv4
````

At this point, you're ready to start the jail:

````sh
$ warden start MyJail
````

**Important:** After changing the configuration of the jail by modifying the files directly via SSH, do not make changes to the jail using the FreeNAS web UI, or our networking setup will be overwritten!

## 4. DNS configuration (Optional)

By default, the jail will inherit the DNS server of the FreeNAS host. If, like in my case, this is not accessible from the VLAN of the jail, we need to change the DNS configuraton too.

From the FreeNAS host, open a terminal inside the jail:

````sh
$ jexec MyJail csh
````

Edit then the file `/etc/resolv.conf`, specifying the correct DNS server; for example:

````sh
$ echo "nameserver 10.1.0.1" > /etc/resolv.conf
````
