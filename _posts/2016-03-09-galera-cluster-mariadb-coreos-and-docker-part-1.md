---
layout:     post
title:      "Galera cluster, MariaDB, CoreOS and Docker (Part 1)"
subtitle:   "Get your multi-master MySQL-like cluster painless"
date:       2016-03-09 14:30:00
author:     "Alessandro Segala"
header-img: "img/containers.jpg"
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

In this article, we'll be running the MariaDB cluster manually. Part 2, which will be published later on, will instead focus on automation, with scripts to spin up and configure the cluster automatically.

In this example, we're assuming an architecture with 3 servers or VMs, with hostnames `mariadb-node-0`, `mariadb-node-1` and `mariadb-node-2`. We're also assuming that a DNS server exists so that you can connect to VMs using their hostname (if your infrastructure does not have a DNS server, using the host file to map hostnames to IPs will work as well).

![Architectural diagram](/assets/docker-galera-arch.jpg)

Each machine is running any Linux distribution capable of supporting Docker: for example CoreOS, Ubuntu, CentOS or any other as you prefer. Each node runs MariaDB containerized and has a full copy of the data. Because Galera Cluster is multi-master, all nodes can accept connections from clients on port 3306 (default for the MySQL protocol); you're free to deploy your own load balancer on those endpoints. Each VM also needs to expose other ports for replication traffic (4567/udp, 4567/tcp, 4568/tcp, 4444/tcp). 

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

You'll also need to choose a **path to store the MariaDB data**. This folder is persistent on the host and will be mounted as volume in the containers. In the examples below, we'll be using `/mnt/data`. 

    $ mkdir -p /mnt/data

Eventually, start the cluster. **On the first node**, and **only for the first bootstrap**, execute this command:

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

A few notes:

- Please note the `--wsrep-new-cluster`, which is used to bootstrap the Galera cluster. This flag has to be used once and only once. If you need to restart this container in the future, after the cluster has been initialized, you must omit the `--wsrep-new-cluster` flag.
- Because MariaDB is running inside a container, it is not able to get the IP of the host, so we need to pass it using `--wsrep_node_address`. Using `$(ip -4 addr ls eth0 | awk '/inet / {print $2}' | cut -d"/" -f1)` automatically gets the IP of the `eth0` interface; alternatively, you can specify it manually.
- The `mysql_server.cnf` expects VMs to be named `mariadb-node-0`, `mariadb-node-1` and `mariadb-node-2`. If you wish to rename your machines, make sure you change the values in the configuration file too. In any case, hostnames must be unique.
- You can set the password for the root MySQL user in the environmental variable `MYSQL_ROOT_PASSWORD`. You can always change the password later, running SQL statements on the database.
- Clients can connect to port 3306, communicating using the standard MySQL protocol. The other ports (4567/udp, 4567/tcp, 4568/tcp, 4444/tcp) are necessary for replication traffic, and your servers or VMs must be able to communicate among themselves on those ports too.
- You need to use the Docker images for MariaDB 10.1 or higher, as Galera Cluster was not included by default in previous versions.
- The environmental variable `MYSQL_ROOT_PASSWORD` is setting an initial password for the `root` MySQL user. Since this value can persist in the container's configuration, as well as in the bash history, I would recommend initializing your database with a generic password, then changing it later using a SQL statement once the cluster is running. 
- Lastly, the official MariaDB image uses an init script that populates the database with timezone data on initialization. As those tables are created with the MyISAM engine, which is not supported by Galera, we need to skip that step by passing the `MYSQL_INITDB_SKIP_TZINFO=yes` environmental variable. Failing to do so will cause nasty replication issues.

After running the command above, wait a couple of minutes for the Docker engine to pull the image, and then for MariaDB to be fully initialized and ready to accept replicas. You can check the logs, waiting for the "mysqld: ready for connections" message, with:

    $ docker logs -f mariadb-0

**On the other servers** (and **on the first one after bootstrapping too**) you can add a member to the cluster with:

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

Because the Docker images by default initialize a new database, we are using a trick to make sure that on replicas the init script is not run: touch the MySQL data folder. This  is located inside the volume that is mounted in the container: for example, if our persistent volume is stored on the host in `/mnt/data`, the data folder will be `/mnt/data/mysql`. Note also the absence of the `--wsrep-new-cluster` flag, and the different node number in the container name.

Once you've started the containers in every node, you're ready to start playing with your MariaDB Galera Cluster and test your applications against it.

You can connect to your database from any client that can interact with MySQL. You can also connect using the CLI inside a container:

    # The default password in the sample above is "my-secret-pw"
    $ export MYSQL_IP=$(ip -4 addr ls eth0 | awk '/inet / {print $2}' | cut -d"/" -f1)
    $ docker run --rm -it mariadb:10.1 mysql -h $MYSQL_IP -u root -p

Once you're connected using the MySQL CLI, you can execute SQL statements. For example:

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

*PS: About overlay networks.* Starting from Docker 1.9, a new feature was added to allow cross-host isolated networking. By using overlay networks, it's not necessary to expose the ports used by Galera for replication, and you don't need a DNS server in the infrastructure too. As such, in the first iterations of this article I was actually testing overlay networks; however, that did not work. For some unknown reason (a bug?), SST with an overlay network made the first node become completely irresponsive and the database crashed. Previous versions of this post on the git repository still show the code used, and I'm open for any comment.


<small>*Cover photo by Rafael Edwards ([Flickr](https://www.flickr.com/photos/rafa2010/15353313381/in/photolist-poHKaF-frZLn-8WrP2L-seswjC-fa91Di-4fsVgK-bPT3Tv-fa8Y5M-9va4X1-4fwSUA-Gadgr-4tL91Y-rtYTH8-c9oTiN-b6eF7v-dyXEnF-8jnVdm-aYqgh-aYqgo-aYqgB-esVtg5-k6NoT-4Rtnhv-Lkro7-sJXo9s-aYqfZ-s61xsm-e565pj-8Vof66-dBwGMX-bhvrV4-gstz6-aYqgZ-cZiGr-8cQcJs-dCEKTL-3bvxLV-7tecRV-a55BNX-bCjuKC-Rxh2G-b5YXVt-bRecDM-PzKg9-4mD8xu-e7HHXV-6egeNk-8PgyLQ-5wUsYz-sqBpt3)) released under Creative Commons BY-NC*</small>