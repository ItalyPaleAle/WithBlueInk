---
layout:     post
title:      "Galera cluster, MariaDB, CoreOS and Docker (Part 1)"
subtitle:   "Get your multi-master MySQL-like cluster painless"
date:       2016-03-09 14:30:00
author:     "Alessandro Segala"
header-img: "img/redhat6.jpg"
comments:   yes
---

Lately, I've found myself in many discussions with customers who reminded me what database still matters most on the web. While startups in the Valley today are all about MongoDB (or CouchDB, or RethinkDB, or… whatever other SQL/NoSQL database you're thinking of), and while Microsoft SQL and Oracle still dominate the enterprise space, a big chunk of the web runs on MySQL. Think for example of WordPress, the blogging platforms that [powers 25% of the web](http://venturebeat.com/2015/11/08/wordpress-now-powers-25-of-the-web/), or Drupal, possibly the most popular CMS used by public institutions: both are written in PHP, and rely on MySQL.

My customers on the Azure platform can easily deploy MySQL databases through a partner company, which offers a truly managed service. However, in some cases (and for the most various reasons), this approach may not be desirable, and the only option is to self-deploy in a virtual machine. The downside of this approach is that admins need to not only install and configure the server, set up the replication, etc, but also maintain the system, patch the OS and the software, monitor the services and perform any other kind of maintenance. While proposing this to my customers, thus, I always feel like I'm giving them another burden they would rather not carry - at the same time, I feel that there's an interesting challenge ready for me to tackle.

## Project goals

My goal is clear: find the easiest way to deploy a highly-available MySQL-compatible database, that requires the least amount of maintenance.

In order to do that, I'll be using [MariaDB](http://mariadb.org), a fork of MySQL (to which they maintain compatibility) that is gaining a lot of traction. MariaDB was started by the very same developers of the original MySQL project, disappointed by how Oracle is running the project after purchasing it a few years back. The database is **fully open source** (but commercial support can optionally be purchased as well), and notable users today include Wikipedia, Facebook and Google. An interesting feature of MariaDB is **built-in support for Galera cluster**, which offers **multi-master** replication and a focus on strong consistency. Having a multi-master architecture means that clients can query the databse on every node; all replicas contain a full, consistent copy of the entire database, and in case of issues with one node, failover is automatic. Clusters created in this way can also be connected using WAN links, allowing for strong geo-redundancy (geo-replication is beyond the scope of this article).

The second important choice is to **use Docker on CoreOS**. [Docker](https://www.docker.com) is the most popular container technology in the Linux (and soon Windows) world, and doesn't need introductions. [CoreOS](https://coreos.com), on the other hand, is one of the Linux distributions of choice to run containerized applications (using Docker or their own rkt engine). This OS offers a minimal system, that ships only with a few basic tools to run and orchestrate containerized services: thanks to this, the operating system is extremely lightweight, and most importantly has less surfaces for attacks and requires less maintenance. Another very interesting feature of CoreOS is its ability to **automatically update itself** - and with no risk of breaking your applications, as they're running in containerized environments!

Running MariaDB/Galera inside Docker containers is not uncommon: searching on the Internet, you can see many solutions. However, all that I could find were using a customized Docker image for MariaDB, rather than the [official](https://hub.docker.com/_/mariadb/) one. While this pattern may be easier to follow, it's not ideal because someone will have to periodically update the custom image: delegating this task to my customers would defeat the purpose of this project, and I definitely can't assume the responsibility for this. Instead, by **relying on official images**, that are maintained by the MariaDB and Docker teams directly, one can safely assume that they'll always be up to date and tested.

## Deploy your cluster

Without further introductions, let's dig into the solution.

In this article, we'll be running the MariaDB cluster manually. Part 2, to be published shortly, will instead focus on automation, with scripts to spin up and configure the cluster automatically.

Assuming an architecture with 3 VMs:

![Architectural diagram](/assets/docker-galera-arch.jpg)

All Docker engines, located on the three nodes and each one running a containerized MariaDB, are configured in a cluster and connected by an overlay (ie. cross-host) network that is used for database replication traffic. Each node also contains a full copy of the data, and can accept connections from clients on port 3306 (default for the MySQL protocol); you're free to deploy your own load balancer on those endpoints.

> **Number of nodes**: You'll always need **at least 3 nodes** in order for Galera clusters to run properly. Also, please make sure you design your infrastructure so to avoid the risk of "split-brain conditions": I'll refer you to the [official documentation](http://galeracluster.com/documentation-webpages/weightedquorum.html) for more details.

To start, make sure that Docker is configured to be running in a cluster. While you don't need to enable Docker Swarm, you will need to make all instances of Docker aware of each other. To achieve this, you'll need a distributed key-value storage: Consul, Etcd or ZooKeeper. The [official documentation](https://docs.docker.com/engine/userguide/networking/get-started-overlay/) has great examples of setting up the cluster using Consul (obviously, itself running in a container!). If using CoreOS, which has etcd2 enabled by default, enabling clustering for Docker is really simple, and requires adding just a few lines to your `cloud-config.yaml` file; at minimum, you'll need:

````yaml
coreos:
  etcd2:
    # generate a new token for each unique cluster from https://discovery.etcd.io/new?size=3
    discovery: "https://discovery.etcd.io/<token>"
    # multi-region and multi-cloud deployments need to use $public_ipv4
    advertise-client-urls: "http://$public_ipv4:2379"
    initial-advertise-peer-urls: "http://$private_ipv4:2380"
    # listen on both the official ports and the legacy ports
    # legacy ports can be omitted if your application doesn't depend on them
    listen-client-urls: "http://0.0.0.0:2379,http://0.0.0.0:4001"
    listen-peer-urls: "http://$private_ipv4:2380,http://$private_ipv4:7001"
  units:
    - name: docker.service
      command: start
      drop-ins:
        - name: 10-opts.conf
          # enable Docker clustering with etcd
          content: |-
            [Service]
            Environment="DOCKER_OPTS=-H=0.0.0.0:2375 -H unix:///var/run/docker.sock --cluster-advertise eth0:2375 --cluster-store etcd://127.0.0.1:2379"
    - name: etcd2.service
      command: start
````

The next step is about setting up the Docker overlay network. By doing this, replication traffic for the database nodes will happen over an isolated virtual network, so ports used by Galera (4567/UDP, 4567/TCP, 4568/TCP and 4444/TCP) do not need to be exposed on the host and on your servers' network. On *one* (and just one!) machine in the cluster, execute:

    $ docker network create \
      --driver overlay \
      --subnet="192.168.220.0/24" \
      mariadb-overlay-net

The above command will create an overlay network named `mariadb-overlay-net` with address space `192.168.220.0/24`. You can choose any subnet you want, as long as it doesn't overlap with your hosts' network. To check that the network is set up correctly, you can run the following commands on each node:

    $ docker network ls
    NETWORK ID          NAME                  DRIVER
    624a10a2c33b        mariadb-overlay-net   overlay
    803f30298668        none                  null
    e71d0e4c9b24        host                  host
    1724c1a4fb03        bridge                bridge
    
    $ docker network inspect mariadb-overlay-net
    [
        {
            "Name": "mariadb-overlay-net",
            "Id": "624a10a2c33bb24fb63b0f5b69fd75983e2aeb54062cf98e1aac46fc44f24a54",
            "Scope": "global",
            "Driver": "overlay",
            "IPAM": {
                "Driver": "default",
                "Config": [
                    {
                        "Subnet": "192.168.220.0/24"
                    }
                ]
            },
            "Containers": {},
            "Options": {}
        }
    ]

In each node, create a drop-in configuration file for MariaDB to enable Galera:

    $ cat /opt/mysql.conf.d/mysql_server.cnf
    [server]
    bind-address=0.0.0.0
    binlog_format=row
    default_storage_engine=InnoDB
    innodb_autoinc_lock_mode=2
    innodb_locks_unsafe_for_binlog=1
    query_cache_size=0
    query_cache_type=0

    [galera]
    wsrep_on=ON
    wsrep_provider="/usr/lib/galera/libgalera_smm.so"
    wsrep_cluster_address="gcomm://mariadb-node-0,mariadb-node-1,mariadb-node-2,mariadb-node-3,mariadb-node-4,mariadb-node-5,mariadb-node-6,mariadb-node-7,mariadb-node-8,mariadb-node-9"
    wsrep-sst-method=rsync

    # Optional setting
    # Tune this value for your system, roughly 2x cores
    # https://mariadb.com/kb/en/mariadb/galera-cluster-system-variables/#wsrep_slave_threads
    #wsrep_slave_threads=1
    #innodb_flush_log_at_trx_commit=0

You'll also need to choose a path to store the MariaDB data. This folder is persistent on the host and will be mounted as volume in all containers. In the examples below, we'll be using `/mnt/data`. 

Eventually, start the cluster. **On the first node**, and **only for the first bootstrap**, execute this command:

    $ docker run \
      --name mariadb-node-0 \
      -d \
      --net mariadb-overlay-net \
      -v /opt/mysql.conf.d:/etc/mysql/conf.d \
      -v /mnt/data:/var/lib/mysql \
      -e MYSQL_INITDB_SKIP_TZINFO=yes \
      -e MYSQL_ROOT_PASSWORD=my-secret-pw \
      -p 3306:3306 \
      mariadb:10.1 \
      --wsrep-new-cluster \
      --wsrep_node_address=192.168.220.2

A few notes:

- Please note the `--wsrep-new-cluster`, which is used to bootstrap the Galera cluster. This flag has to be used once and only once. If you need to restart this container in the future, after the cluster has been initialized, you must omit the `--wsrep-new-cluster` flag.
- The `mysql_server.cnf` expects nodes to be named "mariadb-node-0", "mariadb-node-1", etc, up to "mariadb-node-9". If you wish to rename your nodes, make sure you change the value in the configuration file too. In any case, container names have to be unique, as they're treated as hostnames in the overlay network.
- You can set the password for the root MySQL user in the environmental variable "MYSQL_ROOT_PASSWORD". You can always change the password later, running SQL statements on the database.
- Clients can connect to the only exposed port, 3306, communicating using the standard MySQL protocol. 
- You need to use the images for MariaDB 10.1 or higher, as Galera Cluster was not included by default in previous versions.
- Lastly, the official MariaDB image uses an init script that populates the database with timezone data on initialization: as those tables are created with the MyISAM engine, which is not supported by Galera, omitting "MYSQL_INITDB_SKIP_TZINFO=yes" will cause nasty replication issues.

After running the command above, wait a couple of minutes for the Docker engine to pull the image, and then for MariaDB to be fully initialized and ready to accept replicas. You can check the logs, waiting for the "mysqld: ready for connections" message, with:

    $ docker logs -f mariadb-node-0

**On the other servers** (and **on the first one after bootstrapping too**) you can add a member to the cluster with:

    # Create (or touch) the mysql data folder so the database is not re-initialized by the init scripts
    $ mkdir -p /mnt/data/mysql
    
    $ docker run \
      --name mariadb-node-1 \
      -d \
      --net mariadb-overlay-net \
      -v /opt/mysql.conf.d:/etc/mysql/conf.d \
      -v /mnt/data:/var/lib/mysql \
      -p 3306:3306 \
      mariadb:10.1 \
      --wsrep_node_address=192.168.220.3

Because the Docker images by default initialize a new database, we are using a trick to make sure that on replicas the init script is not run: making sure that the "mysql" data folder exists. This folder is located inside the volume that is mounted. For example, if our persistent volume is stored on the host in `/mnt/data`, the data folder will be `/mnt/data/mysql`. Note also the absence of the `--wsrep-new-cluster` flag, and the different node number in the container name.


> **Docker overlay networks**: Please note that overlay networks require **Docker engine 1.9 or higher**. If that is not available, or if you prefer not to use overlay networks, you can have replication traffic happen on your hosts' network too. In order to do that, you need to modify your `docker run` command to expose the following ports: 4567/udp, 4567/tcp, 4568/tcp, 4444/tcp. Also, because the MariaDB server runs inside a container, it will not be able to get the IP of your VM, over which replication happens, so that will have to be passed explicitly with the `--wsrep_node_address=x.x.x.x` option. The modified command for the first node will look like:
>
>     $ docker run \
>       --name mariadb-node-0 \
>       -v /opt/mysql.conf.d:/etc/mysql/conf.d \
>       -v /mnt/resource/data:/var/lib/mysql \
>       -d \
>       -e MYSQL_INITDB_SKIP_TZINFO=yes \
>       -e MYSQL_ROOT_PASSWORD=my-secret-pw \
>       -p 3306:3306 \
>       -p 4567:4567/udp \
>       -p 4567-4568:4567-4568 \
>       -p 4444:4444 \
>       mariadb:10.1 \
>       --wsrep_node_address=10.2.0.1


<small>*Cover photo by Ricardo Liberato ([Flickr](https://www.flickr.com/photos/liberato/133104512/in/photolist-cLcko-hBPa95-abJqxH-fP1XP-fP1XR-2Ubk9Y-bvuSf5-5GxTDU-uVRTu-81FgS1-c7Km4u-6SUjwf-bLgooP-4ZUUC4-4eP3F3-5vUpF-pUtcnk-eDiHY6-4eK9F2-4eJMDg-5vp6ri-dGfKFh-4eNXdj-4eK9kB-4eJXdk-eDiLeV-4eTebm-4eTeRG-fP2Y5-4eP4Qh-4eP3e5-4eK4or-4eNYdC-4eNMQ7-4eJZDc-4eK22i-4eP2xw-4eNWfA-4eJVvx-4eJS7K-4eNS5G-4eNVNA-4eJM3K-4eJKQt-4eJTKc-4eJZU2-4eJH8F-4eJWPg-4eJHQD-4eNJkA)) released under Creative Commons BY-SA*</small>