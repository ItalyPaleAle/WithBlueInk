---
title: "Stop SSH brute force attempts"
description: "Three effective tips to stop bots that won't harm you in the process"
date: 2016-07-15 19:42:00
author:
  name: "Alessandro Segala"
image: "img/ssh-brute-force.jpg"
comments: yes
---

Every admin has certainly experienced this. You have a Linux server that is directly addressable from the Internet and has SSH installed, and you see your logs full of failed login attempts by bots from all over the world, trying to hack through brute force attacks. Although for most users this should be quite harmless (as long as your password isn't something like "password", of course!), it's still annoying to have your logs full of noise and an increased load on the server.

In this article, I'm collecting three simple techniques that will effectively block bots running brute force attacks while not imposing restrictions on you. For example, a common advice on the web is to limit the range of IPs that can connect to your server via SSH; while this will block un-targeted attacks, it may also prevent admins to connect to the machine for emergency fixes while they're off-site (as we know, servers have a higher probability of failing in the middle of a long weekend when you're out of the country!). 

> **Not using SSH over a public IP?** Many larger organizations allow connections to SSH only through a private IP from within the Virtual Network (requiring admins to go through a VPN, for example). While this will effectively block all bots, the tips in this article may still be relevant to you to implement some [defense in depth](https://www.owasp.org/index.php/Defense_in_depth) strategies.

Without further delay, here are my three tips.

### 1. Use public keys only

This is *A Good Idea™* regardless: disable password-based authentication and use SSH public keys only. Public keys are inherently safer: they're sensibly longer than a password (a typical key is 4096 bit, or 512 bytes/characters) and harder to guess. It can take millions of years for a supercomputer to brute force your key. Chances are bots will give up on the first try, when they see the server supporting only key-based authentication.

If you don't have a public key already, you can generate one in seconds with OpenSSH, which is installed by default on Mac OSX and on most Linux distributions. Windows users can use PuTTYgen ([how-to](https://winscp.net/eng/docs/ui_puttygen)) or install OpenSSH for Windows (there are multiple ways; including an [official one](https://github.com/PowerShell/Win32-OpenSSH/wiki/Install-Win32-OpenSSH)). With OpenSSH, generating a public key is as easy as opening a terminal and executing:

````bash
ssh-keygen -t rsa -b 4096
````

You will be asked where to save your key; if this is your first key, it's probably best to the default location (`~/.ssh/id_rsa`). You will also be asked to type a password to encrypt the private key; while this is optional (you could simply leave the fields empty for no password), it's definitely recommended to set a strong password for your keys. When left unencrypted, an attacker that succeeded at stealing the private key from your laptop would have full access to all of your servers! 

ssh-keygen will generate a private key (`id_rsa` with the default naming) and a public one (`id_rsa.pub`). You can then copy the **public** key to your server, to allow authentication with the key. On the remote machine, the public key goes into `~/.ssh/authorized_keys` (where `~` is the home folder for the user, for example `/home/username` or `/root`). If you have multiple keys, you can add them to the same file, one per line. Remember also to protect your authorized_keys file, by giving it 0600 permissions.

Lastly, you need to configure sshd *on the server* to accept public keys only. This is easily done by editing the sshd configuration file (usually located on `/etc/ssh/sshd_config`, but it may change depending on the Linux distribution in use). Ensure the following settings:

````conf
PubkeyAuthentication yes
PasswordAuthentication no
````

### 2. Change the port used by the SSH daemon

In all honesty, the usefulness of this is debatable. It will help preventing un-targeted attacks, but bots may still run a portscan to find which port is the SSH daemon listening to. Regardless, implementing this technique is quite easy and it requires just a small change in the sshd configuration file.

For example, here's how to change the SSH port to 9022. Edit the sshd configuration file (location depends on the distribution; usually `/etc/ssh/sshd_config`) and change the "Port" setting:

````conf
Port 9022
````

Restart your SSH dameon with:

````bash
# For distributions using systemd
systemctl restart sshd

# For other distributions
service sshd restart
/etc/init.d/sshd restart
````

> **Warning:** if you are performing this while connected to a remote server via SSH, there's a very high chance of locking yourself out the machine! Before changing the configuration file and restarting the SSH daemon, you should make sure that the new port for SSH (9022 in this example) is allowed in your firewalls, for example iptables or any other infrastructure-level firewall. 

After changing the port, to connect to your servers you need to add the `-p` option, for example:

````bash
ssh user@amazing.host -p 9022
````

### 3. Limit failed logins to SSH

In my experience, bots performing un-targeted attacks surrender easily after they're banned. This can be as simple as blocking an IP after 4 failed SSH logins in 5 minutes: even after the ban is lifted, that bot will leave you alone. Rate-limiting can also help preventing targeted brute force attacks: by slowing down each try, it will make it even more complicated (that is, long) to successfully complete the attack.

A very popular application is **fail2ban**, a service that analyzes system logs and bans (temporarily) IPs that have multiple failed login attempts. There's plenty of articles on configuring fail2ban for SSH (for example, [fail2ban on CentOS 6](https://www.digitalocean.com/community/tutorials/how-to-protect-ssh-with-fail2ban-on-centos-6)), so I won't spend much time on this.

A simpler option is to leverage **iptables** and rate-limit the number of connections on the SSH port from the same IP. Unlike the fail2ban example above, this will count all the connections in the time frame, regardless of whether the authentication succeeded. There's a chance, thus, that admins that have to do multiple, repeated (and valid!) connections in a short amount of time may be locked out as well, but only for a few minutes.

An example iptables configuration is below. In addition to allowing ports 80 and 443, this will enable connections to port 22, with a limit of 4 connections from the same IP in a 5-minute window. An IP attempting a 5th connection within 5 minutes will be banned for the next 5 minutes. On a CentOS or RHEL box, place this file in `/etc/syconfig/iptables` (on CentOS/RHEL 7, you may need to install the `iptables-services` package, and make sure you're not conflicting with firewalld):

````text
*filter
:INPUT ACCEPT [0:0]
:FORWARD ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]

# Accept established connections
-A INPUT -i eth0 -m state --state RELATED,ESTABLISHED -j ACCEPT

# Enable HTTP/HTTPS
-A INPUT -i eth0 -p tcp -m tcp --dport 80 -j ACCEPT 
-A INPUT -i eth0 -p tcp -m tcp --dport 443 -j ACCEPT 

# Allow 4 connections in 300 seconds, then ban the IP for 300 seconds
-A INPUT -p tcp -m tcp --dport 22 -m state --state NEW -m recent --set --name DEFAULT --rsource 
-A INPUT -p tcp -m tcp --dport 22 -m state --state NEW -m recent --update --seconds 300 --hitcount 4 --name DEFAULT --rsource -j DROP 
-A INPUT -i eth0 -p tcp -m tcp --dport 22 -j ACCEPT 

# Accept ping (ICMP)
-A INPUT -i eth0 -p icmp -j ACCEPT

# Drop all other connections
-A INPUT -i eth0 -j DROP

COMMIT
````

### Conclusion

I've presented three simple tips for blocking un-targeted SSH brute force attacks (and possibly targeted ones as well) in a Linux system, without imposing heavy restrictions on administrators and without heavy configuration or maintenance. Theoretically, any of these three techniques alone should be enough to block bots, but   you may want to consider implementing more than one for additional security.


<small>*Cover photo by Martin Majer ([500px](https://500px.com/photo/95395439/2-52-rule-of-thirds-votogs52-by-martin-majer)) released under Creative Commons BY-SA*</small>