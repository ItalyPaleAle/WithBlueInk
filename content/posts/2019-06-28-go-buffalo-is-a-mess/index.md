---
title: "Go Buffalo is a mess"
description: "Some thoughts on Buffalo and why I rewrote my app with Gin"
date: 2019-06-28 07:40:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
image: "img/buffalo.jpg"
comments: yes
coverImage:
  author: "elCarito"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@elcarito"
---

In the last couple of months I've decided to use Go to build a new background service, with a RESTful API to control it (*at this point it's around 90% complete, but it's already in my GitHub repo if you're curious!*). Despite a few bumps at the beginning, picking up the language was relatively easy; choosing a web framework, however, not so much.

Compared with what's available to JavaScript developers, the choice of frameworks for Go is quite limited. Most importantly, there isn't yet something "standard" that all or most developers use. I followed some advice from friends and colleagues and decided to go with [Buffalo](https://github.com/gobuffalo/buffalo).

I had high hopes and high expectations. With many high-profile *gophers* advocating for Buffalo too, how would I not?

Turns out: *all that glitters is not gold*.

In short: Buffalo is a sort of a mess. Two months into the development, when the project was already in an almost complete state, I scrapped Buffalo and replaced it with the far more mature [Gin](https://github.com/gin-gonic/gin).

## My experience

Some thoughts from my experience building a RESTful API with Buffalo:

### The documentation is terrible

…with lots of things missing or very poorly documented. For example, getting Pop (the built-in ORM to connect to the database, a rather critical component) to work was a painful process. The best documentation for Pop was actually an [unofficial book](https://andrew-sledge.gitbooks.io/the-unofficial-pop-book/content/), which was not always up to date either.

I ran into lots of other issues for which the only help came from past GitHub issues or some very helpful developers on the Gophers Slack channel. This included things such as cross-compiling for ARM, for example.

### Dependencies are a mess

**Buffalo is insanely bloated**.

Go developers like to make fun of JavaScript and npm for how large `node_modules` folders get. Buffalo is worse.

With my codebase using Buffalo, running `go get` downloaded **almost 1200 packages** and took an average of 3.5 minutes in the CI server. I worked to speed this up as much as possible, by installing the Buffalo CLI (required to build apps) using the pre-compiled binary downloaded from GitHub, or that would have been a few more minutes and hundreds more packages. Vendoring the dependencies wasn't an option, as it caused compilation to fail every time.

![Installing almost 1200 packages in the CI](/assets/buffalo-ci.jpg)

After switching the same app to Gin, the `go get` step in the CI server runs in just over 2 minutes (~40% less) and uses only 350 packages.

But, even forgetting the amount of dependencies: the way Buffalo deals with them is **a mess in general**. Every time I ran `buffalo build` it would try to fetch new packages, and some of them didn't even exist (I still don't understand how that worked). Trying to vendor the dependencies using `go mod vendor` and then building using the vendor folder (with the `-mod=vendor` flag) caused the compilation to fail every time because of some unresolved dependencies.

Lastly, at times dependencies fetched from the Internet just randomly broke, with packages defined in `go.sum` failing validation (checksum mismatch) despite being on the same version. I had to re-create the `go.mod` and `go.sum` files a bunch of times.

### It's quite buggy

In two months, I found quite a bunch of bugs in Buffalo and other packages in its ecosystem, including Pop, Packr, etc.

For example, despite setting my default renderer to JSON, all error pages (including 404's, 500's, etc) rendered as HTML. Since I was building an API server, this was quite annoying.

A framework is the foundation of a web app. My code has enough bugs in it already, and I need the underlying framework to be stable and well-tested. The first public version of Buffalo came out in December 2016, so it's not really a project in its infancy either.

## Switching to Gin

Switching the codebase to Gin wasn't completely painless. The hardest part was swapping the ORM from Pop to [GORM](https://github.com/jinzhu/gorm). However, it wasn't as daunting as a task either.

I found Gin to have much better documentation, with examples for almost everything you might need to do. It's also much leaner and comes with less than one third of the dependencies of Buffalo. And it doesn't require an additional CLI installed in the system to build apps.

The maintainers of Buffalo have big goals: they want to create something like Django or Rails for Go. However, Buffalo so far seems optimized for small, monolithic websites that output complete HTML pages, rather than RESTful microservices. And they need to work on some core issues, making the framework leaner and more stable.

As for the high-profile *gophers* who were strongly advocating for Buffalo: I spoke with a couple while writing this article, and they told me they've changed their mind themselves.
