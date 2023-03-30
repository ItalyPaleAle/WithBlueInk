---
title: "A new architecture for Hereditas v0.3"
description: "A proposal for updating Hereditas"
date: 2023-03-29 00:00:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
comments: yes
resourceBundle: hereditas03
coverImage:
  author: "Kaleidico"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@kaleidico"
slug: "hereditas-0.3-architecture-proposal"
---

It's been almost three years since the first release of [Hereditas](https://hereditas.app), v0.1, and almost two since v0.2 came out with some quality-of-life improvements. I still use Hereditas myself, and I know there are at least a few users out there who created their own box, and I'm hope they're pleased with the experience. However, as I've been thinking about what's next for Hereditas, I came up with some ideas for v0.3 and a new architecture.

First, a quick recap to **what Hereditas is**. It's not the easiest thing to describe (even for a former Product Marketing Manager like me), but my best effort was "a generator for static, fully-trustless digital legacy boxes". You can get a full rundown of what Hereditas is in the original [blog post from 2019](https://withblue.ink/2019/03/18/what-happens-to-your-digital-life-after-youre-gone-introducing-hereditas.html).

At a high level you use it to store digital information you want to pass down to other people (e.g. family member) in case you were to suddenly disappear, but without having to trust anyone or any organization with standing access to your data (thanks to a time-locked box), and without having to maintain complex infrastructure (because what it creates is just a static website that can be put pretty much anywhere and you can then forget about it).

**I am looking for your feedback**. This document is what I'm currently thinking about, but some changes are significant and I may not have the right answers yet. You can find a place to discuss [on this issue on GitHub](https://github.com/ItalyPaleAle/hereditas/issues/50) as well.

## The current architecture

To understand the architecture of Hereditas, you need to know there are four core pillars in the project:

1. The first and most important is the **security model**, which allows Hereditas to be fully-trustless.  
   There are four actors involved with Hereditas: yourself (the _owner_), the users you may wish to grant access to (one or more _viewers_), the service that hosts the statically-generated pages (the _host_), and another service that allows for the timed unlock functionality (the _vault_). Aside from yourself, no other party has standing access to the data contained in your Hereditas box, which is encrypted with strong encryption (AES-GCM with a 256-bit key). The viewers have "half" of the key, and the other "half" is stored in the vault service, which releases it to the viewers only after a certain amount of time (during which you, the owner, can stop this from happening). The vault never sees the other "half" of the key the viewers have, and the host never sees _anything_ besides encrypted blobs.
2. Hereditas also includes a **static web app**, which has always been built with Svelte. Your data gets encrypted, then bundled together with the static web app and served by the host. All information contained in the bundle is either not-secret (the code of the web app itself), or encrypted with strong encryption. Going back to the security model, if an unrelated person were to get access to this bundle, they would not be able to do anything with it–even attempting to "brute force" the encryption key would be a pointless effort, estimated to take longer than the expected lifespan of the Universe even with the most powerful computers we have (and even with quantum computers, when they'll finally arrive).
3. The **vault service** itself is one of the core pillars. Since the first version of Hereditas, I designed it to rely on the free Auth0 service to provide both identity and access management, and to release the "half" of the key only after a given amount of time. I will put the webhook service (the recommended one being IFTT, but others are supported too) in here, as it's used to send important notification to the owner such as when a viewer is trying to unlock the box.
4. Lastly, Hereditas comes with a **CLI** which puts all pieces together: it encrypts the data, builds the static web app, and even interact with the vault service (Auth0) to set up the required pieces, store the "half" of the key, add and remove viewer users, etc.

Of course, three years is a very long time in technology, and as I think back to this, there are a few things that I think could be improved on.

The dependency on Auth0 was always a known "issue" ([#2](https://github.com/ItalyPaleAle/hereditas/issues/2)). It's not that their service is bad or that they can't be trusted; the great thing about Hereditas is that you really don't have to trust anyone, anyways, as even the Auth0 staff wouldn't have enough information to open your box.

However, Hereditas depending on Auth0 requires users to manage an account on their platform, involves doing something that's not arguably what Auth0 originally designed for, and adds a fairly high amount of complexity. Hereditas is also designed to be as much "set it and forget about it" as possible, and depending on an external company adds risks such as them changing the underlying technology or possibly even their business model (and there was some fear of that happening when they got bought by Okta a few years back, although thankfully things are still fine for using Hereditas).

The second major decision I'm not very happy about is that the architecture of the CLI, which was written in JavaScript for running on Node.js and imports the entire Webpack in it. Nothing wrong with Node.js or JavaScript, but this does add the complexity for users who need to make sure that they have Node.js installed, then I need to make sure the code continues to run even on newer versions of the interpreter, and most importantly, I need to keep up with updates in the JavaScript ecosystem (which moves at pretty much the speed of sound)! The primary reason for publishing Hereditas v0.2, in fact, was updating Svelte from version 2 to 3, which was a complete rewrite; a lot of dependencies should be updated now and which I haven't kept up-to-date (_but nothing that would put the safety of your data at risk_); as of writing, then, Webpack is now too slow and "uncool" and we should switch to _some other bundler_.

In general, there's no reason why we need the Hereditas CLI to ship a bundler and the raw, un-compiled Svelte files: nothing stops us from pre-bundling the static web app and then just having the CLI "put the pieces together", i.e. putting the your (encrypted) data alongside the app.

## What's not changing in v0.3

Onto the plans for the future, then. First, let's start with what's **not** going to change, or at least not significantly.

First, the **security model**. Hereditas' security model continues to be appropriate and as far as I know, there's no major flaw with it (_if you do find a flaw in it, please do let me know–confidentially_).

One minor thing that I am planning on changing with regard to the security model is that each viewer user will have a different key (for the "half" that viewers own), and those keys will be automatically generated by the CLI rather than inputted by the owners. Although there's _also_ a technical reason for doing this (more on that below), the primary motivation is that humans are terrible at picking passwords and we should let computers use their randomness instead. The CLI will generate a number of "seed words" from the same wordlist used by cryptocurrency wallets, although derived in a different way (more on this below).

The other thing that will **not** change significantly is the **static web app**. Aside from some possible refinements, I'm planning to leave the Svelte code mostly untouched in this release. It's not that there isn't room for improvement, but Hereditas v0.3 is about re-architecting, and improvements to the static web app are more in the realm front-end work, and it's still "good enough" for now.

## A new vault service

Ok, so onto what's _actually_ changing in Hereditas v0.3.

The first thing is a new vault service. As explained earlier, the dependency on Auth0 is, in my opinion, Hereditas' biggest weakness at the moment, and to put it simply, it has to go.

The new vault service will be created specifically for the needs of Hereditas. It will be available as a public service, or it can be self-hosted. My idea is to host this on Cloudflare Workers, which seems an appropriate platform given it's fully-managed, has a promise for long-term compatibility, and it's cost-effective, which is especially relevant for operating a free service. The Workers runtime is also open source (workerd) so it can allow users to self-host the vault service, if they wish.

This service will allow storing keys (the "half" of the key that viewers don't already have) and will serve it to users only after a delay, just like Hereditas is relying on Auth0 for today.

- Anyone can create a new "item" in the vault and gets a secret admin key that is used to perform admin-level operations on that item in the vault.
- You can store a key in the item, and configure the list of owners (when they sign in, the vault gives them the key immediately) or viewers (after they sign in the first time, they need to wait a certain amount of time, for example 48 hours, before the vault gives them the key–unless an owner stops that from happening).
- Users sign in by typing their email address. If the email matches one of those in the list of owners or viewers, they receive a "one time password" over email to verify it's actually them. Signing in is required before the vault can give them the key (or start the timer before the key is made available).

Additionally, this vault includes a number of new features that weren't otherwise possible with Auth0:

- Items can be set to self-destroy after a certain amount of time, after which the keys cannot be retrieved by any user (owner or viewer).
- Each owner and viewer now has their own key, separate from anyone else's, for increased security.
- Notifications (which are sent to owners after a viewer signs in, giving the owner a chance to stop the vault from releasing the key to viewers) are sent directly by the vault, rather than relying on IFTT. Supported notification methods will initially include webhooks (to Slack, Discord, or any other HTTPS endpoint) and emails; more can be added in the future. Additionally, owners can configure the vault to send more than one kind of notification, to make sure they do not lose them.

The vault service is designed to be privacy-first and doesn't store any data it doesn't need, such as your name or IP address. It also encrypts or hashes everything that is sensitive or personally-identifiable, so it cannot be recovered by anyone without a key: either the admin key, or a user (owner/viewer) key. I am not in the business of selling or even collecting your data; I actually don't want your data, which would otherwise require me to deal with privacy regulations and have meetings with lawyers I'd rather not have! _(Nothing against lawyers!)_

Just like with using Auth0, you don't need to trust the new vault service, or trust me or anyone else as the person operating it. The "key" stored in the vault is only "half" of the actual key used to decrypt your Hereditas box, so even if the operator were to do something foolish or if the vault were to be compromised, nothing bad would happen to your data.

Even so, you can still self-host your own vault service and run it for yourself.

> [Issue #2](https://github.com/ItalyPaleAle/hereditas/issues/2) on GitHub mentioned looking into whether we could change Hereditas to not use a vault service at all. To this day, three years later, I still haven't been able to find a way to do that, as for Hereditas' security model it is necessary that the "half" of the key stored in the vault not be publicly-accessible until the vault releases it (for example, to viewers after a delay).  
> This is why something blockchain-based would not work, technically, in addition to offering a really bad experience for end users (_plus, I have since come to learn that blockchains are almost never a solution!_).

## A CLI rewritten in Go

The second big change will be a rewrite of the CLI.

Of course, the CLI will need to change quite a bit to support the new vault service, which is managed in a very different way from how the current CLI manages Auth0. Because managing the vault server is the biggest of the 3 jobs the CLI has (the other two being creating the static web app bundle and encrypting the data), this is an opportunity to simplify how the CLI works and how it is used as well.

First, out with Node.js, and in with Go. Node.js is great, but it's not ideal to create CLIs as it requires users to have an interpreter installed, needs work on my end to ensure compatibility with a variety of Node.js versions, and in general is not the best experience for a CLI user.

Rewriting the CLI in Go will allow publishing self-contained binaries, so users can download one single file and it will just work on their machine. Although not a strict requirement, it's also going to make the CLI faster, since it doesn't have to load thousands of files on every invocation.

Next, as briefly mentioned above, the CLI will change how it generates the bundle for the static web app. Rather than shipping the raw, uncompiled Svelte files and have a bundler (such as Webpack or esbuild) run on the client, the CLI will come with the static web app pre-compiled, and will just "link" the data to it. This is going to be faster, but even more importantly, simpler and with less room for runtime issues.

Lastly, on the data encryption side, as mentioned the only change will be that the CLI will now automatically generate encryption keys for users (such as viewers when they want to unlock your Hereditas box), as computers can generate keys with much more entropy, which are inherently more secure.

Keys are then going to be presented to users as "seed words", using the same encoding that blockchains like Bitcoin and Ethereum use to allow people to remember the private keys of their wallet. The [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) standard is in my opinion quite brilliant: it offers a way to encode random keys in a much more user-friendly way, with built-in checksumming, and using a wordlist where each word has been carefully chosen according to some [human-centered properties](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki). There are [wordlists](https://github.com/bitcoin/bips/blob/master/bip-0039/bip-0039-wordlists.md) in a variety of languages too, for those who prefer to type the seed words in something else than English. Although the plan is to use the encoding and wordlist from BIP-39, Hereditas is not a cryptocurrency wallet, so the words are going to be generated in a different way, and used for a different purpose.

## Your feedback

This post contains the high-level plan for the design of Hereditas v0.3. I am purposely not getting too much into the details here as there's still plenty that will change as development continues.

I also don't have a specific timeline to share, as that depends a lot on how things go with… _(waving hands)_… life.

Feel free to comment here or [on this issue on GitHub](https://github.com/ItalyPaleAle/hereditas/issues/50) if you have any question or thought about this plan, as I'm looking forward any feedback!
