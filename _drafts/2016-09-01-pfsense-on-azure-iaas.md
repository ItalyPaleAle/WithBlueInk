---
layout:     post
title:      "pfSense on Azure IaaS"
subtitle:   "Using a pfSense virtual appliance to enable site-to-site VPN on Azure"
date:       2016-09-01 12:48:00
author:     "Alessandro Segala"
header-img: "img/ssh-brute-force.jpg"
comments:   yes
---

Intro goes here

## Environment

This article assumes that you already have a Virtual Network on Azure within a Resource Group, and such VNet should have an empty subnet for our pfSense appliances.

![View of the Resource Group](/assets/pfsense/resource-group.png)

In our example, we have one Resource Group named *pfSenseTest*, that contains a Virtual Network called *pfSenseTest-vnet* and one Windows Server 2016 Virtual Machine labeled *TestVM*; the VM serves the purpose of testing connectivity only.

The address space for *pfSenseTest-vnet* in this example is `10.3.0.0/16`, and there are two subnets:

- `10.3.0.0/24` for *default*, which contains all VMs, resources, etc
- `10.3.255.0/27` for *pfSense*, containing the virtual appliances

![View of the Virtual Network Address Space](/assets/pfsense/vnet-address-space.png)
![View of the Virtual Network Subnets](/assets/pfsense/vnet-subnets.png)

In our example, the Windows Server VM has been assigned IP `10.3.0.4` in the *default* subnet.

Lastly, in this article we're assuming that the local network (on-premises) uses the address space `10.1.0.0/16`.

## Create the first pfSense appliance

Let's start by creating the first pfSense virtual appliance.

From the Azure Portal, click on the New button in the top left corner, then search for "pfSense for Azure" and select the first result. The image is published by Netgate, a partner company that also provides support for the application running in the VM. Alternatively, you can always create your own VHD image of pfSense, starting from the official ISO, but that is beyond the scope of this article.

![Searching for "pfSense for Azure" in the Marketplace](/assets/pfsense/marketplace-search.png)

Start the VM creation wizard, and in the first step give a name to the VM (*pfSenseVM01* in our example), choose *HDD* as disk type, then set the username and the password for authenticating. Please note that the username and password chosen here will also be the ones used in the pfSense web UI, so it's important that you do set a password rather than a SSH key. Continue with placing the VM in a Resource Group (either a new one or existing) and choosing the subscription to use. Lastly, pick the Region in which the appliance is to be deployed; this has to be the same as the Region in which your Virtual Network lives.

![Create the first appliance: step 1](/assets/pfsense/vm01-create-step1.png)

In the second step, choose a size for your VM. Because this is a networking appliance, A-series VMs generally provide the best cost/performance ratio. In this case, we're going to pick *A1 Standard*.

Proceed to the third step in the wizard, configuring the following options:

- Virtual Network: select the existing VNet, in our case *pfSenseTest-vnet*
- Subnet: pick the *pfSense* subnet
- Public IP Address: the appliance needs a public IP address
- Network Security Group: as pfSense will be our firewall, do not add any Network Security Group
- Availability Set: place the appliance into a new Availability Set named *pfSense*

![Create the first appliance: step 3](/assets/pfsense/vm01-create-step3.png)

Save all changes and start deploying the pfSense Virtual Machine.

While the VM is being provisioned, open the blade for its virtual Network Interface, then choose IP Configurations from the side menu. Make sure that IP Forwarding is enabled, then save your changes.  

![Enable IP Forwarding](/assets/pfsense/nic-ip-forwarding.png)

Once the VM is running, it will have a public IP:

![pfSense VM running](/assets/pfsense/vm-running-ip.png)

Connect to the VM using HTTPS and the public IP. In our example, this will be `https://13.68.100.48/`. As pfSense is configured to use a self-signed SSL certificate by default, your browser is likely to give you a security/privacy error, which can be safely ignored until a proper SSL certificate is installed. Authenticate using the same username and password set during VM creation:

![pfSense web UI: Authentication](/assets/pfsense/web-login.png)

Next, the pfSense dashboard will appear. In the dashboard, please note that the WAN IP is reported as `10.3.255.4`, which is our internal IP, assigned by DHCP. Although this VM has a public IP (`13.68.100.48`), pfSense will never see it; traffic to the public IP is automatically translated to the private one by the Azure fabric, using something like a 1:1 NAT.

![pfSense web UI: Dashboard](/assets/pfsense/web-dashboard.png)

Feel free to configure the appliance as you wish, then proceed to create the tunnel by choosing **VPN** and then **IPSec** on the top bar. On the IPSec configuration page, check the "Enable IPSec" box and save the change. Then press on the small "+" button to create a new Phase 1.

![pfSense web UI: Enable IPSec](/assets/pfsense/web-ipsec-enable.png)

In the configuration for Phase 1, make sure to set the following values:

- **Key Exchange version**: *V2* is required
- **Internet Protocol**: *IPv4* only, as Azure does not support IPv6 as of writing
- **Interface**: *WAN*
- **Remote Gateway**: Type the public IP of the on-prem router
- **Authentication method**: *Mutual PSK*
- **My identifier**: Select *IP Address* and manually type the public IP address assigned to the pfSense appliance, in this case `13.68.100.48`
- **Peer identifier**: *Peer IP address* (or change as necessary)
- **Pre-Shared Key**: you can use any passphrase, as long as the same one is used on both sides of the tunnel
- For **Encryption algorithm**, **Hash algorithm**, **DH key group** and **Lifetime**, choose any value supported by your on-prem appliance; the values need to match on both sides of the tunnel

A sample configuration for Phase 1 is below:

![pfSense web UI: IPSec Phase 1 configuration](/assets/pfsense/web-ipsec-phase1.png)

After Phase 1 is created, expand the list of Phase 2 entries, then press on the "+" button to add a Phase 2 configuration:

![pfSense web UI: IPSec Phase 1 created](/assets/pfsense/web-ipsec-phase1-created.png)

Proceed then with configuring Phase 2 like in the example:

- **Mode**: *Tunnel IPv4*
- **Local Network**: Choose *Network* and then type the address space of the Azure VNet, in this case `10.3.0.0/16`
- **Remote Network**: Choose *Network* and then type the address space of the local network, in this case `10.1.0.0/16`
- **Protocol**: *ESP*
- For **Encryption algorithm**, **Hash algorithm**, **PFS key group** and **Lifetime**, choose any value supported by your on-prem appliance; the values need to match on both sides of the tunnel

A sample configuration for Phase 2 is below:

![pfSense web UI: IPSec Phase 2 configuration](/assets/pfsense/web-ipsec-phase2.png)

The tunnel will look like the following. Press "Apply changes" to start the IPSec VPN.

![pfSense web UI: IPSec Phase 2 created](/assets/pfsense/web-ipsec-phase2-created.png)

Lastly, it's necessary to configure the firewall in the pfSense appliance to allow traffic to flow through the VPN. From the top bar, choose **Firewall** then **Rules**:

![pfSense web UI: Open the Firewall Rules section](/assets/pfsense/web-firewall-menu.png)

We need to set up two set of rules, on the WAN interface as well as on the IPsec one. Start from the WAN tab and add a new rule at the bottom:

- **Action**: *Pass*
- **Interface**: *WAN*
- **TCP/IP Version**: *IPv4*
- **Protocol**: *any*
- **Source**: Choose *network*, then type the address space of the Azure VNet, for example `10.3.0.0/16`
- **Destination**: Choose *network*, then type the address space of the local network, for example `10.1.0.0/16`

![pfSense web UI: Add firewall rule for the WAN interface](/assets/pfsense/web-firewall-wan-create.png)

The list of rules for the WAN should look like:

![pfSense web UI: Firewall rules on the WAN interface](/assets/pfsense/web-firewall-wan.png)

Open next the IPSec tab and add a new rule:

- **Action**: *Pass*
- **Interface**: *IPSec*
- **TCP/IP Version**: *IPv4*
- **Protocol**: *any*
- **Source**: *any*
- **Destination**: *any*

![pfSense web UI: Add firewall rule for the IPSec interface](/assets/pfsense/web-firewall-ipsec-create.png)

Rules in your IPSec tab should look like:

![pfSense web UI: Firewall rules on the IPSec interface](/assets/pfsense/web-firewall-ipsec.png)

With this, your first pfSense virtual appliance should be ready to operate as VPN gateway!

## Configure the VPN on-premises

On your on-prem VPN appliance configure the IPSec tunnel according to the documentation from the vendor. A few things to remember when configuring the VPN on-prem:

- Make sure you're using IKEv2 for key exchange
- Connect to the pfSense appliance on Azure using its public IP; the same IP is also the identifier for that side of the tunnel
- Values for "Local Network" and "Remote Network" are inverted
- Make sure that you use the same encryption and hashing algorithms enabled on the Azure side, and the same PSK

## Check connection status

If everything is set up correctly, in your pfSense virtual appliance you should see the connection status as "established" in the IPSec status page (from the top bar, choose **Status** and then **IPSec**):

![pfSense web UI: IPSec status page](/assets/pfsense/web-ipsec-status.png)

Additionally, from the LAN you should be able to ping the test Windows VM on Azure, and from the Azure side you should be able to ping nodes in the LAN.

*Pinging from the LAN to Azure*

![Pinging from the LAN to Azure](/assets/pfsense/ping-lan-azure.png)

*Pinging from Azure to the LAN*

![Pinging from Azure to LAN](/assets/pfsense/ping-azure-lan.png)

<small>*Cover photo by Martin Majer ([500px](https://500px.com/photo/95395439/2-52-rule-of-thirds-votogs52-by-martin-majer)) released under Creative Commons BY-SA*</small>