---
title: "What happens to your digital life after you're gone? Introducing Hereditas"
description: "An open source static site generator for a fully-trustless digital legacy box"
date: 2019-03-18 07:00:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
image: "img/hereditas.jpg"
comments: yes
coverImage:
  author: "ian dooley"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@sadswim"
resourceBundle: hereditas
---

## What happens after you're gone?

All countries, cultures and religions have laws and customs for dealing with your legacy, including your physical inheritance (your wealth) as well as your moral one. However, there's a new kind of legacy we're totally not prepared for: our digital one. As we rely more and more on technology and the Internet, we are also protecting our digital assets with passcodes, passwords or biometrics like fingerprints, which are challenging to pass along.

How will your partners, children, and loved ones, get access to your digital life when you die? How will they get to see your photos on the cloud, inherit your cryptocurrency investments, or resolve your online profiles?

Some may decide to share their passwords with their significant others, like husbands or wives. Security experts would argue that this is an unsafe behavior, as the more people know your passwords (or have them stored somewhere), the more likely it is that they could get stolen. When people share passwords they're also harder to change, and it is more challenging to use important security features like Multi-Factor Authentication, biometrics, etc.

There are ways to mitigate these risks (e.g. sharing a password manager), but they're not risk-free either. For example, your relationship might end abrutedly, and your (now ex) partner who has access to your passwords could damage you, your reputation and your finances significantly. Even if you have complete trust in your significant other and you believe that your relationship will never end, you need to realize that a single other person having access to your life is still not enough redudancy; and adding a third person or more would just amplify the security risks even further.

You could also decide to give your digital information to a trusted third-party, for example a lawyer. This is not free of downsides too: setting aside the risk that the third-party could act maliciously, this can be expensive and you won't be able to update the information stored with them as frequently or timely as you might need to.

## Introducing Hereditas

[Hereditas](https://hereditas.app), which means *inheritance* in Latin, tries to solve these problems, which are caused by technology, with technology.

{{< img src="hereditas-logo.png" alt="Hereditas logo" link="https://hereditas.app" >}}

It is not the first solution that tries to solve the problem of your digital legacy with code. However, the innovation of Hereditas is in the fact that it doesn't require you to trust another person or provider, and that once you set it up, it will require virtually no investment of money or time to keep it running.

### How is Hereditas different?

Hereditas is a static website generator that takes text you write (including Markdown) and other files, encrypts them in a safe way, and outputs a static HTML5 app that you can host anywhere.

Hereditas is different from other solutions thanks to three design principles:

* **Fully trustless–really**: No other person or provider has access to your data inside an Hereditas box.
* **Simple for your loved ones:** We designed Hereditas so it's simple to use for your loved ones when they need to access your digital legacy box, even if they're not tech wizards. A web browser is all they need.
* **No costly and/or time-consuming maintenance:** You don’t want to rely on a solution that you’ll have to keep paying and/or patching for the rest of your life (and in this case, we mean that literally). Hereditas outputs a static HTML5 app that you can host anywhere you’d like, for free or almost.

Naturally, **Hereditas is fully open source**, and the source code is available on GitHub at [ItalyPaleAle/hereditas](https://github.com/ItalyPaleAle/hereditas), released under GNU General Public License (GPL) version 3.0. The CLI is written using Node.js, and the static web app is built with HTML5.

### How does Hereditas work?

Watch this short demo video:

{{< youtube lZEKgB5dzQ4 >}}

With Hereditas, you can write the content you want to share and use the CLI to build a box, which is a static HTML web app. You can deploy it anywhere you'd like (including object storage providers like Azure Storage or Amazon S3, which are essentially free), then share the link and a *user passphrase* with your loved ones.

People who you share the *user passphrase* with, however, do not have standing access to your data. They will first need to request access to it (logging in with an account you whitelist, could be a Google, Facebook, or Microsoft account, among others) and then wait a certain amount of time, for example one day or more.

When someone logs in and requests access, you receive a notification, giving you the opportunity to stop unauthorized attempts to read your data by logging in yourself. Otherwise, after the delay has passed, your users will automatically be able to unlock the box with the *user passphrase*.

### Get started with Hereditas

Here are some links to get started with Hereditas:

🚀 [**Get started guide**](https://hereditas.app/guides/get-started.html)

🔐 [**Security model**](https://hereditas.app/introduction/security-model.html)

📘 [**Documentation and CLI reference**](https://hereditas.app)

🖥 GitHub: [**ItalyPaleAle/hereditas**](https://github.com/ItalyPaleAle/hereditas) (GPLv3)
