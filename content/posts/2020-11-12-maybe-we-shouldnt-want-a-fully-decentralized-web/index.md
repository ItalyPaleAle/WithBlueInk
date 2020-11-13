---
title: "Maybe we shouldn't want a fully decentralized web"
description: "Why I have stopped with IPFS and the distributed web"
date: 2020-11-12 00:00:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
image: "img/decentralized-network.jpg" 
comments: yes
coverImage:
  author: "Sander Weeteling"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@sanderweeteling"
---

I spent a large part of 2019 working with the distributed and decentralized web, especially IPFS, also known as the "Inter-Planetary File System". I've written a few articles on the topic, on how you can host a web app on IPFS, one of which even ended up on the front page of HackerNews.

For about a year, I hosted my blog and other apps through an IPFS cluster. I wrote a utility for making pinning files easier on Pinata, a third-party cloud service for IPFS. I made some small contributions to the IPFS core projects. I built some projects with it, including one that I never released--nor fully completed--that used both IPFS and Ethereum. And I even gave a talk about hosting static web apps on IPFS at Node+JS Interactive last December in Montreal.

That all changed in the Spring of 2020. I called myself out of the distributed web.

My blog and other apps I built aren't hosted on IPFS anymore. I don't participate in those online communities anymore. I've stopped writing about the distributed and researching about it. I've shelved all my projects that were using those technologies.

I also updated my blog posts about IPFS adding a note that my blog isn't hosted that way anymore. More than a few people asked me why, and I always gave the same answer: a mix of technical issues and mostly personal reasons. So, I think it's time I explain the personal reasons.

First, I need to explain why I got involved with IPFS in the first place.

When I first read about IPFS, my mind immediately saw it as an exciting new platform I could build my apps for. The premise of a fully-decentralized platform included unlimited scalability, ultra-high availability and resiliency, no single points of failure, and resistance against attacks like DDoS.

Coming from a background in which I am always thinking about SLAs, number of nines of uptime, disaster recovery, etc, IPFS sounded like a dream platform that would magically solve all my concerns. And, aside from some performance issues at times, it did. Plus, the small engineer inside me was really excited about being able to play with a new, shiny toy, that had lots of hype around it!

What happened next for me was a reckoning with the reality of what many people behind the IPFS core project and the community around it saw: the dream of a radically open, unfiltered, and by-design un-censorable platform.

I have recently opened up about my experience, over a decade ago, with building an app with good intentions but that was then misused ([*That time I accidentally built a spying app*](https://medium.com/the-innovation/that-time-i-accidentally-built-a-spying-app-79232f23f3c2)). I learned early on in my life and (pre-)professional career about the importance of ethics in software development, and I am now a proponent of the idea that just because something *can* be built, it doesn't mean it *should* be built.

And that brings me back to why, after spending some time in the world of the decentralized web, I have called myself out, and why I think that should things like IPFS actually become mainstream, they might cause more harm than good in the world.

**I have seen, and I am seeing every day, the dangers of completely unrestricted speech, and I don't want to be the one enabling that.**

I know that last sentence is a strong ideological statement; some might call it a *political* statement, but for me it's more than just political, which is often used to describe extemporary beliefs.

Many of you reading this will not agree with me, and that's fine. I'm not going to try and change your beliefs with this blog post. Rather, I'm looking to explain why, while I respect that others might have differing opinions, I stopped doing anything that would actively advance a technology whose ethics I question. To put it in other terms: your freedom of speech isn't my obligation to enable you and give you a platform.

In short, I think that while the Internet has helped the world in countless of ways, it has also brought out the worst in people.

I do believe we need some filters on the Internet. It's not just about stopping criminal activities, terrorism and child pornography: while I am obviously unsupportive of all them, I also think they're not the biggest dangers coming from the Internet (yet they're a very convenient pretext for politicians).

Instead, I think that regular people's writings on the Internet is hurting the world on a bigger scale. And the collective sentiment is often manipulated by some "agitators" that are exploiting anonymous online speech for their own agendas: that includes online militias--for example sponsored by foreign governments--whose goal is to destabilize a society.

In the last few years, completely unregulated online speech has given rise to fake news and conspiracy theories that have actually killed people. It's offered a megaphone to those promoting dangerous ideas like white supremacy, Islamophobia, anti-Semitism, homophobia and other anti-LGBTQ positions, and sometimes outright Nazism. It has tilted many democracies towards right-wing populism and fascism.

All these extreme ideas have divided societies and increased social tensions. And they're responsible for a number of acts of terrorism which caused the death of too many people.

Given our experiences so far, there's no sign that indicates that a fully decentralized and unrestrained web would be anything but a dangerous wild west.

In fact, despite being tightly centralized and controlled, social media companies are facing significant challenges regulating what people write on their platforms, and in fact they are usually at the center of every scandal of these years. Decentralization and less control won't be the solution to this issue, but rather the opposite.

If you believe that I'm overthinking this, and that it's not going to be bad *this time*, I urge you to think twice.

First, there's no indication that a new Web would be better than the previous one just on virtue of being decentralized. The same actors that are using today's Internet to wreak havoc around the world would not disappear in the new Internet, and actually, they could be even more unrestrained.

Second, while almost everyone in the communities supporting a distributed web are good people, with good intentions, seeing some names in there is concerning to me. Regarding IPFS, advocates (at least for a while) included people like Nick Lim of BitMitigate and VanwaNet, companies responsible for rescuing, among others, [pro-nazi website](https://www.geekwire.com/2017/seattles-bitmitigate-now-protecting-pro-nazi-site-daily-stormer-web-attacks/) The Daily Stormer [and the platform](https://arstechnica.com/information-technology/2019/11/breaking-the-law-how-8chan-or-8kun-got-briefly-back-online/) 8chan, a cesspool full of Nazi propaganda, child pornography, and other hate speech. Gatherings on 8chan have been [blamed](https://en.wikipedia.org/wiki/8chan#2019_shootings) for at least three mass shootings in 2019 alone, including the one in the [mosque in Christchurch](https://time.com/5648479/8chan-ban-new-zealand/), all of them motivated by racial hatred.

The first real examples of the distributed web aren't particularly encouraging either. Among some of the most popular apps ("popular" in relative terms, of course) for the distributed web is DTube, a sort of YouTube that is built on top of IPFS. As you can expect, the website is full of questionable content, including conspiracy theories, cryptocurrency scams, weapons, RT International's [Russian propaganda](https://www.theguardian.com/commentisfree/2019/jul/26/russia-disinformation-rt-nuanced-online-ofcom-fine)... and of course, porn.

In essence, if it's true that *a good beginning makes a good ending*... with such a mixed beginning, the outlook isn't too rosy.

I understand that my opinion is somehow a minority one, and people will continue to build IPFS and other technologies part of the distributed web. There's also a chance they might become successful and potentially get mainstream adoption--although at this stage the barrier to entry is too high for the average user.

However, I feel that it's my responsibility to not be helping to advance this technology and the beliefs of at least some advocates in the world of the distributed web hold. If the advancement occurs, it won't be because of my help.

---

*PS: The idea that freedom of speech is an absolute right that should have (almost) no limitations is not a universal one. While that right is granted to people living in all democratic countries, outside of North America it's accepted that such right comes [with limitations](https://www.nytimes.com/2019/08/06/world/europe/el-paso-shooting-freedom-of-speech.html), and usually that has roots in the history of those places.*

*For example, in Italy where I grew up, the same constitution that grants freedom of expression (speech, press, etc) also criminalizes "apology of fascism", or propagating the ideas of fascism; it also sets other limits on speech that is hateful or discriminatory. Other European countries have similar laws, such as the outlawing of Nazi rhetoric and symbology in Germany.*
