---
title: "Essential Cryptography for JavaScript Developers"
description: "Here's what my second book is about, and why I wrote it"
date: 2022-03-01 00:00:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
comments: yes
resourceBundle: cryptobook
coverImage:
  author: "Taylor"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@taylor_08"
slug: "essential-cryptography-for-javascript-developers-book"
---

{{< img src="bookcover.jpg" alt="Book cover for 'Essential cryptography for JavaScript developers'" class="float-right w-56 pl-4 md:pl-8 md:w-72" link="https://packt.link/AcgWC" >}}

In the fall of 2020, my first book came out: [_Svelte 3 Up and Running_](https://www.amazon.com/dp/1839213620/ref=cm_sw_em_r_mt_dp_PVHQQYG2TK3PRFYHGTRK), published by Packt. When one of their acquisition editors contacted me some months prior, I was not new to writing, having blogged for many years, but the idea of writing an entire technical book was fascinating to me—and working with a reputable publisher like Packt seemed like a fantastic opportunity to try something new.

While writing about Svelte 3 was fun, shortly after the first book hit the (virtual) shelves, I had already an idea for a second one that I pitched to Packt: I wanted to write about cryptography, creating a handbook that was specifically meant for software developers.

I'm proud to share with you that this second book is now complete: **Essential Cryptography for JavaScript Developers**. You can find it [on Amazon](https://packt.link/AcgWC).

## What the book is about

Obviously, my second book is about cryptography. However, it takes the somewhat unique approach of being written for an audience of software developers who may not have any background in cryptography, and yet they are interested in learning how to adopt common cryptographic operations in their applications, safely.

Throughout the book we focus on learning about four common cryptographic operations:

- **Hashing**: A set of functions that allows generating a unique _hash_ (also called _digest_ or _checksum_) that is always of a fixed length. Unlike encryption, hashing is one-way: that is, it's an operation that cannot be reversed. Its uses include verifying the integrity of messages and files, generating unique identifiers, protecting passwords stored in databases, and deriving encryption keys from passwords.  
  In the book, we cover algorithms such as SHA-2, scrypt, and Argon2… and we look at why outdated algorithms like MD5 and SHA-1 are not to be used anymore.
- **Symmetric encryption**: This is about encrypting (and decrypting) data using a symmetric key: i.e. using the same key for both encryption and decryption. Most people are familiar with this concept, for example when they protect a ZIP file with a passphrase.  
  In the book we cover how to encrypt and decrypt messages and entire files using two symmetric ciphers: AES and ChaCha20-Poly1305.
- **Asymmetric encryption**: This is another class of encryption algorithms in which users have a pair of keys, consisting of a private key and a public one, and those are used to encrypt and decrypt messages when they're shared with other people. While asymmetric ciphers are much lesser known (and understood), they are used by virtually every human being, daily, given that they underpin protocols like HTTPS that is used to serve web pages securely.
  Within the book, we learn about asymmetric ciphers and hybrid ones (that combine an asymmetric cipher with a symmetric one), when they should be used and how. We're focusing on RSA and algorithms based on Elliptic Curve Cryptography (ECDH and ECIES).
- **Digital signatures**: With digital signature schemes, developers can build solutions that leverage public key cryptography to authenticate messages and certify their integrity. For example, those QR codes that many people are familiar with these days to prove COVID test results or vaccination status embed a message that is digitally signed, allowing everyone to verify the integrity of the certification and who issued it. Although they often operate "behind the scenes" and are not immediately visible to users, digital signatures have a multitude of uses in software development, including securing software distribution, preventing tampering with messages, etc.
  In my book, you'll be able to learn when to use digital signatures and how, using RSA and schemes based on Elliptic Curve Cryptography (ECDSA and EdDSA).

As per the title of the book, it includes code samples written in JavaScript, for both Node.js (and platforms based on Node.js, like Electron) and for client-side code that runs within a web browser. I chose JavaScript because it's a very popular language and it has vast applications, from front-ends, to servers, to desktop and mobile apps.

However, if you primarily work with another programming language or framework, you will still be able to learn principles and techniques that can be ported to your preferred stack.

## Why I wrote this book

I believe that having at least some knowledge of cryptography is an important skill for every software developer, and it's becoming even more important every day.

Us developers are facing increased pressure to build apps that are safe against more widespread and more sophisticated attacks. We are also being asked to design solutions that comply with more stringent privacy requirements, either due to external regulation (like GDPR) or simply because of business requirements—more commonly, privacy is a selling point for apps, and more customers are demanding that. For both these reasons and more, cryptography is an immensely powerful tool that we can leverage to accomplish those goals—not sufficient, but almost always necessary.

Yet, as a software developer, learning about cryptography is not always easy. To start, cryptography is a vast topic, has many confusing things, and mistakes are not always immediately clear.

There are of course lots of resources to learn cryptography, including many books that have already been written. However, a large part of those tutorials, videos, articles and lectures, and perhaps almost all books, seem to have a focus on cryptography as a science, and are generally written for an audience of aspiring cryptographers. As such, they spend a good chunk of time on the formal descriptions of the algorithms, with lots and lots of (complex) math.

While resources like those are incredibly valuable for people who want to learn the science and art of cryptography, as a software developer myself I was always more interested in the **practical applications** and found the math distracting—if not outright confusing at times.

With _Essential Cryptography for JavaScript Developers_ I've attempted to collect all my learnings from over a decade of using cryptographic operations to develop many different apps and share them with other developers so they can avoid the same mistakes I've made.

It's a book written for other software developers who want to know which are the most common cryptographic operations, what they're used for, and how they can use them in their code, safely, relying on proven implementations such as those built-into JavaScript and Node.js.

This book took quite a lot of time to put together, but I'm very excited about the end result and I can't wait for other developers to read it and then see what they build with that! And please do share any feedback you have about the book with me—including showcasing the projects you've written!

You can order _Essential Cryptography for JavaScript Developers_ [on Amazon](https://packt.link/AcgWC) in any country, or directly from [Packt](https://www.packtpub.com/product/essential-cryptography-for-javascript-developers/9781801075336).
