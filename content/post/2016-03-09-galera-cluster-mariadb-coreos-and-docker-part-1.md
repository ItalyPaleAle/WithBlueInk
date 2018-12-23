---
title: "Galera cluster, MariaDB, CoreOS and Docker (Part 1)"
description: "Get your multi-master, MySQL-like cluster, pain free"
date: 2016-03-09 23:35:00
author: "Alessandro Segala"
image: "img/containers.jpg"
comments: yes
---

Lately, I've found myself in many discussions with customers who remind me what database still matters most on the web. While startups in the Valley today are all about MongoDB (or CouchDB, or RethinkDB, or… whatever other SQL/NoSQL database you're thinking of), and while Microsoft SQL and Oracle still dominate the enterprise space, a big chunk of the web runs on MySQL. Think for example of WordPress, the blogging platform that [powers 25% of the web](http://venturebeat.com/2015/11/08/wordpress-now-powers-25-of-the-web/), or Drupal, possibly the most popular CMS used by public institutions: both are written in PHP, and rely on MySQL.

My customers on the Azure platform can easily deploy MySQL databases thanks to a partner company, which offers a truly managed service. However, in some cases, and for disparate reasons, this solution may not be desirable, and the only remaining option is to self-deploy the database in a virtual machine. Admins doing this not only need to install and configure the server, set up the replication, etc, but also to maintain the system, patch the OS and the software, monitor the services and perform other maintenance. While proposing this to my customers, thus, I always feel like I'm giving them another burden they would rather not carry - at the same time, I feel that there's an interesting challenge ready for me to tackle.

## Project goals

My goal is clear: find the easiest way to deploy a highly-available MySQL-compatible database that requires the least amount of maintenance.

In order to do that, I'll be using [MariaDB](http://mariadb.org), a fully-compatible fork of MySQL that is gaining a lot of traction. MariaDB was created by the very same authors of MySQL, who were disappointed by how the project is managed after multiple acquisitions. MariaDB is **fully open source**, but enterprise support can optionally be purchased as well; notable users today include Wikipedia, Facebook and Google. An interesting feature of MariaDB is **built-in support for Galera Cluster**, which offers **multi-master** replication and a focus on strong consistency. Having such architecture means that clients can query the database on every node. All replicas contain a full, consistent copy of the entire dataset, and in case of issues with one node, failover is automatic. Clusters created in this way can also be connected using WAN links, allowing for strong geo-redundancy (geo-replication is beyond the scope of this article).

The second important choice is to **use Docker on CoreOS**. [Docker](https://www.docker.com) is the most popular container technology in the Linux (and soon Windows) world, and doesn't need an introduction. [CoreOS](https://coreos.com), on the other hand, is one of the Linux distributions of choice to run containerized applications (using Docker or their own rkt engine). This OS offers a minimal system, that ships only with a few basic tools to run and orchestrate containerized services. Thanks to this simple architecture, the operating system is extremely lightweight, and most importantly has less surfaces for attacks and requires less maintenance. Another particularly interesting feature of CoreOS is its ability to **automatically update itself** - and with no risk of breaking your applications, as they're running in containerized environments!

Running MariaDB/Galera inside Docker containers is not uncommon: you can already find many solutions on the Internet. However, they are all using a customized Docker image for MariaDB, rather than the [official one](https://hub.docker.com/_/mariadb/). While this may be an easier pattern to follow, it's not ideal because it will force someone to periodically update the custom image in the repository. Delegating this task to my customers would defeat the goal of having something with (almost) zero maintenance requirements, and I definitely can't assume the responsibility for this myself. Instead, by **relying on official images**, that are maintained by the MariaDB and Docker teams directly, one can safely assume that they'll always be up to date and tested.

## Deploy your cluster

Without further introductions, let's dig into the solution.

In this article, we'll be running the MariaDB cluster manually. Part 2, which will be published later on, will instead focus on automation, with scripts to spin up and configure the cluster automatically.

In this example, we're assuming an architecture with 3 servers or VMs, with hostnames `mariadb-node-0`, `mariadb-node-1` and `mariadb-node-2`. We're also assuming that a DNS server exists so that VMs can communicate using their hostname (if your infrastructure does not have a DNS server, using the host file to map names to IPs will work as well).

![Architectural diagram](/assets/docker-galera-arch.jpg)

Each machine is running CoreOS, and each node runs MariaDB containerized and has a full copy of the data. Because Galera Cluster is multi-master, all nodes can accept connections from clients on port 3306 (default for the MySQL protocol); you're free to deploy your own load balancer in front of those endpoints. VMs also need to expose other ports for replication traffic (4567/udp, 4567/tcp, 4568/tcp, 4444/tcp). 

> **Number of nodes**: You'll always need **at least 3 nodes** in order for Galera clusters to run properly. Also, please make sure you design your infrastructure so to avoid the risk of "split-brain conditions": I'll refer you to the [official documentation](http://galeracluster.com/documentation-webpages/weightedquorum.html) for more details.

In each node, create a drop-in configuration file for MariaDB to enable Galera, for example in `/opt/local/etc/mysql.conf.d/mysql_server.cnf`:

    $ cat /opt/local/etc/mysql.conf.d/mysql_server.cnf
    
    #
    # Galera Cluster: mandatory settings
    #
    
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
    wsrep_cluster_address="gcomm://mariadb-node-0,mariadb-node-1,mariadb-node-2"
    wsrep-sst-method=rsync
    
    #
    # Optional setting
    #
    
    # Tune this value for your system, roughly 2x cores; see https://mariadb.com/kb/en/mariadb/galera-cluster-system-variables/#wsrep_slave_threads
    # wsrep_slave_threads=1
    
    # innodb_flush_log_at_trx_commit=0

You'll also need to choose a **path to store the MariaDB data**. This folder is persistent on the host and will be mounted as volume in the containers. In the examples below we'll be using `/mnt/data`. 

    $ mkdir -p /mnt/data

Finally, start the cluster. **On the first node**, and **only for the initial bootstrap**, execute this command:

    $ docker run \
      --name mariadb-0 \
      -d \
      -v /opt/local/etc/mysql.conf.d:/etc/mysql/conf.d \
      -v /mnt/data:/var/lib/mysql \
      -e MYSQL_INITDB_SKIP_TZINFO=yes \
      -e MYSQL_ROOT_PASSWORD=my-secret-pw \
      -p 3306:3306 \
      -p 4567:4567/udp \
      -p 4567-4568:4567-4568 \
      -p 4444:4444 \
      mariadb:10.1 \
      --wsrep-new-cluster \
      --wsrep_node_address=$(ip -4 addr ls eth0 | awk '/inet / {print $2}' | cut -d"/" -f1)

Some notes on the command above:

- Please observe the `--wsrep-new-cluster`, which is used to bootstrap the Galera Cluster. This flag has to be used once and only once. If you need to restart this container in the future, after the cluster has been initialized, you must omit the `--wsrep-new-cluster` flag.
- Because MariaDB is running inside a container, it is not able to get the IP of the host, so we need to pass it using `--wsrep_node_address`. Using `$(ip -4 addr ls eth0 | awk '/inet / {print $2}' | cut -d"/" -f1)` automatically gets the IP of the `eth0` interface; alternatively, you can specify it manually.
- The `mysql_server.cnf` file expects VMs to be named `mariadb-node-0`, `mariadb-node-1` and `mariadb-node-2`. If you wish to rename your machines, make sure you change the values in the configuration file as well. In any case, hostnames must be unique.
- Clients can connect to port 3306, communicating using the standard MySQL protocol. The other ports (4567/udp, 4567/tcp, 4568/tcp, 4444/tcp) are necessary for replication traffic, and your servers or VMs must be able to communicate amongst themselves on those ports too.
- The environmental variable `MYSQL_ROOT_PASSWORD` is for setting an initial password for the `root` MySQL user. Since this value can persist in the container's configuration, as well as in the bash history, I would recommend initializing your database with a generic password and then changing it later using a SQL statement once the cluster is running.
- You need to use the Docker images for MariaDB version 10.1 or higher, as Galera Cluster was not included by default in previous releases. 
- Lastly, the official MariaDB image uses an init script that populates the database with timezone data on creation. Because those tables are created with the MyISAM engine, which is not supported by Galera, we need to skip this part of the init step by passing the `MYSQL_INITDB_SKIP_TZINFO=yes` environmental variable. Failing to do so will cause awful replication issues.

After running the command above, wait a couple of minutes for the Docker engine to pull the image and then for MariaDB to be fully initialized and ready to accept replicas. You can check the logs, waiting for the *"mysqld: ready for connections"* message, with:

    $ docker logs -f mariadb-0

**On the other servers** (and **on the first one after bootstrapping** as well) you can add a member to the cluster with:

    # Touch the mysql data folder so the database is not re-initialized by the init scripts
    $ mkdir -p /mnt/data/mysql
    
    $ docker run \
      --name mariadb-1 \
      -d \
      -v /opt/local/etc/mysql.conf.d:/etc/mysql/conf.d \
      -v /mnt/data:/var/lib/mysql \
      -p 3306:3306 \
      -p 4567:4567/udp \
      -p 4567-4568:4567-4568 \
      -p 4444:4444 \
      mariadb:10.1 \
      --wsrep_node_address=$(ip -4 addr ls eth0 | awk '/inet / {print $2}' | cut -d"/" -f1)

Because the Docker image by default initializes a new database, we are using a trick to make sure that the full init script is not run on replicas: touch the `mysql` data folder. This is located inside the path mounted as volume in the container: for example, if our persistent volume is stored on the host in `/mnt/data`, the data folder will be `/mnt/data/mysql`. Note also the absence of the `--wsrep-new-cluster` flag, and the different node number in the container name.

Once you've started a container in every node, you're ready to start playing with your MariaDB Galera Cluster and testing your applications against it.

You can connect to your database from any client that can interact with MySQL. You can also connect using the MySQL CLI inside a container:

    # The default password in the sample above is "my-secret-pw"
    $ export MYSQL_IP=$(ip -4 addr ls eth0 | awk '/inet / {print $2}' | cut -d"/" -f1)
    $ docker run --rm -it mariadb:10.1 mysql -h $MYSQL_IP -u root -p

Once the interactive MariaDB console appears, you can execute SQL statements. For example:

    # Check Galera Cluster status - three nodes are connected
    MariaDB> SHOW STATUS LIKE 'wsrep_%';
    +------------------------------+-------------------------------------------+
    | Variable_name                | Value                                     |
    +------------------------------+-------------------------------------------+
    | wsrep_apply_oooe             | 0.000000                                  |
    | wsrep_apply_oool             | 0.000000                                  |
    | wsrep_apply_window           | 0.000000                                  |
    | wsrep_causal_reads           | 0                                         |
    | wsrep_cert_deps_distance     | 0.000000                                  |
    | wsrep_cert_index_size        | 0                                         |
    | wsrep_cert_interval          | 0.000000                                  |
    | wsrep_cluster_conf_id        | 3                                         |
    | wsrep_cluster_size           | 3                                         |
    | wsrep_cluster_state_uuid     | 6f43df01-e646-11e5-99fe-17ceb21a5e96      |
    | wsrep_cluster_status         | Primary                                   |
    | wsrep_commit_oooe            | 0.000000                                  |
    | wsrep_commit_oool            | 0.000000                                  |
    | wsrep_commit_window          | 0.000000                                  |
    | wsrep_connected              | ON                                        |
    | wsrep_evs_delayed            |                                           |
    | wsrep_evs_evict_list         |                                           |
    | wsrep_evs_repl_latency       | 0/0/0/0/0                                 |
    | wsrep_evs_state              | OPERATIONAL                               |
    | wsrep_flow_control_paused    | 0.000000                                  |
    | wsrep_flow_control_paused_ns | 0                                         |
    | wsrep_flow_control_recv      | 0                                         |
    | wsrep_flow_control_sent      | 0                                         |
    | wsrep_gcomm_uuid             | 73547b78-e646-11e5-8c8c-476df95214e1      |
    | wsrep_incoming_addresses     | 10.0.0.4:3306,10.0.0.5:3306,10.0.0.6:3306 |
    | wsrep_last_committed         | 4                                         |
    | wsrep_local_bf_aborts        | 0                                         |
    | wsrep_local_cached_downto    | 18446744073709551615                      |
    | wsrep_local_cert_failures    | 0                                         |
    | wsrep_local_commits          | 0                                         |
    | wsrep_local_index            | 1                                         |
    | wsrep_local_recv_queue       | 0                                         |
    | wsrep_local_recv_queue_avg   | 0.100000                                  |
    | wsrep_local_recv_queue_max   | 2                                         |
    | wsrep_local_recv_queue_min   | 0                                         |
    | wsrep_local_replays          | 0                                         |
    | wsrep_local_send_queue       | 0                                         |
    | wsrep_local_send_queue_avg   | 0.000000                                  |
    | wsrep_local_send_queue_max   | 1                                         |
    | wsrep_local_send_queue_min   | 0                                         |
    | wsrep_local_state            | 4                                         |
    | wsrep_local_state_comment    | Synced                                    |
    | wsrep_local_state_uuid       | 6f43df01-e646-11e5-99fe-17ceb21a5e96      |
    | wsrep_protocol_version       | 7                                         |
    | wsrep_provider_name          | Galera                                    |
    | wsrep_provider_vendor        | Codership Oy <info@codership.com>         |
    | wsrep_provider_version       | 25.3.14(r3560)                            |
    | wsrep_ready                  | ON                                        |
    | wsrep_received               | 10                                        |
    | wsrep_received_bytes         | 680                                       |
    | wsrep_repl_data_bytes        | 0                                         |
    | wsrep_repl_keys              | 0                                         |
    | wsrep_repl_keys_bytes        | 0                                         |
    | wsrep_repl_other_bytes       | 0                                         |
    | wsrep_replicated             | 0                                         |
    | wsrep_replicated_bytes       | 0                                         |
    | wsrep_thread_count           | 2                                         |
    +------------------------------+-------------------------------------------+
    57 rows in set (0.00 sec)
    
    # Show all databases
    MariaDB> SHOW DATABASES;
    +--------------------+
    | Database           |
    +--------------------+
    | information_schema |
    | mysql              |
    | performance_schema |
    +--------------------+
    
    # Change password for the root user
    MariaDB> SET PASSWORD FOR 'root'@'%' = PASSWORD('newpass');

*PS: About overlay networks.* Starting from Docker 1.9, a new feature was added to allow cross-host, isolated networking. By using overlay networks, it is not necessary to expose the ports used by Galera for replication on the host and you also do not need a DNS server in the infrastructure. As such, in the first iterations of this article I was actually testing with overlay networks; however, that did not work. For some unknown reasons (a bug?), the initial SST replication over an overlay network made the first host become completely unresponsive and the database crashed. Previous versions of this post on the git repository still show the code used, and I'm open to any comments.


<small>*Cover photo by Rafael Edwards ([Flickr](https://flic.kr/p/poHKaF)) released under Creative Commons BY-NC*</small>