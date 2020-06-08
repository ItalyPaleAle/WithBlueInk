---
title: "Distributed Web: host your website with IPFS clusters, Cloudflare, and DevOps"
description: "Static website development for the \"Web 3.0\", and optional CI/CD with Azure DevOps"
date: 2018-11-14 08:39:00
author: "Alessandro Segala"
image: "img/planet.jpg"
comments: yes
authorTwitter: "@ItalyPaleAle"
---

> *March 13, 2019: This post has been updated for ipfs-cluster 0.10*

IPFS (or, the _InterPlanetary File System_) is a peer-to-peer network designed to distribute content in a decentralized way. At present time, it appears to me that IPFS is one of the (very few) technologies that are part of the Distributed Web—or "Web 3.0"—to have reached a stage where they’re mature and user-friendly enough to be adopted by broader audiences.

A huge help in making IPFS more accessible comes from Cloudflare, which just two months ago announced it is offering a free [IPFS gateway](https://blog.cloudflare.com/distributed-web-gateway/) through their CDN. Thanks to that, we can get a custom sub-domain and point it to a website served via IPFS, and this is all transparent to our end users. 😎

With this article we're looking into one part of the Distributed Web, which is hosting static websites. These are web apps written in HTML and JavaScript (with optional use of React, Angular, Vue, Svelte… I could continue _ad nauseam_ here), that are not connected to any database and do not have any server-side processing. If this sounds a bit limiting, well, it is, but at the moment I don't believe developers and technologists have really figured out a mature, comprehensive, and user-friendly way to build distributed backends. There are many projects attempting to do this (almost all of them based on blockchains), but a winner hasn't emerged. Regardless, with some creativity and relying on external APIs, you can still build very exciting apps, even without traditional backend servers.

In the rest of this article, I'll show you **how to serve a complete static website using IPFS** (with HTML, JavaScript, CSS, images, etc), and make it **available via HTTPS on a custom domain thanks to Cloudflare**. I'll also show you how to optionally enable **full Continuous Integration and Continuous Delivery using Azure DevOps**. We will have high availability with three geo-distributed servers. This is as **production-ready** as it gets, for a the technology is too new to be really battle-tested.

To continue this article, you should to be at least somewhat **familiar with the basics of IPFS**. There are countless of articles and tutorials showing how to get IPFS on your laptop, browse and publish files to the network; if you need a refresher, check out the [official guide](https://docs.ipfs.io/introduction/usage/).

> **What IPFS is and what it is not**
>
> This confused me at the beginning: *if IPFS is distributed, why do I need servers and high-availability?*. Turns out, I was looking at this the wrong way.<br />
> IPFS is a *distribution protocol*, and not a storage service. It is more akin to a CDN than a NAS: you don't *upload* files to IPFS, but you *serve* files through it. <br />
> The difference with a traditional CDN is that once a client has downloaded your data, it will seed it too for as long as it's online (and with the IPFS daemon running), making your content available faster.<br />
> This means that you need at least one node with the data you want to serve pinned in it (so it's not garbage-collected), up 24/7. For high availability, we'll deploy a cluster of nodes, and we'll make it geo-distributed because… well, why not!

## Prepare the infrastructure

We'll be using **three** nodes to serve our website. These nodes will be running the IPFS daemon, and will have our documents pinned in them. In order to keep the list of pinned items (or, the pinset) in sync across all nodes, we'll be using [IPFS Cluster](https://github.com/ipfs/ipfs-cluster), running alongside the IPFS daemon.

Why 3 nodes? IPFS Cluster is built on top of the Raft consensus algorithm, and 3 nodes is the minimum required to ensure that we maintain quorum and the system can continue to operate even with the failure of a single node. These nodes should be deployed in a way that it will be highly unlikely for all of them to fail at the same time: in a cloud environment, this is easy done using multiple availability sets and/or availability zones. In this article, we'll go one step further, deploying to multiple regions worldwide, just for fun (but, really, it's not a bad idea for you too).

To start, **create three nodes (Linux VMs) on your favorite cloud provider** (I'll be using Azure in my example). Thanks to the distributed nature of IPFS, you'll likely be ok with using small nodes for your cluster, so this won't break the bank for you. Make sure that **Docker is installed** in each node, and that the following ports are open in the firewall (in addition to SSH):

- **4001 (tcp)** for IPFS
- **9096 (tcp)** for IPFS Cluster

In my example, I have created three Ubuntu 18.04 LTS VMs (we'll be using containers, so the actual distribution isn't important) in Azure, in the US, Europe and Asia. While geo-distribution isn't a strict requirement, it will make our cluster more resilient and we'll be serving data faster to users worldwide. Plus, it sounds a cool thing to do. I've also installed Docker CE in all VMs.

![Three VMs running on the cloud](/assets/ipfs/running-vms.png)

Take note of the public IPs, as we'll need them.

## Start the IPFS daemon

First step is to start the IPFS daemon, using Docker, running a command on **every node**.

We're using two Docker volumes:

- `/data/ipfs` contains the configuration and internal data for the IPFS daemon. We're mounting it as volume so the data persists when the container is re-created (e.g. when you update the container image)
- `/data/ipfs-staging` is where you can put the files you want to publish on IPFS. More on this later.

We're also starting the container with the `-d --restart=always` options, so it will run in the background and will be restarted automatically if it crashes or when the server reboots.

````sh
# Create a Docker network for our containers
sudo docker network create \
  --driver="bridge" \
  --subnet="172.30.1.0/24" \
  ipfs

# Start IPFS
sudo docker run \
  -d \
  --restart=always \
  --name=ipfs-node \
  -v /data/ipfs:/data/ipfs \
  -v /data/ipfs-staging:/staging \
  -p 4001:4001 \
  --network="ipfs" \
  ipfs/go-ipfs:release

# Wait 10 seconds to give the daemon time to start
sleep 10

# Configure IPFS with the "server" profile
sudo docker exec \
  ipfs-node \
    ipfs config profile apply server
````

That's it! We should now have a working IPFS daemon.

## Start IPFS Cluster

This won't be as straightforward as the last step. 🙃

To start, we need to generate some cryptographic secrets and keys. The first thing we need is a shared **secret** for the cluster. This is a string that we'll pass to each node of the cluster, so they can communicate with each other safely. Generate it once on one of the nodes:

````sh
od  -vN 32 -An -tx1 /dev/urandom | tr -d ' \n' && echo ""
# Result will be similar to:
# e2a63ec01bf0a1fff9df2ade32833e46c42cca67085eecc3737333d9183316f6
````

Next, again on one of the nodes, generate the **peer id** and **private key** for each node on the cluster. We can do this with the `ìpfs-key` utility, running inside a temporary container:

````sh
# Start a container with Go
sudo docker run --rm -it golang:1.11-alpine sh

# Run these inside the container
apk add git
go get github.com/whyrusleeping/ipfs-key
ipfs-key | base64 | tr -d ' \n' && echo ""
````

The result will be similar to this; line 3 contains the generated key, and line 4 (a very long line) contains the private key.

````text
Generating a 2048 bit RSA key...
Success!
ID for generated key: Qma2uTgTZk8Vz456fELirJExns5qPkXdzhCnmEthidmuWd
CAASpwkwggSjAgEAAoIBAQCj+lZoIh3U+MJ6Oub[...]
````

**Repeat the last command as many times as the number of nodes in your cluster**. In my example, that is three times. At the end, I should have one (only one!) shared secret, and three different pairs of peer id and private key.

In **each node** create the config file `/data/ipfs-cluster/service.json`. Use the template below, and fill:

- `cluster.id` containing the peer id (the one generated with the private key, starting with "Qm"); this is unique for each node
- `cluster.peername` a friendly name for the node; this is unique for each node
- `cluster.private_key` the private key, generated with the peer id (a long base64-encoded string); this is unique for each node
- `cluster.secret` the shared secret; it's the same value for all nodes
- `consensus.raft.init_peerset` this is a JSON array of all the peer ids; same list for all nodes

The template below has been modified from the default configuration, increasing the timeouts to make the cluster work better with geo-distributed nodes. Depending on how you use your cluster (for example, how many pins and how often they change), you might need to make other advanced tweaks to the configuration; see the [official documentation](https://cluster.ipfs.io/documentation/deployment/#running-ipfs-cluster-in-production).

````json
{
  "cluster": {
    "id": "<peer id - example Qma2uTgTZk8Vz456fELirJExns5qPkXdzhCnmEthidmuWd>",
    "peername": "<name of this node - e.g. node-1 or node-eu>",
    "private_key": "<private key here, the very long one>",
    "secret": "<secret here, the short one - e.g. e2a63ec01bf0a1fff9df2ade32833e46c42cca67085eecc3737333d9183316f6>",
    "leave_on_shutdown": false,
    "listen_multiaddress": "/ip4/0.0.0.0/tcp/9096",
    "state_sync_interval": "10m0s",
    "ipfs_sync_interval": "2m10s",
    "replication_factor_min": -1,
    "replication_factor_max": -1,
    "monitor_ping_interval": "15s",
    "peer_watch_interval": "5s",
    "disable_repinning": false
  },
  "consensus": {
    "raft": {
      "init_peerset": [
        "<id of peer 1 - example Qma2uTgTZk8Vz456fELirJExns5qPkXdzhCnmEthidmuWd>",
        "<id of peer 2 - example QmbonWnum4FsWg9yRHhgcgNAG4UcQWAZkDppjTGLRDMZo7>",
        "<id of peer 3 - example QmU7jPxK6LXFDTwkXe173V5LLv3WV43BPGgBYuhXm4FLSj>"
      ],
      "wait_for_leader_timeout": "2m",
      "network_timeout": "20s",
      "commit_retries": 1,
      "commit_retry_delay": "200ms",
      "backups_rotate": 6,
      "heartbeat_timeout": "5s",
      "election_timeout": "5s",
      "commit_timeout": "500ms",
      "max_append_entries": 64,
      "trailing_logs": 10240,
      "snapshot_interval": "2m0s",
      "snapshot_threshold": 8192,
      "leader_lease_timeout": "1s"
    }
  },
  "api": {
    "ipfsproxy": {
      "node_multiaddress": "/dns4/ipfs-node/tcp/5001",
      "listen_multiaddress": "/ip4/0.0.0.0/tcp/9095",
      "read_timeout": "0s",
      "read_header_timeout": "5s",
      "write_timeout": "0s",
      "idle_timeout": "1m0s"
    },
    "restapi": {
      "http_listen_multiaddress": "/ip4/0.0.0.0/tcp/9094",
      "read_timeout": "0s",
      "read_header_timeout": "5s",
      "write_timeout": "0s",
      "idle_timeout": "2m0s",
      "basic_auth_credentials": null,
      "headers": {},
      "cors_allowed_origins": ["*"],
      "cors_allowed_methods": ["GET"],
      "cors_allowed_headers": [],
      "cors_exposed_headers": ["Content-Type", "X-Stream-Output", "X-Chunked-Output", "X-Content-Length"],
      "cors_allow_credentials": true,
      "cors_max_age": "0s"
    }
  },
  "ipfs_connector": {
    "ipfshttp": {
      "node_multiaddress": "/dns4/ipfs-node/tcp/5001",
      "connect_swarms_delay": "30s",
      "pin_method": "refs",
      "ipfs_request_timeout": "5m0s",
      "pin_timeout": "24h0m0s",
      "unpin_timeout": "3h0m0s"
    }
  },
  "pin_tracker": {
    "maptracker": { "max_pin_queue_size": 50000, "concurrent_pins": 10 },
    "stateless": { "max_pin_queue_size": 50000, "concurrent_pins": 10 }
  },
  "monitor": {
    "monbasic": { "check_interval": "15s" },
    "pubsubmon": { "check_interval": "15s" }
  },
  "informer": {
    "disk": { "metric_ttl": "30s", "metric_type": "freespace" },
    "numpin": { "metric_ttl": "10s" }
  }
}
````

In **each node** create also the peerstore file in `/data/ipfs-cluster/peerstore`. This file contains the list of multiaddresses for each peer, which includes the public IP and peer id. The format is `/ip4/<public ip>/tcp/9096/ipfs/<peer id>`. For example:

````text
/ip4/104.215.197.193/tcp/9096/ipfs/Qma2uTgTZk8Vz456fELirJExns5qPkXdzhCnmEthidmuWd
/ip4/40.114.206.57/tcp/9096/ipfs/QmbonWnum4FsWg9yRHhgcgNAG4UcQWAZkDppjTGLRDMZo7
/ip4/104.214.93.186/tcp/9096/ipfs/QmU7jPxK6LXFDTwkXe173V5LLv3WV43BPGgBYuhXm4FLSj
````

Then, in each node, start the IPFS Cluster container with this command. Try to start all containers within a few seconds, so they don't timeout while trying to connect to each other.

````sh
sudo docker run \
  -d \
  --restart=always \
  --name=ipfs-cluster \
  -v /data/ipfs-cluster:/data/ipfs-cluster \
  -p "127.0.0.1:9094:9094" \
  -p "9096:9096" \
  --network="ipfs" \
  ipfs/ipfs-cluster:v0.10.0
````

**Done!** The cluster is up. You can check that everything is working (in each node) with:

````sh
sudo docker logs -f ipfs-cluster
````

## Publish a web app to IPFS

Let's try publishing a static web app to IPFS. We'll be using [rwieruch/minimal-react-webpack-babel-setup](https://github.com/rwieruch/minimal-react-webpack-babel-setup) which is a simple React app, compiled with Webpack.

The first step is to clone the source code and compile the app. You can do it on one of the VMs, or on your laptop.

````sh
# Requires Node.js and Git installed
git clone https://github.com/rwieruch/minimal-react-webpack-babel-setup
cd minimal-react-webpack-babel-setup
npm install
npx webpack --mode production
````

At this point, we should have our static web app in the `dist` subfolder, with two files: `index.html` and `bundle.js` (the index file in IPFS needs to be called `index.html`). We need to copy the entire folder to one of the VMs, and put it inside the `/data/ipfs-staging` directory. For example, I copied the entire dist folder to `/data/ipfs-staging/react`

````sh
# Just to show the structure of the directory
$ tree /data/ipfs-staging
/data/ipfs-staging
└── react
    ├── bundle.js
    └── index.html
````

Let's publish the website to IPFS.

````sh
# The -r switch for recursively adding a folder
# The -Q switch only shows the content id of the folder that we're adding, and not of every single file (and folder) inside there
# Note that /data/ipfs-staging is mounted to /staging in the container
sudo docker exec \
  ipfs-node \
    ipfs add -rQ /staging/react

# Result will be similar to "QmVWPaTVSKqZ28qAefQX3PYptjR3nJgiT5Pugz1pPYsqvz"
````

The website has already been published and it's in the folder `QmVWPaTVSKqZ28qAefQX3PYptjR3nJgiT5Pugz1pPYsqvz`, however it's currently pinned only on one node. Let's add it to the pinset of our IPFS Cluster so all nodes can seed it:

````sh
# Pin the folder recursively
sudo docker exec \
  ipfs-cluster \
    ipfs-cluster-ctl pin add \
      QmVWPaTVSKqZ28qAefQX3PYptjR3nJgiT5Pugz1pPYsqvz

# Check the replication status
sudo docker exec \
  ipfs-cluster \
    ipfs-cluster-ctl status \
      QmVWPaTVSKqZ28qAefQX3PYptjR3nJgiT5Pugz1pPYsqvz

# Result will be similar to
# QmVWPaTVSKqZ28qAefQX3PYptjR3nJgiT5Pugz1pPYsqvz :
#     > node-1-asia     : PINNED | 2018-11-13T08:40:45Z
#     > node-2-eu       : PINNED | 2018-11-13T08:40:46Z
#     > node-3-us       : PINNED | 2018-11-13T08:40:44Z

# You can also list all the pins in the pinset
sudo docker exec \
  ipfs-cluster \
    ipfs-cluster-ctl pin ls

# To remove a pin
sudo docker exec \
  ipfs-cluster \
    ipfs-cluster-ctl pin rm \
      QmVWPaTVSKqZ28qAefQX3PYptjR3nJgiT5Pugz1pPYsqvz
````

At this point we can test the web app. If you have the IPFS daemon installed and running on your laptop, you can open:

    http://localhost:8080/ipfs/QmVWPaTVSKqZ28qAefQX3PYptjR3nJgiT5Pugz1pPYsqvz/

Alternatively, you can use a gateway that shows IPFS over HTTP, like Cloudflare's:

    https://cloudflare-ipfs.com/ipfs/QmVWPaTVSKqZ28qAefQX3PYptjR3nJgiT5Pugz1pPYsqvz/

One thing you'll notice: the web page loads and you can see the title, but the content is empty! Let's open the Inspector:

![Empty web app served via IPFS](/assets/ipfs/app-empty.png)

As you can see, the issue is that the static web app is trying to include the JavaScript bundle at the path `/bundle.js`. Since our web app is not running in the root folder of the domain, that request fails. This is expected, and you can fix it by changing this line in the `index.html` file (making the path relative rather than absolute), then repeating the steps above to publish the updated app:

````html
<script src="bundle.js"></script>
````

After making the change and re-publishing the app, the content id is now `QmakGEBp4HJZ6tkFydbyvF6bVvFThqfAwnQS6F4D7ie7hL`, and the app is live at the following URLs:

    http://localhost:8080/ipfs/QmakGEBp4HJZ6tkFydbyvF6bVvFThqfAwnQS6F4D7ie7hL/
    https://cloudflare-ipfs.com/ipfs/QmakGEBp4HJZ6tkFydbyvF6bVvFThqfAwnQS6F4D7ie7hL/

![Web app served via IPFS](/assets/ipfs/app-local.png)

Note that the old content has not been removed, and it will be available for as long as there's at least one node seeding it. You can unpin it from the pinset to have it (eventually) removed from our nodes, but that doesn't guarantee that other IPFS nodes in the world will stop seeding it. Instead, read the next session for how to use IPNS.

## Bind to a domain name

Now that the app is live, we need to make it easier to access. A path like `/ipfs/QmakGEBp4HJZ6tkFydbyvF6bVvFThqfAwnQS6F4D7ie7hL` is not particularly memorable, and it will change every time you update your content. To fix both these issues, we'll be using the DNSLink feature.

We'll need a domain name, and the ability to edit DNS records. We can simply add a TXT record named `_dnslink.domain.com`, with the value `dnslink=/ipfs/<content id>`. Then, users will be able to access content on IPFS via `/ipns/domain.com` (note the IPNS prefix). You can use subdomains too.

I'm going to use `ipfs-demo.withblueink.com` as example. For this, I'm creating a new TXT record:

- Record type: TXT
- Domain: `_dnslink.ipfs-demo.withblueink.com` (the domain name with `_dnslink.` prepended)
- Value: `dnslink=/ipfs/QmakGEBp4HJZ6tkFydbyvF6bVvFThqfAwnQS6F4D7ie7hL`
- TTL: 300 seconds(5 minutes)

There's no "right value" for the TTL, as it depends on how often you plan to update the content id (which changes every time you update the content). If you plan to update your files frequently, a low TTL (down to 120 seconds) could be better; on the other hand, if you don't plan to update the content at all, even a full day (86400 seconds) might be a good choice.

After saving the new DNS records and waiting a few moments for changes to propagate, we should be able to access our app using these URLs:

    http://localhost:8080/ipns/ipfs-demo.withblueink.com
    https://cloudflare-ipfs.com/ipns/ipfs-demo.withblueink.com

## Add a custom domain (with Cloudflare)

The very last step is about making our custom domain pointing to the IPFS gateway directly, so it's totally transparent to our users. Thanks to Cloudflare's new [Distributed Web Gateway](https://www.cloudflare.com/distributed-web-gateway/), this is very easy to do—and totally free!

To start using the Cloudflare IPFS gateway, you need to add 2 DNS records to your domain:

1. The first record is the DNSLink TXT record, which we've already added in the previous step. Nothing new to see here!
2. You also need to add a CNAME record for the subdomain you want pointing to `cloudflare-ipfs.com`. In my example, I'm going to create a CNAME for `ipfs-demo.withblueink.com` pointing to `cloudflare-ipfs.com`.

> Note: as you know, CNAME records cannot be set on the root domain, but only a subdomain. That means you can't create a CNAME record on `withblueink.com`, and you must use a subdomain (like `ipfs-demo.withblueink.com`).

Last step: on the [Cloudflare Distributed Web Gateway](https://www.cloudflare.com/distributed-web-gateway/) page, click on the **Connect your website** button. You'll see a textbox at the bottom of the page: type your domain name there and submit the form. This will setup your domain in the Cloudflare gateway and generate the TLS certificates for your domain.

![Setting up the domain with Cloudflare Distributed Web Gateway](/assets/ipfs/cloudflare-setup.png)

After a couple of minutes, your domain will be active, also with TLS, and you can browse your app on IPFS at the URL:

    https://ipfs-demo.withblueink.com

![Web app served via Cloudflare gateway](/assets/ipfs/app-cloudflare.png)

## Continuous Integration and Continuous Delivery with Azure DevOps

Let's make this even more fun and implement full CI/CD capabilities. We'll be using the **free [Azure DevOps](https://azure.microsoft.com/en-us/services/devops/)** to automatically build our app and publish it to IPFS as soon as we make changes to the code.

### Generate a new SSH key

Before we dig into the creation of the pipeline, we need to create a SSH keypair so that Azure DevOps can connect to one of our VMs and publish our app on IPFS. On one of the nodes we've created (in my case, I'm picking the one in the US, because my Azure DevOps account is in the US), connect via SSH and execute:

````sh
# First: Generate the new key
ssh-keygen -t rsa -b 4096
# Save the key in the default location (~/.ssh/id_rsa)
# Do not add a passphrase to the key

# Second: Append the public key to authorized_keys
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
````

Copy then the contents of the private key (`~/.ssh/id_rsa`) somewhere. You might also want to delete the private key file from the server.

### Set up the Build pipeline

To start, [login to Azure DevOps](https://dev.azure.com), and create an account if you don't have one already. You might also want to create a new project for this.

Open your Azure DevOps project, and navigate to the Pipelines tab, then choose **Builds**. Click on the "New pipeline" button.

![Create a new pipeline landing screen](/assets/ipfs/pipelines-new.png)

Click on the "Use the visual designer" link.

![Choose to use the visual designer](/assets/ipfs/pipelines-visual-designer.png)

Select where your source code lives, and authorize the Azure DevOps app if necessary. You will then be able to select the repository and branch containing your code. In this demo, I'm using the same **[rwieruch/minimal-react-webpack-babel-setup](https://github.com/rwieruch/minimal-react-webpack-babel-setup)** repo from GitHub, and the master branch.

![Selecting a repo](/assets/ipfs/pipelines-repo-selection.png)

> Note: the build tasks in this section are specific to this demo application, which, you'll recall, uses React and is compiled with Webpack. Your application might require different steps, and might even be built with completely different tools (e.g. Ruby and Jekyll).

In the next step, skip selecting a template and choose to start with an empty job.

![Skipping templates](/assets/ipfs/pipelines-template.png)

Click on the "+" icon next to "Agent job 1". Search for **Node Tool Installer**, then add the task.

![Adding the NPM task](/assets/ipfs/pipelines-add-node-tool.png)

Configure the task with:

- Display name: `Use Node 10.x`
- Version spec: `10.x`

Add then a task of type **Bash Script** and configure it with:

- Display name: `Bash Script`
- Type: inline
- Script: `npm install && npx webpack --mode production`

Lastly, add a **Publish Build Artifacts** task (note: there are two tasks with similar names; don't pick the deprecated one). Configure this task with:

- Display name: `Publish Artifact: drop`
- Path to publish `dist` (this is the folder where Webpack puts the compiled files - might be different in your project)
- Artifacts publish location: `Azure Pipelines/TFS`

Lastly, select the row called "Pipeline". Give your pipeline a name (e.g. `ipfs-demo-CI`) and select **Hosted Ubuntu 1604** as agent pool.

![Select agent pool and save](/assets/ipfs/pipelines-pool-and-save.png)

We now have the pipeline complete. Press "Save & Queue" to start a new build. After a few moments, it should be done building the app!

![Succesful CI run](/assets/ipfs/pipelines-ci-done.png)

### Create a Release pipeline

After building the app, we need to publish the code on IPFS. For this, we'll be using the **Releases tab** under Pipelines. Open that, then click on the "New pipeline" button. Once again, do not pick a template, but instead click on "Start with an empty job".

First thing, click on the blue area saying "Add an artifact".

![First step is adding an artifact](/assets/ipfs/pipelines-release-new.png)

Leaving source type as "Build", choose the Source (build pipeline) that generated the artifacts: this is the build pipeline we created a few moments ago. Note down the value for "Source alias", as we'll need it soon.

![Select artifacts](/assets/ipfs/pipelines-add-artifact.png)

Click then on the Tasks tab, and choose "Stage 1".

![Open stage 1 tasks](/assets/ipfs/pipelines-tasks-menu.png)

Select the first Agent Job and change the Agent pool to use **Hosted Ubuntu 1604**. Then, click on the "+" symbol to add a new task.

![Change pool for Agent Job](/assets/ipfs/pipelines-release-pool.png)

Search for the task **Copy Files Over SSH** and add it. Before continuing, you'll see that you need to create a new "SSH service connection". Click on the "Manage" button next to it.

In the new page that appears, click on the "New service connection" dropdown, and choose "SSH". Configure the connection with:

- Connection name: any value you want, for example the name of the VM - in my case, `IPFS-US`
- Host name: public IP of your VM
- User name: the name of the user inside the VM
- Password: leave empty
- Private key: paste the private key you generated earlier

![Configure the SSH connection](/assets/ipfs/pipelines-ssh-connection.png)

Back to the previous tab, configure the Copy Files Over SSH task with:

- Display name: `Copy files to staging via SSH`
- SSH Service Connection: select the connection created a moment ago
- Source folder: `$(System.DefaultWorkingDirectory)/_ipfs-demo-CI/drop` (the `ipfs-demo-CI` token is the "Source alias" of the artifacts that you selected a few moments back)
- Target folder: `/data/ipfs-staging/react` (any subfolder of `/data/ipfs-staging`)
- Under Advanced, make sure that the following options are checked:
  - Clean target folder
  - Overwrite
  - Fail if no files found to copy

![Configure the SCP task](/assets/ipfs/pipelines-scp-task.png)

Add a second task on the pipeline, of type **SSH**, that will add the app to the pinset. Configure the task with:

- Display name: `Pin files on IPFS`
- SSH Service Connection: select the connection created a moment ago
- Run: "inline script"
- Inline script: copy the script below. Make sure that the path in the first command is the same as the "target folder" above (and remember that `/data/ipfs-staging` is mapped to `/staging` inside the container)

````sh
#!/bin/sh
# Add files to IPFS
HASH=$(sudo docker exec ipfs-node ipfs add -rQ /staging/react)
# Add to the pinset of the cluster
sudo docker exec ipfs-cluster ipfs-cluster-ctl pin add $HASH
````

![Configure the SSH task](/assets/ipfs/pipelines-ssh-task.png)

> The task above is missing one step: **changing the TXT DNS record** for the Cloudflare gateway to point to the new IPFS content id. How this can be accomplished depends on your domain name registrar (or DNS nameserver), and if they provide any API access. <br/>
> In my specific case, I'm using Cloudflare also as a DNS nameserver, and I can modify the script above to invoke the Cloudflare APIs. After getting the [API Key](https://support.cloudflare.com/hc/en-us/articles/200167836-Where-do-I-find-my-Cloudflare-API-key-) and the zone ID (in the CloudFlare portal, this is in the "Domain Summary" tab), I need to append these commands at the end of the previous script (make sure "jq" is installed in the system):
> 
> ````sh
> # Note: this updates an existing record; will fail if record doesn't already exist
> 
> # Cloudflare API KEY here
> CLOUDFLARE_API_KEY="1234567890abcdef"
> # Email address of the Cloudflare account
> CLOUDFLARE_EMAIL=someone@example.com
> # Zone id
> ZONE_ID="1234567890abcdef"
> # Name of the TXT record
> DOMAIN=_dnslink.ipfs-demo.withblueink.com
> 
> RECORD_ID=$(curl -sS -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?type=TXT&name=$DOMAIN" \
>      -H "Content-Type:application/json" \
>      -H "X-Auth-Key:$CLOUDFLARE_API_KEY" \
>      -H "X-Auth-Email:$CLOUDFLARE_EMAIL" \
>          | jq -r '.result[0].id')
> 
> curl -sS -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$RECORD_ID" \
>      -H "Content-Type:application/json" \
>      -H "X-Auth-Key:$CLOUDFLARE_API_KEY" \
>      -H "X-Auth-Email:$CLOUDFLARE_EMAIL" \
>      --data "{\"type\":\"TXT\",\"name\":\"$DOMAIN\",\"content\":\"dnslink=/ipfs/$HASH\",\"ttl\":120,\"priority\":10,\"proxied\":false}"
> ````
>

Save the release pipeline, then click on the **Release** button and start a new release. Wait a few moments, and it's done!

![Release complete](/assets/ipfs/pipelines-release-done.png)


<small>*Cover photo by NASA ([Unsplash](https://unsplash.com/@nasa))*</small>
