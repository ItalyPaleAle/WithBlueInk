---
title: "High Availability over Tailscale with DNS-based Load Balancing"
description: "Using ddup for DNS load balancing and failover"
date: 2025-09-23 00:00:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
comments: yes
resourceBundle: ddup
coverImage:
  author: "Caden Tormey"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@cjtormey"
slug: "ddup-high-availability-tailscale-dns-load-balancing"
---

I have been a  Tailscale user and fan for a few years now. I rely on my Tailnet extensively to connect to my homelab and other devices, securely from anywhere. Lately, I've run into a limitation: making services highly available (HA) over Tailscale isn't straightforward.

For example, I have a highly-available MinIO cluster across three nodes, and I also wanted a reliable way to proxy into my UniFi console from multiple nodes (all running Traefik). Ideally, both of these endpoints (and a few more) needed to stay available even if one machine failed.

## Why HA over Tailscale is hard

Tailscale doesn't expose a feature like a "virtual IP" or "anycast address" that can move around between nodes. Every node gets its own `100.x.y.z` IP (or a similar IPv6). That means there's no built-in way to say *"send traffic to whichever of these three nodes is alive."*

A common workaround is to put a **reverse proxy** or load balancer in front: something like HAProxy, Traefik, or nginx. While this works, it introduces a new single point of failure. Making the proxy itself highly available requires load balancing it as well, which quickly becomes recursive. It also adds another moving part to maintain. In practice, this goes against the goal of keeping the system lightweight and reliable.

## DNS to the rescue

Instead of inventing a new network-level mechanism, I turned to DNS. The core idea is to keep a list of all the nodes where the app runs, and configure DNS so that the app's hostname (e.g. `minio.mydomain.xyz`) resolves to the Tailscale IPs of all healthy nodes. Clients will then pick one of the returned IPs; most resolvers randomize or rotate through them.

This achieves both load balancing, because different clients end up on different nodes, and failover, because if a node goes down its IP can be removed from DNS and new connections will land on surviving nodes.

This approach isn't instant failover, as clients may cache DNS records for a while, depending on the TTL , but in practice it was well suited for my needs. I don't need sub-second failover: if it takes a minute or two for clients to retry and land on another node, that's acceptable. What I do need is a setup with no extra proxy to manage, no single point of failure (at least, not an additional one), and something I can count on to keep running without much effort. DNS fits that model well.

And while I have been using it for Tailscale IPs, the same idea works just as well for public IPs or even **LAN-only IPs**, as long as you are comfortable with those IPs being stored in a public DNS provider like Cloudflare, Azure DNS, etc.

## Why not run my own DNS server?

At this point you might ask: why not just run an authoritative DNS server with health checks? That is, a DNS server which your clients can connect to when they need the *authoritative* (i.e. "official") IP for your domains or sub-domains.

That's a valid approach, and there are good projects out there that do it like [ddclient](https://github.com/ddclient/ddclient). However, I didn't want to run a DNS server 24/7, make it highly available, and keep it patched and secured.

Because of how the DNS infrastructure works, you also need to make it so your clients connect to your authoritative DNS server. For that, you can go with either one of two options, each coming with trade-offs:

1. You can keep the DNS server private, configuring whatever DNS resolver you use to connect to your authoritative server on the private IP. This can be done in multiple ways, but no one is free of downsides.  
  A network-wide DNS resolver configured in your firewall/router (think of running a PiHole server at home) works for all devices in the LAN, but not when you're outside. While in theory you could connect to that DNS server remotely, that would add latency and other points of failure.  
  Or, you can run a local DNS resolver (like dnsmasq) on your clients, but it requires configuring each client individually. In my case, that was not convenient or even possible (like on my phone)
2. Alternatively you can use zone delegation to make your DNS server the authoritative one for public domains. For example, if you own `mydomain.xyz` you can delegate `home.mydomain.xyz` to your authoritative DNS server.  
  However, this typically requires exposing your DNS server on the public Internet, which requires additional work on securing it and making it highly available. For my needs, that would have added more operational overhead than it solved.

## Building `ddup`

So I wrote my own tool: [`ddup`](https://github.com/ItalyPaleAle/ddup). At its core, `ddup` runs health checks against my services, talks to an external DNS provider, and updates the DNS records for my app to contain the set of healthy nodes.

Currently, ddup supports these providers:

- Azure DNS
- Cloudflare
- OVH

That's it: no servers to run, no daemons to babysit… just a small process that ensures DNS always reflects the current state of the cluster.

Because it uses a public provider, I also get highly available DNS infrastructure, built-in caching and distribution, and no operational burden on my side.

While my primary use case is Tailscale IPs, it works just as well with public or private IPs (like LAN-only services), as long as your ddup service can connect to them.

{{< img src="ddup-dashboard.webp" alt="Screenshot of the ddup dashboard showing the health and status of various endpoints" caption="ddup also includes a web-bashed dashboard to monitor the state of the endpoints" >}}

## Using `ddup`: a quick walkthrough

Here's an example of setting up ddup to work with Cloudflare DNS to point `minio.mydomain.xyz` to 3 Tailscale IPs (`100.101.102.1`, `100.101.102.2`, `100.101.102.3`).

First, grab a pre-built ddup binary from the [releases page](https://github.com/ItalyPaleAle/ddup/releases) on GitHub.

Alternatively, you can use Docker/Podman:

```bash
docker run \
  -d \
  --read-only \
  -v $HOME/.ddup:/etc/ddup:ro \
  ghcr.io/italypaleale/ddup:0
```

`ddup` uses a YAML config file; you can find a [full sample](https://github.com/ItalyPaleAle/ddup/blob/main/config.sample.yaml) in the GitHub repo. Here's an example for a 3-node Minio cluster:

```yaml

interval: 30s

domains:
  - recordName: "minio.mydomain.xyz"
    provider: "cf-mydomain-xyz"
    ttl: 120
    healthChecks:
          timeout: "2s"
          attempts: 2
    endpoints:
      - url: "https://100.101.101.1:9000/minio/health/live"
        ip: "100.101.101.1"
        host: "minio.mydomain.xyz"
      - url: "https://100.102.102.2:9000/minio/health/live"
        ip: "100.102.102.2"
        host: "minio.mydomain.xyz"
      - url: "https://100.103.103.3:9000/minio/health/live"
        ip: "100.103.103.3"
        host: "minio.mydomain.xyz"

providers:
  cf-mydomain-xyz:
    cloudflare:
      apiToken: "your-cloudflare-api-token"
      zoneId: "your-zone-id"

server:
  enabled: true
  bind: "0.0.0.0"
  port: 7401
```

This configuration checks the `/minio/health/live` endpoint on each node at the given interval. If it passes, includes that node's Tailscale IP in the DNS record for `minio.mydomain.xyz`.

You can test that domains are updated with:

```bash
dig minio.mydomain.xyz
```

You should see multiple A records, one per healthy node. If you shut down a node, after the next check cycle its IP will disappear.

## Trade-offs to be aware of

DNS-based load balancing has limitations. The main one is that failover isn't instant, because it is limited by DNS TTL and caching: some clients may continue to use a failed IP until they retry. You also don't get fine-grained control over traffic distribution. But in many cases, including homelabs, self-hosted apps, even some production workloads, that's an acceptable trade-off for the simplicity it brings.

[ddup](https://github.com/ItalyPaleAle/ddup) is still new, but it's been running reliably in my setup. If you need HA over Tailscale, or even just for some public or LAN-only services, give it a try and see how it works for you… and let me know if it helped!
