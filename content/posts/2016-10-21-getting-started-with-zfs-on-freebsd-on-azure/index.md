---
title: "Getting started with ZFS on FreeBSD on Azure"
description: "Enterprise-class storage for your data disks, with optional encryption"
date: 2016-10-21 19:04:00
author: "Alessandro Segala"
image: "img/zfs.jpg"
comments: yes
authorTwitter: "@ItalyPaleAle"
coverImage:
  author: "William Warby"
  linkName: "Flickr"
  linkURL: "https://flic.kr/p/iNmvEe"
  license: "CC BY"
---

As of [last June](https://azure.microsoft.com/en-us/blog/freebsd-now-available-in-azure-marketplace/) FreeBSD is officially supported on Azure and available on the Marketplace, so everyone can simply launch a FreeBSD 10.3 (as of writing) VM in a few clicks and play with the OS. Obviously, I couldn't miss the chance to test one of the most appreciated features of FreeBSD.

The ZFS filesystem, which was originally created by Sun Microsystem for Solaris and later open-sourced, has a lot of great features that make it perfect for servers. In particular, it is designed to protect data integrity and has built-in support for snapshots, replication, compression and deduplication, and much more. ZFS has a lot of supporters — and for [good reasons](http://www.enterprisestorageforum.com/technology/features/article.php/3849556/10-Reasons-Why-ZFS-Rocks.htm) — and can be used to provide storage for **anything where losing data would be incovenient**: from document repositories to transactional databases.

FreeBSD has supported ZFS since the release 7.0, and its implementation is really mature, making it the best free and open source OS to use this filesystem. Beside Oracle Solaris (which is now closed-source) and forks of OpenSolaris such as OpenIndiana, there are community efforts to bring ZFS to Linux (see the *ZFS on Linux* project, now considered production-ready) and macOS (*OpenZFS on OS X*) too.

## Create a FreeBSD 10.3 VM on Azure

To start, launch a FreeBSD 10.3 VM, directly from the [Azure Marketplace](https://azure.microsoft.com/en-us/marketplace/partners/microsoft/freebsd103/). The configuration process is essentially identical to a Linux VM, and once the server is up you can connect to it using SSH.

In order to have storage space for the ZFS volume, once the VM is running we can attach some data disks to it; the [official documentation](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-linux-attach-disk-portal/) does an excellent job at explaining how to do that. Add as many 1,023GB disks as you want and can (the rule of thumb is that a VM supports two data disks for each CPU core), remembering that using Standard Storage (HDD-based) on Azure you are charged only for the amount of space actually consumed, regardless of how much is provisioned.

> **Tip:** If you are aiming for performance, make sure to select a VM with plenty of RAM. Even when deduplication is disabled (more on that in the *Configuring the dataset* section below), ZFS loves memory and can leverage it for ARC caching and for storing metadata. The FreeBSD documentation suggests that automatic tuning algorithms work best in systems with at least 2 GB of RAM, but by default ZFS will use all availabile memory minus 1 GB for caching, so the more, the merrier. You can read more about caching options in the section below. 

> **Note:** The FreeBSD 10.3 image on the Azure Marketplace, which comes tested and certified by Microsoft, has built-in support for ZFS, but is using a more traditional UFS filesystem for the OS disk. Moving the root filesystem to ZFS is possible, yet not easy, and if you're looking at leveraging ZFS also for the OS disk I'd recommend instead creating your own VHD image locally with a fresh install of FreeBSD, then uploading that to Azure as template. In this article, we'll be using ZFS for data disks only.

In the examples in this article we'll be using a VM with two data disks attached. In total, the VM will have four disks:

- **`/dev/da0`** is the OS disk, where FreeBSD is installed; we won't touch this.
- **`/dev/da1`** is the temporary disk that is directly attached to the VM. For most Azure VMs (excluding A-series), this is SSD-based, so it's great for caching (more on that later).
- **`/dev/da2`** is the first data disk, with a maximum size of 1,023 GB (~1 TB)
- **`/dev/da3`** is the second data disk, with a maximum size of 1,023 GB (~1 TB)

When attaching data disks to the Azure VM for use with ZFS, it's important to ensure that the **host caching is set to None**, as that will conflict with ZFS caching.

## ZFS concepts and terminology

Administrators that are used to creating RAID arrays, volume groups and filesystems on Linux/UNIX might find ZFS a little bit confusing at first, as ZFS is doing all those tasks and more. All the relevant concepts and terminology are clearly explained in the [FreeBSD documentation](https://www.freebsd.org/doc/handbook/zfs-term.html), but I'd like to particularly call out three of them:

- A **vdev** is a Virtual DEVice, and it is made by one or more disks, partitions, files (used as virtual disks) or other vdevs. When multiple disks/vdevs are combined, data is striped across them (in a way similar to RAID-0), and you have the options to enable mirroring (similar to RAID-1) or striping with parity (called RAIDZ, it uses one to three parity blocks and it's conceptually similar to RAID-5, RAID-6 and the non-existing "RAID-7" respectively). Please note that vdevs are immutable: that is, you cannot add more disks to an existing vdev.
- A **zpool** (ZFS pool) is made by vdevs, and it's the main building block of ZFS. A zpool has a name and contains datasets and volumes (see below).
- A **dataset** is a "filesystem" under a ZFS pool, that can be used to read and write data.

When working with ZFS, we will treat our data disks as single vdevs and combine them into a zpool. Each zpool has a name, for example `tank`, and automatically creates a root dataset with the same name. You can add more datasets in the same pool, hierarchically: for example, `tank/shared` is a child of `tank`, from wich it inherits all properties. You can expand it further by creating a dataset named `tank/shared/photos`, etc.

## Our first ZFS dataset

For the first configuration, we're following the simplest possible one, with the two data disks configured in a striped array (in traditional RAID terminology, that would be the same as RAID-0).

> **Note:** Unlike what is required in any traditional IT environment, on Azure you do not need to use mirroring or striping with parity, and that applies to ZFS as well. Indeed, all VM disks are backed by Azure Blob Storage, which is already replicated 3 times and offers enough protection against disk failure.

Open a terminal as superuser (*root*) and start the ZFS service:

````bash
# Enable starting of ZFS at boot
echo 'zfs_enable="YES"' >> /etc/rc.conf

# Start the service
service zfs start
````

Create then the first ZFS pool (zpool) named `tank` on the two data disks (`/dev/da2` and `/dev/da3`):

````bash
zpool create tank /dev/da2 /dev/da3
````

...and that's it! The command should complete almost instantly and you'll have your zpool `tank` created and configured to stripe across multiple disks. You can check the status with `zpool status`:

````bash
$ zpool status
  pool: tank
 state: ONLINE
  scan: none requested
config:

	NAME        STATE     READ WRITE CKSUM
	tank        ONLINE       0     0     0
	  da2       ONLINE       0     0     0
	  da3       ONLINE       0     0     0

errors: No known data errors
````

When creating the zpool `tank`, we also get a root dataset with the same name, which is automatically mounted at boot in `/tank` (no need to modify `/etc/fstab`). You can check that with the `zfs list` command:

````bash
$ zfs list
NAME   USED  AVAIL  REFER  MOUNTPOINT
tank  68.5K  1.92T    19K  /tank
````

Let's create a child dataset of `tank` to store our shared files, and then specifically two sub-datasets for documents and photos:

````bash
$ zfs create tank/shared
$ zfs create tank/shared/documents
$ zfs create tank/shared/photos   

$ zfs list
NAME                    USED  AVAIL  REFER  MOUNTPOINT
tank                    134K  1.92T    19K  /tank
tank/shared              57K  1.92T    19K  /tank/shared
tank/shared/documents    19K  1.92T    19K  /tank/shared/documents
tank/shared/photos       19K  1.92T    19K  /tank/shared/photos

$ tree /tank
/tank
`-- shared
    |-- documents
    `-- photos

3 directories, 0 files
````

You can see that our datasets for documents and photos are automatically mounted in `/tank/shared/documents` and `/tank/shared/photos` respectively. The "USED" column represents how much storage the dataset is using, and "AVAIL" is the free space. Interestingly, unlike traditional filesystems which have to be confined within their own partitions, ZFS datasets are not fixed in size by default and are much more flexible.

## Configuring the datasets

ZFS datasets are highly configurable, and as mentioned before properties are inherited by child datasets by default (but each child can overwrite them). Properties can be set on datasets at any time, but it's recommended to set them during creation (use the `-o` switch on the `zpool create` command) or immediately after, before writing any data.

````bash
# Set properties while creating the pool
zpool create -o option=value dataset vdevs

# Example
zpool create -o compression=lz4 tank /dev/da2 /dev/da3

# Setting options - command syntax
zfs set option=value dataset

# Example
zfs set compression=lz4 tank/shared

# Multiple properties can be combined
zfs set compression=lz4 atime=off tank/shared
````

You can get a full list of configuration properties on the man page for the *zfs* command (`$ man zfs`); I'm going to list only a few interesting ones. 

- **`compression`** enables on-the-fly compression of data written to disk. Values can be `off`, `on` (use default algorithm) or an explicit algorithm such as `lz4` and `gzip`. Compression is one of the nicest features of ZFS and it's highly recommended for every scenario, unless the data you're storing is already highly compressed (e.g. JPEG photos, videos, etc). Although compression requires some extra CPU processing while reading or writing data, disk I/O is usually a bigger bottleneck than CPU speed, so enabling compression can improve read/write throughput sensibly in almost every situation. In terms of which algorithm to use, `gzip` gives the best compression results, but `lz4` is generally preferred by administrators as it's very light on the CPU and has the best overall cost/benefit ratio.
- **`atime`**, `on` by default, enables recording on disk the access time of files and documents. As this has an impact on performance, *atime* is often turned `off` when not necessary.
- **`quota`**, which defaults to `none`, can be used to limit the size of the dataset, for example to `10G`.
- **`reservation`** is often used together with *quota*. While *quota* sets a maximum size for the dataset, it does not prevent other datasets in the same zpool to fill all the space available. When setting a value to the *reservation* parameter, such as `10G`, ZFS is essentially "taking space away" in the zpool so no other dataset can use it.

Let's set some options for our datasets:

````bash
# Turn compression on on our "tank/shared" dataset, disable atime recording for performance
# and set a maximum size of 100 GB
zfs set compression=lz4 atime=off quota=100G tank/shared

# As the "tank/shared/photos" dataset contains mostly JPEG files, which are already heavily
# compressed, there's no need for ZFS to spend time trying to reduce thefile size even
# further, so let's overwrite the inherited property
zfs set compression=off tank/shared/photos
````

One last option, **`deduplication`**, is one one of the most interesting features of ZFS, but it should be used with caution. Deduplication comes at a high cost, as it requires a lot of memory to store the deduplication table: it's recommended to have 5 GB of RAM for every 1 TB of data stored. Deduplication can help saving disk space when the data contains lots of duplicated blocks, for example when ZFS is used on a SAN for VM hard disks -  something that will never happen on Azure! In most scenarios users are much better off relying on compression (for example with lz4, which has barely any impact on the CPU) than enabling deduplication. In any case, if you want to understand more about deduplication and how to enable it on ZFS, I'd suggest reading [this blog post](https://blogs.oracle.com/bonwick/entry/zfs_dedup) on the Oracle website.

## Caching

With ZFS you can leverage two different kinds of disk cache to improve the I/O performance. At a very high level, those are **L2ARC** for read cache (in addition to "level 1" ARC cache, which is kept in RAM) and **SLOG** (the *separate intent log*) to speed up synchronous write calls. In both cases, you should use fast SSD-based storage for the cache.

### L2ARC

The L2ARC cache is used to store data that is read from the filesystem, and acts as a second tier after the data cached in the RAM (ARC). L2ARC is a great use case for the temporary SSD drives that come with Azure VMs: these disks are directly attached to the host server, so they offer the smallest latency possible, and in most VMs (excluding only A-series ones) they are based on fast solid-state disks. As they're temporary disks, their contents might be lost at any time if the host servers crashes or when the VM is stopped from the Azure Portal or resized. Since the L2ARC is read-only, it doesn't matter if the data inside it is lost, however.

Enabling L2ARC on the local SSD (`/dev/da1`) is really easy. To start, we need to make sure that the Azure Agent (which is installed by default on FreeBSD images deployed from the Azure Marketplace) isn't mounting the temporary disk automatically: edit the file `/etc/waagent.conf` and set the following parameter to `n`:

````conf
ResourceDisk.Format=n
````

Next, restart the Azure Agent (*waagent*) and then unmount the temporary disk if it's mounted:

````bash
service waagent restart
umount /dev/da1s1
````

Lastly, add the `/dev/da1` geom as L2ARC for the `tank` zpool:

````bash
zpool add tank cache /dev/da1
````

You can check the status with:

````bash
$ zpool list -v
NAME         SIZE  ALLOC   FREE  EXPANDSZ   FRAG    CAP  DEDUP  HEALTH  ALTROOT
tank        1.98T   751M  1.98T         -     0%     0%  1.00x  ONLINE  -
  da2       1016G   375M  1016G         -     0%     0%
  da3       1016G   376M  1016G         -     0%     0%
cache           -      -      -         -      -      -
  da1       8.00G   343M  7.66G         -     0%     4%
````

> **Note:** if you shut down the VM from the Azure Portal or resize it, or in the unlikely event that the host server crashes, the contents of the temporary disk are lost forever. In these situations, when the VM goes back online the zpool will still reference an offline disk as L2ARC, and thus the cache will be disabled (however, the system will continue to function normally).
> Administrators can remove the old cache disk with a command similar to `$ zpool remove tank 012345` (where `012345` is the ID of the disk), and they can repeat the commands above to enable the L2ARC again.
> Remember that it's also always possible to use Premium Storage disks for L2ARC (P30 recommended to get 5,000 IOPS), if you want persistent volumes.

### SLOG

The purpose of the SLOG is to make synchronous write calls faster by first caching them on high-performance SSD drives and then committing data into the final storage. The SLOG is essentially a separate storage for the ZIL (ZFS Intent Log), which is otherwise kept on the same disks as the data.

Unlike the L2ARC, the SLOG must not be put on the temporary, local disks, or system crashes might cause a loss of data. Persistent, SSD-based storage, such as Premium Storage, should be used instead to guarantee data integrity.

You can use one or more disks for the SLOG, and ZFS will stripe across them. Although one disk is enough, in this example we're adding two more P30 disks to the Azure VM to use as SLOG, `/dev/da4` and `/dev/da5`, to double the IOPS. When attaching the disks using the Azure Portal, make sure you select Premium Storage (SSD) disks and disable Host Caching.

When the disks are attached, attach them as log devices for the `tank` zpool with:

````bash
zpool add tank log /dev/da4 /dev/da5
````

The results can be checked in the usual way:

````bash
$ zpool list -v
NAME         SIZE  ALLOC   FREE  EXPANDSZ   FRAG    CAP  DEDUP  HEALTH  ALTROOT
tank        1.98T   751M  1.98T         -     0%     0%  1.00x  ONLINE  -
  da2       1016G   375M  1016G         -     0%     0%
  da3       1016G   376M  1016G         -     0%     0%
log             -      -      -         -      -      -
  da4        127G      0   127G         -     0%     0%
  da5        127G      0   127G         -     0%     0%
cache           -      -      -         -      -      -
  da1       8.00G   350M  7.65G         -     0%     4%
````

> **Tip:** on Azure, it's not necessary to mirror the contents of the SLOG as data is already replicated three times by Azure Storage on the backend.

## Encryption

One of the nicest features of ZFS on Oracle Solaris is the support for built-in encryption. Sadly, however, that was added after Oracle closed the source of ZFS again, so the OpenZFS implementation that FreeBSD uses does not support encryption out of the box. There's a lot of interest around this feature and the community is hard at work on implementing it – however, it's far from an easy task and encryption isn't likely to appear too soon. For the time being, ZFS users on FreeBSD (and Linux, macOS, etc) need to encrypt the underlying disks and then create a ZFS filesystem on top.

In this example we'll be using the same Azure VM as before, with two data disks on `/dev/da2` and `/dev/da3`.

Before turning on encryption, we need to generate a new key. In this example, we'll be using a keyfile stored on the OS disk – unencrypted. In a production environment this might not be acceptable, and you may want to leverage services such as [Azure Key Vault](https://azure.microsoft.com/en-us/services/key-vault/) to store your key instead. Execute the following commands to generate a new key and save it in `/root/data01.key` (and make a backup copy of it!).

````bash
openssl rand 512 > /root/data01.key
chmod 0400 /root/data01.key
````

> **Tip:** If the virtual machine supports the AES-NI extension we can leverage hardware-accelerated encryption by loading the proper kernel module. On Azure, most VMs are running on Intel CPUs that support AES-NI; only A-series VMs may sometimes run on AMD chips that do not have hardware acceleration for encryption.
>
````sh
# (If using A-series VMs)
# Check the CPU model and manufacturer; if not made by Intel, stop here
sysctl hw.model
# Example: "hw.model: Intel(R) Xeon(R) CPU E5-2673 v3 @ 2.40GHz"

# If the CPU supports AES-NI instructions
kldload aesni
echo 'aesni_load="YES"' >> /boot/loader.conf
````
>

We're now ready to encrypt our disks:

````sh
# Load the geli kernel module
kldload geom_eli
echo 'geom_eli_load="YES"' >> /boot/loader.conf

# Initialize the encrypted geli disks, using:
# - 256-bit key
# - AES-XTS
# Use the key in /root/data01.key without a passphrase
# Encrypt both /dev/da2 and /dev/da3
geli init -l 256 -e "AES-XTS" -K /root/data01.key -P /dev/da2
geli init -l 256 -e "AES-XTS" -K /root/data01.key -P /dev/da3

# After geli is initialized, ensure you have a backup copy of these files:
# /var/backups/da2.eli
# /var/backups/da3.eli

# Attach the providers (ie. disks) using the keyfile
# These will create /dev/da[2,3].eli
geli attach -k /root/data01.key -p /dev/da2
geli attach -k /root/data01.key -p /dev/da3

# Write some data in the encrypted devices
# This is necessary or the zpool creation will fail
dd if=/dev/random of=/dev/da2.eli bs=1m count=10
dd if=/dev/random of=/dev/da3.eli bs=1m count=10 
````

Ensure the partition is decrypted automatically at boot, by adding the following lines to `/etc/rc.conf`:

````conf
geli_devices="da2 da3"
geli_da2_flags="-k /root/data01.key -p"
geli_da3_flags="-k /root/data01.key -p"
````

Finally, create a zpool named `tank` in the new encrypted volume:

````bash
# Enable ZFS and start it at boot
$ echo 'zfs_enable="YES"' >> /etc/rc.conf
$ service zfs start

# Create the zpool on the encrypted disks
$ zpool create tank /dev/da2.eli /dev/da3.eli

# Check results
$ zpool list -v
NAME         SIZE  ALLOC   FREE  EXPANDSZ   FRAG    CAP  DEDUP  HEALTH  ALTROOT
tank        1.98T    62K  1.98T         -     0%     0%  1.00x  ONLINE  -
  da2.eli   1016G    24K  1016G         -     0%     0%
  da3.eli   1016G    38K  1016G         -     0%     0%
````

We now have a zpool that is ready to accept new ZFS datasets, like in the examples in the previous sections.
