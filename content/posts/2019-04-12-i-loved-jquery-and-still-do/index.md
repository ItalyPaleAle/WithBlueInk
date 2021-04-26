---
title: "I loved jQuery, and still do"
description: "In defense of one of the most important JavaScript libraries ever"
date: 2019-04-12 17:10:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
image: "img/jquery.jpg"
comments: yes
coverImage:
  author: "Doran Erickson"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@doran_erickson"
---

[jQuery 3.4.0](https://blog.jquery.com/2019/04/10/jquery-3-4-0-released/) was released two days ago, and the amount of negative reactions I've seen on [Twitter](https://twitter.com/search?q=jquery),  [Reddit](https://www.reddit.com/r/javascript/comments/bc0f98/jquery_340_released/), and [Hacker News](https://news.ycombinator.com/item?id=19628789) is staggering.

{{< tweet 1116196690174681088 >}}

Let's be clear: **there's nothing wrong with jQuery itself**. [John Resig](https://twitter.com/jeresig)'s library was and still is one of the most relevant and popular pieces of JavaScript code ever written. People who hate jQuery in these years probably don't know (or forgot) what frontend JavaScript development used to be like, and/or are blaming the library for their own bad code.

## Web development before jQuery

Back in the late '90s, websites were almost entirely **server-side generated HTML pages**. JavaScript was a relatively little part of the page, and it was used (*or abused*) often just to add eye-candies, such as scrolling texts, clocks that ticked live each second, and so on.

**Then GMail came in 2004**, and it was the first large-scale Single-Page Application (SPA) adopted by the millions. Although, at the time we weren't really using the word "SPA", and so we'd refer to that category of apps with terms like Rich Internet Application (RIA) or "Web 2.0 app".

GMail inspired countless developers to dare doing more with the web. The problem was that it was fifteen years ago (time flies…), and web developers were dealing with **Internet Explorer 6** as the most used web browser. Mozilla Firefox had just appeared and was slowly beginning to creep in.

Safari and Konqueror were the first browsers to pass the Acid2 test in 2005, proving full compliance with the HTML and CSS 2.1 specifications. Firefox followed one year later and Internet Explorer finally became "standards-compliant" (based on the Acid2 test) only with version 8 in 2009.

{{< img src="images/ie8-acid2.png" alt="Screenshot of Internet Explorer 8 passing the Acid2 test" caption="Countless web developers—myself included—had that same smile when IE8 passed the Acid2 test." >}}

In short, web development in the first decade of the twenty-first century was a mess. We were dealing with browsers that did not implement standards, rendered pages with disregards for specs, and added their own proprietary technologies on top. We also didn't have luxurious things such as HTML5, CSS3, ES2015 (ES6), or WebSockets; the APIs available were not as rich and powerful. On top of that, we had to deal with an abundance of plugins like Flash, often used for (unnecessary) eye candies, and sometimes out of necessity like playing videos.

## Enter the libraries

jQuery came out in that context, in 2006. To be precise, it was not the only, nor the first library. Other popular alternatives included the [Prototype](http://prototypejs.org/) (first released in 2005) and [script.aculo.us](http://script.aculo.us/) combo—yes the name is real.

**jQuery was built when we needed a simple library to add interactivity to mostly static pages, adding an uniform layer on top of multiple browsers that were not standards-compliant.** Developers could use jQuery to augment the user experience of server-side generated pages, adding a certain amount of interactivity: for example, submitting forms without reloading the entire page, or polling for updated content, etc.

For example, making an asynchronous request with jQuery changed from this (credits: [Petah](https://stackoverflow.com/a/18078705/192024)):

````js
/* Before jQuery */

var ajax = {};
ajax.x = function () {
    if (typeof XMLHttpRequest !== 'undefined') {
        return new XMLHttpRequest();
    }

    // Rest of this function is to support IE 6
    var versions = [
        "MSXML2.XmlHttp.6.0",
        "MSXML2.XmlHttp.5.0",
        "MSXML2.XmlHttp.4.0",
        "MSXML2.XmlHttp.3.0",
        "MSXML2.XmlHttp.2.0",
        "Microsoft.XmlHttp"
    ];

    var xhr;
    for (var i = 0; i < versions.length; i++) {
        try {
            xhr = new ActiveXObject(versions[i]);
            break;
        } catch (e) {
        }
    }
    return xhr;
};

ajax.send = function (url, callback, method, data, async) {
    if (async === undefined) {
        async = true;
    }
    var x = ajax.x();
    x.open(method, url, async);
    x.onreadystatechange = function () {
        if (x.readyState == 4) {
            callback(x.responseText)
        }
    };
    x.send(data)
};

ajax.get = function (url, data, callback, async) {
    var query = [];
    for (var key in data) {
        query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
    }
    ajax.send(url + (query.length ? '?' + query.join('&') : ''), callback, 'GET', null, async)
};

// Example:
ajax.get('mydata.xml', {q: 10}, function(response) {
    // Do something
});
````

To this:

````js
/* With jQuery */

$.ajax({
    url: 'mydata.xml',
    data: {q: 10},
    success: function(response) {
        // Do something
    }
});
````

In plain-old JavaScript, we got something similar, the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API), only in 2015.

jQuery was also extremely useful for DOM manipulation. It abstracted many of the quirks of web browsers that behaved weirdly (*for example, like IE 6…*) giving consistent, powerful APIs. jQuery also offered something like `document.querySelector` for years before browsers started implementing it (in Internet Explorer, that arrived only with version 8, and it was buggy until version 9).

If you're still not convinced of how important jQuery was, consider that  [Microsoft included](https://weblogs.asp.net/scottgu/jquery-and-microsoft) it in Visual Studio and ASP.NET in 2008. This was the first time they shipped an open source library in one of their flasghsip products and used it as major selling point.

## Why the hate then?

Like I said above, jQuery was built when front-end development was about augmenting server-side generated pages to add some interactivity. However, developers were dreaming of building something like GMail.

In the late '00s, there were no frameworks and tools like Angular (which first appeared in 2010), TypeScript, Webpack, etc. There were no JavaScript modules, ES2015, Babel transpilers, etc. In absence of today's tooling, started building "SPAs" with jQuery

**But jQuery was never designed to do that**, and building "SPAs" with it was just very hard. The end result was that most developers ended up writing a ton of spaghetti code, building monsters that were almost impossible to maintain. The bigger your development team, the more intricated your code was likely to be.

"2008-me" is guilty of that as well, and there's still a video on the Internet of what I built back then:

{{< youtube ps5ohEhO3S4 >}}
<figcaption>Here's a jQuery-powered "SPA" in front of a PHP 5 backend. I found again the source code, and yes it is an intricated mess of spaghetti code.</figcaption>

John Resig [built jQuery](https://www.khanacademy.org/computing/computer-programming/html-js-jquery/jquery-dom-access/a/history-of-jquery) to make it easy and fun to write JavaScript code that worked across browsers and invoked AJAX requests. Building "SPAs" was not his goal, and developers using jQuery for that were just abusing it. **So, if developers ended up writing very messy code while trying to build a SPA with jQuery, they have only themselves to blame, not the library.**

## I still love jQuery

Sure, I would not attempt building a SPA with it. But, if I need to quickly build some interaction inside an otherwise static page, I'd still consider jQuery as my first choice.

{{< img src="images/html-with-jquery.png" alt="HTML page loading jQuery" >}}

- Adding interactivity to a page with jQuery is really fast. You only need to include one `<script>` tag and you're good to go, and no need to mess around with Webpack.
- jQuery has some amazingly simple APIs that have been mostly stable for over a decade. It's easy to use, it just works, and it works well. The project is still actively maintained, even if with less intensity.
- There's a huge community of jQuery developers (even today), and `jquery` is still one of the most popular tags on StackOverflow. This means it's very easy to find solutions to most problems.
- Likewise, there's a very large amount of modules and plugins for jQuery to do many things. Bootstrap itself uses jQuery to add interactivity like popovers, etc.

Sometimes you're building complex web apps, and using something like Angular, React, Vue, Svelte, etc is the best choice. Many times, if you're just building one view or two, you don't really need the complexity of those frameworks.

In all cases, remember that each technology was built for a specific purpose, and if you end up writing bad code while misusing it, that's all on you.
