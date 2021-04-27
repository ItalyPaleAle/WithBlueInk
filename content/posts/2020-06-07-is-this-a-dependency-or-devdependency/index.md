---
title: Is this a dependency or devDependency?
description: "Where to put NPM modules in package.json: it's not as simple as it seems"
date: 2020-06-07 00:00:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
comments: yes
coverImage:
  author: "Natalino D'Amato"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@natalino_damato"
resourceBundle: dev-dependencies
---

Earlier today, someone opened a Pull Request for [svelte-spa-router](https://github.com/ItalyPaleAle/svelte-spa-router)–an open source project I maintain as a client-side router for Single-Page Apps built with the Svelte framework–asking whether they should install the module as a *dependency* or *devDependency* in the package.json file.

Aside from the specificity of this case, I thought this was a great question in general, and worth discussing. When should we put a module dependency in package.json as a *devDependency*?

## What the docs say

There is actually official guidance on where to put a package, which is clearly written in the [NPM documentation](https://docs.npmjs.com/specifying-dependencies-and-devdependencies-in-a-package-json-file). To quote exactly:

> - `dependencies`: Packages required by your application in production.
> - `devDependencies`: Packages that are only needed for local development and testing.

In short, you should save a module as a *devDependency* when it's only used for development and testing; everything else should be a *dependency*. You might think this is straightforward, clear guidance, but like for users of my module, things can get murky in real life.

The real answer is **it depends**. The choice of where to put each module depends not only on the module itself, but on your application and even on the ways it's developed and deployed.

## When it's simple…

There are some clear-cut cases, or almost. Packages like [eslint](https://www.npmjs.com/package/eslint) are *always* a *devDependency* …unless, of course, you're building a CLI whose job is running eslint, in which case you'd add it as a *dependency*!

Other packages that are (almost) always going to be *devDependencies* include:

- Test frameworks: [mocha](https://www.npmjs.com/package/mocha), [supertest](https://www.npmjs.com/package/supertest), [nightwatch](https://www.npmjs.com/package/nightwatch), etc, as well as their dependencies such as [chromedriver](https://www.npmjs.com/package/chromedriver)
- Code coverage tools, such as [nyc](https://www.npmjs.com/package/nyc) and [coveralls](https://www.npmjs.com/package/coveralls)
- Linters and code formatters, such as the already-mentioned [eslint](https://www.npmjs.com/package/eslint), [tslint](https://www.npmjs.com/package/tslint), and their plugins/dependencies
- Servers used for local development, like [serve](https://www.npmjs.com/package/serve), [http-server](https://www.npmjs.com/package/http-server), [sirv](https://www.npmjs.com/package/sirv), and many more
- Documentation tools, such as [jsdoc](https://www.npmjs.com/package/jsdoc) and [typedoc](https://www.npmjs.com/package/typedoc)

For Node.js applications that are running on the server-side, it's also *usually* clear what packages should be *dependencies*. The rule of thumb is that if a module is imported by the application (e.g. with a `require('foo')`), then it should be a *dependency*. Anything else goes as *devDependency*.

## …and when it's not

The answer gets less clear-cut when we are dealing with applications that are client-side (running in browsers), pre-processed (e.g. that use TypeScript), or both.

For these situations, my advice is to consider the role of the module in the application as well as how the application is built and deployed.

### Client-side applications

Let's start with browser-based applications. Modern front-end development involves bundlers, pre-processors, and sometimes outright compilers. The toolchain generally includes at least a bundler ([webpack](https://www.npmjs.com/package/webpack), [rollup](https://www.npmjs.com/package/rollup), [parcel](https://www.npmjs.com/package/parcel), to mention some) or a task runner (like [grunt](https://www.npmjs.com/package/grunt)), plus a front-end framework like [react](https://www.npmjs.com/package/react), [angular](https://www.npmjs.com/package/angular), [svelte](https://www.npmjs.com/package/svelte), [vue](https://www.npmjs.com/package/vue). Additionally, there are often transpilers (such as [typescript](https://www.npmjs.com/package/typescript) and [babel](https://www.npmjs.com/package/babel)) or other pre-processors (e.g. for CSS and JS files).

When your front-end application is bundled, it's possible to wonder where to put every single dependency of the application, just like users of *svelte-spa-router* have. Since they're only used during the bundling stage, should they all be *devDependencies*?

As mentioned, situation like these introduce a lot of subjectivity, and the best advice I can give you is to look at your application, then draw your conclusions based also on your preferences. Here are some thoughts and opinions.

First, look at **how the application is deployed**. Ideally, in a production server you want to install only production dependencies. If your front-end app is deployed together with a back-end app, and it's bundled when the application is started, then bundlers and the rest of the toolchain should be included as *dependencies*: they are in fact needed to launch the application.

If the front-end application is **bundled beforehand**, for example in a Continuous Integration (CI) server or even on a developer's machine, then you can consider the dependencies either way.

Strictly following the official documentation, because these packages are used only at build-time, they should be considered *devDependencies*. However, doing this you'd end up with all your packages as *devDependencies*, and that feels like defeating the point to me.

Instead, my *recommendation* in this case would be to put the packages that are making their way directly into your bundled code into the *dependencies* block. For example, modules that are imported by your front-end application and the frameworks themselves (such as React, Angular, Vue, Svelte, etc), would all go in the package.json file as *dependencies*. The bundlers, pre-processors, transpilers, etc, instead, would go in as *devDependencies*.

The reason for this is that it makes it clear what third-party code you're actually shipping to your users, and this is very important for security reasons. In fact, it makes it easier to audit your application's "software supply chain" and to evaluate the impact of a dependency's vulnerability on your project.

### Transpiled server-side apps

The other situation is with Node.js server-side apps that are transpiled, such as when you're using TypeScript or Babel.

Similarly to the case above, my advice is to start from understanding how the application is deployed. Will you run the transpilation before or after deploying it?

For example, if you're using TypeScript, will you run `tsc` (the TypeScript transpiler) as a build step before deploying the application, or every time you launch the application in the server?

- If you run the transpiler at runtime to start the application, then the transpiler itself and the rest of the toolchain should be *dependencies*.
- If you pre-build the application before deploying it, then you can put the transpilers and the rest of the toolchain as *devDependencies*.  
This is the case when, for example, you're using a build server to run `tsc`, you're running it on the developer's machine before copying the transpiled files to the server, or when you're using a multi-stage Docker image build where the first stage runs `tsc`.  
Unlike the case of front-end applications above, transpilers normally don't bundle the code (although they can), so all modules that are directly imported in the code need to be *dependencies*.

### Shipping NPM pakcages

The two sections above were looking at "complete applications", which are then deployed for end-users to access. But what if we were working on a package to be shipped to NPM instead?

In this case, we need to be particularly careful with keeping the list of *dependencies* as small as possible. The reason is that when someone installs your package from NPM, they will install all of its *dependencies*, but not the *devDependencies*.

Depending on what technologies you use, packages on NPM can either be shipped as-is, with unmodified source code (besides "pure JavaScript" projects, this includes things like front-end components such as those for React, Svelte, etc), or can be pre-processed beforehand. For example, you normally don't publish TypeScript files on NPM, but instead you publish transpiled JavaScript code and the type definition files.

In either case, my advice would be the same: no matter what the toolchain (if any) you use to build/transpile/package your code, those packages go as *devDependencies*.

In fact, if you're shipping preprocessed code, there's no need to also get your users to install your pre-processors (transpilers, bundlers, etc). On the other hand, if you're shipping the original source code, users will need to use their own pre-processors, and you still shouldn't make them install what you used for development and testing of the module.

## All told, life is more complicated

As you can see, deciding what goes where is not nearly as straightforward as it might seem. What the NPM documentation brushed off in two lines, I wrote an entire article about, and I have likely missed some other situations.

At the end of the day, however, all the discussion above might not matter. When you're working on a large project with many other people, packages are constantly added and removed from the package.json file, and proper hygiene of all dependencies is often not a priority for teams.

In those situations, you can't be sure that all your *dependencies* and *devDependencies* are always, at all times, placed in the correct place.

Teams often end up erring on the side of caution. Installing all packages (including *devDependencies*) in a production server is an easy way to remove many "it works on my machine"-like issues and save hours of debugging time. Thanks to advancement in the NPM tooling, including the [`npm ci`](https://docs.npmjs.com/cli/ci.html) command, installing dependencies is not as slow as it used to be.

Additionally, unless you're confident that every dependency is in the right place, it might be advisable to treat all security alerts for vulnerabilities in dependencies the same way, regardless of whether they are for a *dependency* or *devDependency*.

Have suggestions? Another scenario worth considering? Let us know in the comments!
