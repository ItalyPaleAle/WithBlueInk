---
title: "What I learnt from using WD Red disks to build a home NAS"
description: "Some important tips to make your drives last longer — and how to spin them down automatically on Linux"
date: 2016-07-15 17:02:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
comments: yes
coverImage:
  author: "Scott Schiller"
  linkName: "Flickr"
  linkURL: "https://flic.kr/p/buWBL3"
  license: "CC BY"
resourceBundle: wd-red
---

I know, this blog was supposed to be about the cloud, but in fifth post I'm taking a break from writing about that! Instead, I'd like to share a couple of learnings I got from another project I've been working on.

A few months ago I've sold my Synology NAS that I was using in my home, and I've decided to build something myself. The reasons are simple: my two-bay ARM-based DiskStation was getting old and was not powerful enough, plus I wanted something I could run virtual machines and containers on. I've kept the two WD Red 3TB disks, added a third one of the same kind, and built a Linux-based NAS myself, purchasing all the parts separately. Unexpectedly, the components that gave me the biggest headaches were the hard drives.

Turns out that, while WD Red disks are great for NAS usage (and they've been designed for that!), there are a couple of things you may want to keep in mind.

## First: watch out for a bug that may shorten your disks' life

Western Digital implemented in the WD Red the IntelliPark feature, the same one that was first shipped on the Green series and around which a lot of people expressed doubts. With IntelliPark, the disks can position the read/write heads in a parked position, unloaded. This was meant to reduce power consumption, however it was originally set in a very aggressive way (with a timeout of just 8 seconds), and under certain circumstances the disks would constantly switch in and out of that idle state. That is not uncommon on a NAS, especially if based on Linux, where the system wakes the disks every 10-20 seconds to write logs, to collect offline SMART status (which triggers the heads out of their parked position) or for other reasons.

The issue above has been patched in more recent units. However, as a consequence of this buggy firmware, on the two WD Red disks that I recycled from my previous NAS, the *Load Cycle Count* was quite high:

````bash
# New drive (2 month old - NASWare 3.0) - tweaked firmware

$ smartctl -a /dev/sda | grep "^193"
193 Load_Cycle_Count        0x0032   200   200   000    Old_age   Always       -       387

# Older drives (8 months old - NASWare 3.0) - un-tweaked firmware

$ smartctl -a /dev/sdc | grep "^193"
193 Load_Cycle_Count        0x0032   198   198   000    Old_age   Always       -       7070

$ smartctl -a /dev/sdd | grep "^193"
193 Load_Cycle_Count        0x0032   198   198   000    Old_age   Always       -       7086 
````

A high LCC can shorten the lifespan of your drives. Even though WD [certifies](http://www.wdc.com/wdproducts/library/SpecSheet/ENG/2879-800002.pdf) drives in the Red series to last at least 600,000 load cycles (in controlled environments), consider that the disks above were used in a home NAS, where they spent approximately two-thirds of the time in standby.

As you can see from my data above, the newer drive shipped with a firmware already tweaked to fix the issue. However, if your drives are older (or you just purchased a unit that had been stocked for a while), do not despair: there is a quick and easy fix! Acknowledging the issue, WD released a [simple utility](http://supportdownloads.wdc.com/downloads.aspx?DL) to alter the behaviour of the firmware, and wait longer before unloading the heads.

### Fix your WD Red drives on Windows

1. Download the [wd5741.exe utility](http://download.wdc.com/sata/wd5741.exe).
2. Open a command line window with administrator privileges, then navigate to the folder in which the utility was downloaded
3. Execute one of the following commands:

````sh
# Show help menu
wd5741.exe -?

# List all drives
wd5741.exe -D?

# Update a specific drive (replace # with drive number)
wd5741.exe -D#

# Update all supported (and not already patched) drives:
wd5741.exe -Dall
````

### Fix your WD Red drives on Linux (64-bit)

Execute the following commands to download the utility:

````bash
curl -L -o wd5741x64 http://download.wdc.com/sata/wd5741x64?v=2916
chmod +x ./wd5741x64
````

Then use the following commands to update your drives:

````bash
# Show help menu
./wd5741x64 -?
    
# List all drives
./wd5741x64 -D?
    
# Update a specific drive (replace # with drive number)
./wd5741x64 -D#
    
# Update all supported (and not already patched) drives:
./wd5741x64 -Dall
````

### Fix your WD Red drives on Linux (32-bit)

Execute the following commands to download the utility:

````bash
curl -L -o wd5741x32 http://download.wdc.com/sata/wd5741x32?v=2916
chmod +x ./wd5741x32
````

Then use the following commands to update your drives:

````bash
# Show help menu
./wd5741x32 -?
    
# List all drives
./wd5741x32 -D?
    
# Update a specific drive (replace # with drive number)
./wd5741x32 -D#
    
# Update all supported (and not already patched) drives:
./wd5741x32 -Dall
````

## Second: get your WD Red drives to go in standby with hd-idle

WD Red drives are optimized for NAS usage, which means they're designed to run reliably 24/7 and tune power consumption dynamically, and for this reason they do not include a standby function. This is not a bad idea *per se*: as everyone can tell you, spinning disks up and down constantly is bad for their health.  Many home NAS servers, however, are used for a few hours a day only, and stay completely inactive for the rest of the time. In this case, it would probably be safe to spin the disks down and save power (and the environment will thank you!).

On Linux, the traditional way to control disk standby (and power management) is to use hdparm; however, **hdparm will not work with WD Red drives**, because the firmware of the disks doesn't support that. Instead, we can use the third-party **hd-idle** utility to accomplish this.

You can download hd-idle from [Sourceforge](http://hd-idle.sourceforge.net/). Sadly, as of writing not many Linux distributions offer it pre-packaged, so you will probably have to download the source code and then compile it (instructions are in the website linked). Once hd-idle is installed in `/usr/local/sbin` (default path when you do `make && sudo make install`), you can run it as a service. On CentOS 7, Ubuntu 15.04 and newer, and pretty much any other Linux distribution that uses systemd, you can create the following unit in `/etc/systemd/system/hd-idle.service` (be sure to tune the configuration for your disks, *sda* and *sdb* in the example!):

````systemd
[Unit]
Description=hd-idle daemon

[Service]
Type=simple
Restart=always
RestartSec=10

ExecStartPre=-/usr/bin/killall hd-idle

# Set disk spin-down time to:
# 1800 seconds (30 minutes) for sda
# 1200 seconds (20 minutes) for sdb
# 0 (no spin-down) for other disks
# See documentation at http://hd-idle.sourceforge.net/
# Note the "-d" flag to ensure that hd-idle remains in foreground 
# and can be managed by systemd
ExecStart=/usr/local/sbin/hd-idle -d -i 0 -a sda -i 1800 -a sdb -i 1200 

ExecStop=/usr/bin/killall hd-idle

[Install]
WantedBy=multi-user.target
````

Save the file, then enable the service with:

````bash
# Enable at boot
systemctl enable hd-idle
    
# Start the service
systemctl start hd-idle
````

Your WD Red disks will then finally spin down, saving power.
