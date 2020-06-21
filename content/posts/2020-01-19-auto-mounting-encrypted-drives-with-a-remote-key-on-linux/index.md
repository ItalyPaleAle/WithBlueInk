---
title: Auto-mounting encrypted drives with a remote key on Linux
description: Using dm-crypt and auto-mounting a drive without storing the key on the local disk
date: 2020-01-19 00:00:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
image: "img/mount.jpg"
comments: yes
coverImage:
  author: "adrian"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@aows"
---

I've been building a simple NAS for my home, and I wanted to store the data on a secondary disk, encrypted with dm-crypt/LUKS. There are plenty of articles on how to do that, but when it comes to automatically mounting the disk at boot, all of them recommend writing the encryption key in a keyfile and store it on the local filesystem.

This approach wasn't acceptable to me: while the data would be encrypted at rest, the key to open the encrypted partition would also be sitting in the same place. If someone were to steal the physical server (imagine this were a small Raspberry Pi!), they would have access to the data without any issue.

How could I have the LUKS encryption key stored in a secure, remote place, while at the same time being able to have the encrypted disk automatically mounted without manual intervention (e.g. in case of a reboot after a power outage)? In other words, how to have your cake and eat it too.

Turns out, there's a relatively simple solution, which requires just two systemd units.

> Note: this approach can not be used with encrypted root volumes, but only with secondary disks.

## Step 1: Generate and store the keyfile

The first thing we need to do is to generate a keyfile. This should be 256-bytes long, and can be generated with:

````sh
dd bs=256 count=1 if=/dev/random | base64 > keyfile
````

I'm piping the encryption key through base64 so we don't have to deal with binary files, making things more manageable.

You will then need to store the keyfile somewhere safe. You can pick and choose any place you'd like; some ideas include:

- A key vault like [Azure Key Vault](https://docs.microsoft.com/en-us/azure/key-vault/key-vault-overview)
- HTTPS servers, including object storage services such as AWS S3 or Azure Blob Storage; make sure you're using TLS to protect the data while in transit, rather than basic HTTP

For a simple (but effective enough) solution, you can store the keyfile in Azure Blob Storage. You can see an example of doing this in the _Appendix_ below.

## Step 2: Create a script returning the keyfile

You will need to create a script that can return the keyfile when invoked, stored as `/etc/luks/key.sh`

The content of the script completely depends on how and where you stored your keyfile. Following up on the example in the _Appendix_, with a keyfile stored on Azure Blob Storage, the script would look like this:

````sh
#!/bin/sh
set -e
# Request the file from Azure Blob Storage using the URL with the SAS token, then pipe it through `base64 -d` to decode it from base64
curl -s "https://ln5bxfzbl0tlf5z.blob.core.windows.net/keyfiles/keyfile?se=2022-01-19T23%3A02Z&sp=r&spr=https&sv=2018-11-09&sr=b&sig=gkaN2OSzN2zj1WSAPiLJMgtkcXLi2Y8EOVdBUmZQh88%3D" | base64 -d
````

Whatever the content of your script (which could be a shell script or written in any other language), it's important then to make it executable and readable by the `root` user only:

````sh
# Ensure the owner of this file is "root"
chown root:root /etc/luks/key.sh
# Allow only the owner (root) to read and execute the script
chmod 0500 /etc/luks/key.sh
````

## Step 3: Encrypt the disk using LUKS

We're now ready to get to the fun part, and encrypt the disk or partition.

To start, check the name of the disk you want to use, using `lsblk`:

````sh
$ lsblk
NAME    MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
sda       8:0    0   30G  0 disk
├─sda1    8:1    0 29.9G  0 part /
├─sda14   8:14   0    4M  0 part
└─sda15   8:15   0  106M  0 part /boot/efi
sdb       8:16   0    4G  0 disk
└─sdb1    8:17   0    4G  0 part /mnt
sdc       8:32   0   32G  0 disk
````

In this example, I'm going to use the **`sdc`** disk. This is likely going to be different for you, so make sure you replace the disk name in all the commands below.

> Watch out! The commands below will **delete all files** on the drive you select.

Before we start, install the `cryptsetup` utility:

````sh
# Debian, Ubuntu, Raspbian…
apt install -y cryptsetup

# CentOS, Fedora, RedHat
yum install -y cryptsetup-luks
````

First, if your disk doesn't have a partition yet (like mine), create a GPT partition table and a partition (without formatting it):

````sh
# Replace sdc with the drive you want to use
parted /dev/sdc mklabel gpt
parted -a opt /dev/sdc mkpart datadisk ext4 0% 100%
````

Encrypt the `sdc1` partition using LUKS, create an ext4 volume in that partition, and then close the encrypted volume. In all commands that require a keyfile, we're invoking the `/etc/luks/key.sh` script that we created before, and telling `cryptsetup` to read the keyfile from stdin.

````sh
# Encrypt the disk
# Replace sdc1 with the correct partition!
/etc/luks/key.sh | cryptsetup -d - -v luksFormat /dev/sdc1

# Open the encrypted volume, with the name "data"
# Replace sdc1 with the correct partition!
/etc/luks/key.sh | cryptsetup -d - -v luksOpen /dev/sdc1 data

# Create a filesystem on the encrypted volume
mkfs.ext4 -F /dev/mapper/data

# Close the encrypted volume
cryptsetup -v luksClose data
````

## Step 4: Enable auto-mounting the encrypted disk

We're almost done: ready to enable auto-mounting of the encrypted disk.

We'll do that with two systemd units: one unlocking the encrypted device, and the other one actually mounting the disk.

To start, get the UUID of the `/dev/sdc1` partition, using `lsblk --fs`. For example:

````sh
$ lsblk --fs
NAME    FSTYPE      LABEL           UUID                                 MOUNTPOINT
[...]
sdc
└─sdc1  crypto_LUKS                 a17db19d-5037-4cbb-b50b-c85e3e074864
````

In my example, that is `a17db19d-5037-4cbb-b50b-c85e3e074864`; it will be different for you.

Create a systemd unit for unlocking the encrypted device and save it as **`/etc/systemd/system/unlock-data.service`**. Make sure you replace the UUID in the command below!

````text
[Unit]
Description=Open encrypted data volume
After=network-online.target
Wants=network-online.target
StopWhenUnneeded=true

[Service]
Type=oneshot
ExecStart=/bin/sh -c '/etc/luks/key.sh | /sbin/cryptsetup -d - -v luksOpen /dev/disk/by-uuid/a17db19d-5037-4cbb-b50b-c85e3e074864 data'
RemainAfterExit=true
ExecStop=/sbin/cryptsetup -d - -v luksClose data
````

> Note the `StopWhenUnneeded=true` line: this will make systemd stop the unit (including running the `luksClose` operation) automatically when the disk is unmounted.

Create another systemd unit with the mountpoint for `/mnt/data`, and save it as **`/etc/systemd/system/mnt-data.mount`**. Note that the unit's name must match the path of the mountpoint!

````text
[Unit]
Requires=unlock-data.service
After=unlock-data.service

[Mount]
What=/dev/mapper/data
Where=/mnt/data
Type=ext4
Options=defaults,noatime

[Install]
WantedBy=multi-user.target
````

We're now ready, let's enable the `mnt-data.mount` unit so it's activated at boot, and then mount it right away:

````sh
systemctl enable mnt-data.mount
systemctl start mnt-data.mount
````

You can now check with `lsblk` to see the encrypted disk mounted:

````sh
$ lsblk
NAME     MAJ:MIN RM  SIZE RO TYPE  MOUNTPOINT
[...]
sdc        8:32   0   32G  0 disk
└─sdc1     8:33   0   32G  0 part
  └─data 253:0    0   32G  0 crypt /mnt/data
````

Try rebooting the system, and you'll see the partition being mounted automatically.

We're done! However, keep in mind a few things:

1. To mount and un-mount the encrypted disk you must use `systemctl` rather than the usual `mount` and `umount` commands. <br/>Mount the disk with **`systemctl start mnt-data.mount`**, and un-mount with **`systemctl stop mnt-data.mount`**
2. The systemd units are executed only after the network and the other "normal" filesystems are mounted. If you have another service depending on the data disk's availability, you need to explicitly make its systemd unit depending on the `mnt-data.mount` unit (with `Requires=mnt-data.mount` and `After=mnt-data.mount`)
3. As mentioned at the beginning, this solution can't be used with the root filesystem, but only with secondary data disks.

## Appendix: Keyfiles on Azure Blob Storage

In this example, I'm storing the keyfile in Azure Blob Storage. While this doesn't offer the same protection as a key vault, it can be enough for most people, depending on your threat model. I'm guaranteeing some level of security by:

1. Configuring the Storage Account to accept only secure connections that use HTTPS
2. Allowing connections only from the IP of my home (I have a "quasi-static" IP, that changes less than once per year)
3. Requiring clients to use a SAS token to download the file

My threat model involves people stealing the disk and/or the server. The attacker wouldn't be able to download the keyfile if they're not in my network. By having the keyfile on a remote server, I can delete it right away if I need to, e.g. if the physical disk is stolen. This protection is enough for me, but depending on your threat model, you might want to look into more complex solutions, for example involving key vaults.

If you're starting from scratch, you can create an Azure Storage Account, configure it per the requirements above, and upload your keyfile with the [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest). You will need an [Azure subscription](https://azure.com/free), which is free and with this kind of usage you'll be comfortably within their free tier.

> This example assumes that you've generated a base64-encoded keyfile available in the `keyfile` file, in the current working directory, just as per _Step 1_ above.

````sh
# Login to Azure if you need to
az login

# Location where to store the keyfile; choose an Azure region close to you
export LOCATION="eastus2"

# If you have a fixed (or almost) IP address, you can restrict access to the storage account from that IP.
# You can also use an IP range in the CIDR format.
# Otherwise, leave this variable as an empty string
export ALLOW_IP="1.2.3.4"

# Generate a random name for the Storage Account
export STORAGE_ACCOUNT_NAME=$(cat /dev/random | base64 | tr -dc 'a-zA-Z0-9' | tr '[:upper:]' '[:lower:]' | fold -w 15 | head -n 1)

# Create a Resource Group and a Storage Account
export RG_NAME="Keyfiles"
az group create --name $RG_NAME --location $LOCATION
az storage account create \
  --name $STORAGE_ACCOUNT_NAME \
  --resource-group $RG_NAME \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

# Require using TLS/HTTPS only
az storage account update \
  --name $STORAGE_ACCOUNT_NAME \
  --https-only true

# Allow from a specific IP only, if the variable ALLOW_IP isn't empty
if [ ! -z "$ALLOW_IP" ]; then
  # Disallow access from anywhere by default
  az storage account update \
    --resource-group $RG_NAME \
    --name $STORAGE_ACCOUNT_NAME \
    --default-action Deny
  # Allow the IP or IP range
  az storage account network-rule add \
    --resource-group $RG_NAME \
    --account-name $STORAGE_ACCOUNT_NAME \
    --ip-address "$ALLOW_IP"
  # Disallow "Trusted Microsoft Services"
  az storage account update \
    --resource-group $RG_NAME \
    --name $STORAGE_ACCOUNT_NAME \
    --bypass None
fi

# Create a blob container
az storage container create \
  --name "keyfiles" \
  --public-access off \
  --account-name $STORAGE_ACCOUNT_NAME

# Upload the key
az storage blob upload \
  --account-name $STORAGE_ACCOUNT_NAME \
  --container-name "keyfiles" \
  --file "./keyfile" \
  --name "keyfile"
````

Now that the file has been uploaded, we can get a link to it. Since the file is in a "private" container, it requires a special authentication token ([SAS token](https://docs.microsoft.com/en-us/azure/storage/common/storage-sas-overview?toc=%2fazure%2fstorage%2fblobs%2ftoc.json)) to be retrieved. SAS tokens add some extra protection thanks to having an expiration date and being tied to an account key, which can be revoked at any time. You can also add additional requirements on the SAS tokens, such as restrictions on IPs; this is a (less ideal) alternative to setting IP restrictions on the Storage Account as shown above.

You can generate a URL with a SAS token for the blob with:

````sh
# Create an expiration date 2 years in the future
# On Linux:
SAS_EXPIRY=$(date -u -d "2 years" '+%Y-%m-%dT%H:%MZ')
# On macOS:
SAS_EXPIRY=$(date -v+2y -u '+%Y-%m-%dT%H:%MZ')

# Generate the URL with the SAS token
az storage blob generate-sas \
  --account-name $STORAGE_ACCOUNT_NAME \
  --container-name "keyfiles" \
  --name "keyfile" \
  --https-only \
  --permissions r \
  --expiry "$SAS_EXPIRY" \
  --full-uri
````

Result will be similar to: `https://ln5bxfzbl0tlf5z.blob.core.windows.net/keyfiles/keyfile?se=2022-01-19T23%3A02Z&sp=r&spr=https&sv=2018-11-09&sr=b&sig=gkaN2OSzN2zj1WSAPiLJMgtkcXLi2Y8EOVdBUmZQh88%3D`

You can use the URL above in the `/etc/luks/key.sh` script, as per _Step 2_.
