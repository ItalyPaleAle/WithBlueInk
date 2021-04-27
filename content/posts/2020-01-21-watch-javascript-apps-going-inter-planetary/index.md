---
title: "Watch: JavaScript apps going Inter-Planetary"
description: My talk at Node+JS Interactive 2019
date: 2020-01-21 00:00:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
comments: yes
coverImage:
  author: "Michael Descharles"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@michael_exploring"
resourceBundle: node-talk
---

Last December, I gave a talk at Node+JS Interactive in Montreal, with the title **_JavaScript apps going Inter-Planetary_**.

I was very excited to have the opportunity to speak for the first time at a large tech event, and I got to explain and demo something I'm very passionate about: building static web apps for the Distributed Web, and making them "production ready".

After briefly explaining **what is the Inter-Planetary File System** (IPFS) and how to interact with it, I showed how to **run a static JavaScript app** ([JAMstack]({{< ref "2019-11-16-your-next-app-may-not-have-a-backend" >}})) deployed through IPFS.

To make that app accessible to anyone in an easy manner, I then introduced using public **IPFS gateways** with Cloudflare, and **simpler URLs** thanks to the IPNS, or Inter-Planetary Name Service.

Lastly, I demoed how you can enable a full DevOps pipeline with **Continuous Integration and Continuous Delivery**, to automatically publish apps on the IPFS network.

📺 The full talk was recorded and is now on YouTube:

{{< youtube OY-YnkVHJcc >}}

🖥 You can also find all the [slides in PDF here](https://static.sched.com/hosted_files/njsi2019/0f/JavaScript%20Apps%20Going%20Inter-Planetary.pdf).

🧑‍💻 The code used for the demo, as well as all the instructions to replicate it yourself, are published on GitHub at **[ItalyPaleAle/calendar-next-demo](https://github.com/ItalyPaleAle/calendar-next-demo)**.

📖 Lastly, if you're interested in reading more, check out my other articles about IPFS:

- [Distributed Web: host your website with IPFS clusters, Cloudflare, and DevOps]({{< ref "2018-11-14-distributed-web-host-your-website-with-ipfs-clusters-cloudflare-and-devops" >}})
- [Hugo and IPFS: how this blog works (and scales to serve 5,000% spikes instantly!)]({{< ref "2019-03-20-hugo-and-ipfs-how-this-blog-works-and-scales" >}})

Hope you enjoy the content, and let me know if you have any feedback!
