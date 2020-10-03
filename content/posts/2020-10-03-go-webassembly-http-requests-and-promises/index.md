---
title: "Go, WebAssembly, HTTP requests and Promises"
description: "Learnings from using Go and WebAssembly"
date: 2020-10-03 00:00:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
image: "img/go-wasm.jpg"
comments: yes
coverImage:
  author: "Saira"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@sairaa"
---

[WebAssembly](https://webassembly.org/), or Wasm, is an open standard that allows developers to build apps that run inside a web browser using compiled programming languages. With WebAssembly, it's possible to write components of web apps in languages such as C/C++, Rust, C#, and Go, among others, which run within the same sandbox as JavaScript. This allows things like porting existing libraries, leveraging capabilities not available in JavaScript, and running code faster because WebAssembly is compiled into a binary format.

Recently, I've been experimenting with WebAssembly to be able to run some Go code in the browser. Specifically, I've been trying to port certain parts of [prvt](https://github.com/italypaleale/prvt), an open source project for storing end-to-end encrypted documents, to run within a web browser directly. The reason for the WebAssembly experiment was two-fold: first, prvt makes extensive uses of cryptography and streams, both things which are not yet great in JavaScript; second, prvt itself is written in Go, so being able to re-use code in the browser would significantly simplify development.

> For an **introduction to using WebAssembly with Go**, I recommend [this article on Golang Bot](https://golangbot.com/webassembly-using-go/).  
> Additionally, more information can be found in the Go project's [GitHub wiki](https://github.com/golang/go/wiki/WebAssembly) and in the documentation for the [syscall/js](https://golang.org/pkg/syscall/js/) package.  
> Note that as of writing, **WebAssembly support in Go is still experimental**. Because of that, the APIs might change too. This article was tested against Go 1.15.

This article contains four different yet connected things that I've learnt while working on the WebAssembly port, and which I thought useful to share.

1. Working with and creating JavaScript objects from Go code
1. Creating Promises in Go for passing async results
1. Making HTTP requests from Go code
1. Streaming from Go code

## JavaScript objects in WebAssembly and Go

The WebAssembly runtime for Go automatically converts the most common Go types to their JavaScript equivalent. The documentation for the [js.ValueOf](https://golang.org/pkg/syscall/js/#ValueOf) method contains a nice summary table of how Go and JavaScript types are matched:

```text
| Go                     | JavaScript             |
| ---------------------- | ---------------------- |
| js.Value               | [its value]            |
| js.Func                | function               |
| nil                    | null                   |
| bool                   | boolean                |
| integers and floats    | number                 |
| string                 | string                 |
| []interface{}          | new array              |
| map[string]interface{} | new object             |
```

From here, you can see that the most common types, such as numbers, booleans, and strings, are converted automatically. The last row is particularly interesting as it explains how to pass "Plain Old JavaScript Objects" (POJO's), which are  the simplest kinds of objects (also called dictionaries).

For example, the following Go code defines a function called `MyGoFunc` that can be called from JavaScript code, which returns a dictionary with a string and a number (as you can see, types can be heterogeneous).

> For instructions of how to compile Go code into WebAssembly, check out the [Getting Started section](https://github.com/golang/go/wiki/WebAssembly#getting-started) of the Wiki.

{{< gist ItalyPaleAle 8bded1641bdf734bbd14249cb3f3eb44 "js-dictionary-from-wasm.go" >}}

After having compiled the code into WebAssembly and having imported it in the JavaScript code, you can call `MyGoFunc()` from JavaScript to see the result. For example:

```js
console.log(MyGoFunc())
// Prints: {hello: "world", answer: 42}
```

However, what the documentation is less explicit about is that we can also **use any JavaScript object** inside the Go code, **even built-ins**! And this is where things can start getting more interesting.

For example, let's try to pass a date as a [`Date`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) object. To do that, we first need to grab the `Date` constructor, loading its `js.Value` from the global scope of JS:

```go
dateConstructor := js.Global().Get("Date")
```

Then, we can create a new object off this constructor with the `dateConstructor.New` method, passing any argument to it as you'd pass to the `new Date()` constructor in JavaScript. The result of the invocation is a `js.Value` that can be returned to JavaScript:

```go
dateConstructor.New("2020-10-01")
```

So, we can modify our `MyGoFunc` to return the current date as computed in Go:

{{< gist ItalyPaleAle 8bded1641bdf734bbd14249cb3f3eb44 "js-native-object-from-wasm.go" >}}

Invoking `MyGoFunc()` in the JavaScript code will now return a `Date` object:

```js
let d = MyGoFunc()
console.log(typeof d)
console.log(d instanceof Date)
console.log(d.toString())

/*
Prints:

object
true
Sat Oct 03 2020 10:58:27 GMT-0700 (Pacific Daylight Time)
*/
```

## Async JS with Promises from Go

In JavaScript, [`Promise`'s](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) are the foundation of async/await. If you need a refresher on Promises, [this is a good article](https://javascript.info/promise-basics).

For example, consider this code, which creates a Promise that resolves with a message ([an Italian tongue-twister](https://www.mamalisa.com/?t=es&p=5534)) after 3 seconds:

```js
const p = new Promise((resolve, reject) => {
    setTimeout(() => {
        resolve("sopra la panca la capra campa, sotto la panca la capra crepa")
    }, 3000)
})
```

In an `async` function, you can then `await` on the Promise above, so after 3 seconds you receive the message:

```js
// This is an async function, which can contain "await" statements inside
async function MyFunc() {
    // Create the Promise
    const p = new Promise((resolve, reject) => {
        // After a 3 second timeout, this calls "resolve" with the message we're passing
        setTimeout(() => {
            resolve("sopra la panca la capra campa, sotto la panca la capra crepa")
        }, 3000)
    })
    // Await for the Promise - this resolves after 3 seconds
    const message = await p
    console.log(message)
}
```

Invoking `MyFunc()` will show `sopra la panca la capra campa, sotto la panca la capra crepa` in the console.

When working with Wasm in Go, Promises are particularly important.

In fact, as per the documentation, you cannot make blocking calls in Go inside a function that is invoked by JavaScript directly—if you do that, you’ll get an immediate deadlock and your app will crash. Instead, the documentation recommends that all blocking calls be inside a goroutine, which raises the problem of then returning the value to the JavaScript code. Quoting from the [docs](https://golang.org/pkg/syscall/js/#FuncOf):

> Invoking the wrapped Go function from JavaScript will pause the event loop and spawn a new goroutine. Other wrapped functions which are triggered during a call from Go to JavaScript get executed on the same goroutine.  
> As a consequence, if one wrapped function blocks, JavaScript's event loop is blocked until that function returns. Hence, calling any async JavaScript API, which requires the event loop, like fetch (http.Client), will cause an immediate deadlock. Therefore a blocking function should explicitly start a new goroutine.

Using a Promise is perhaps the best way to solve this problem: avoiding deadlocks while allowing programming with idiomatic JavaScript.

We saw in the previous section that we can create custom JavaScript objects from Go, and this applies to Promises too! We just need to create the `Promise` object by passing a function to the constructor. Just like in the pure-JS code above, this function receives two arguments, which are functions themselves: `resolve` should be invoked with the final result when the Promise's work is done, and `reject` can be called when there's an error to make the Promise fail.

Here's an updated `MyGoFunc` that resolves with a message ([another Italian tongue twister!](http://www.bbc.co.uk/languages/yoursay/tongue_twisters/italian/trotting_trentonians.shtml)) after 3 seconds:

{{< gist ItalyPaleAle 8bded1641bdf734bbd14249cb3f3eb44 "js-promise-from-wasm.go" >}}

To invoke this from JavaScript:

```js
async function MyFunc() {
    // Get the Promise from Go
    const p = MyGoFunc()
    // Show the current UNIX timestamps (in seconds)
    console.log(Math.floor(Date.now() / 1000))
    // Await for the Promise to resolve
    const message = await p
    // Show the current timestamp in seconds, then the result of the Promise
    console.log(Math.floor(Date.now() / 1000), message)
}

/*
Result:
  1601746916
  1601746919 "Trentatré Trentini entrarono a Trento, tutti e trentatré trotterellando"
*/
```

If your Go code errors, you can throw exceptions to JavaScript by using the `reject` function instead. For example:

{{< gist ItalyPaleAle 8bded1641bdf734bbd14249cb3f3eb44 "js-promise-with-errors-from-wasm.go" >}}

When you invoke this from JavaScript, you will see the returned object about half of the times, and you'll get an exception the other half. Note that we're invoking the `reject` function with an actual JavaScript `Error` object, as best practice in JavaScript!

```js
async function MyFunc() {
    try {
        console.log(await MyGoFunc())
    } catch (err) {
        console.error('Caught exception', err)
    }
}

/*
Result is either:
  {error: null, message: "Hooray, it worked!"}
Or a caught exception (followed by the stack trace):
  Caught exception Error: Nope, it failed
*/
```

## Making HTTP requests from Go code

Finally, let's look at how we can use Go and WebAssembly to make HTTP requests, a very common task. For example, you can do this inside a [Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) to [intercept network requests](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent) and have Go process them instead (that's what I'm doing with prvt, so the Go code can decrypt the files).

There are two important things to keep in mind:

1. Network calls from Go are blocking, so they must be executed in a separate Goroutine. Because of that, we should return a Promise from Go to JavaScript that eventually resolves with the result of the network request.
2. If your goal is to intercept network requests, then your Go code should return the response wrapped in a JavaScript [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) object.

Here's an example:

{{< gist ItalyPaleAle 8bded1641bdf734bbd14249cb3f3eb44 "http-request-wasm.go" >}}

We can then use it in our JavaScript code to invoke any REST API and get the result as if it were a `fetch` request. For example, in the code below we're making a call to the [taylor.rest](https://taylor.rest) API, which returns a random quote from Taylor Swift:

```js
async function MyFunc() {
    try {
        const response = await MyGoFunc('https://api.taylor.rest/')
        const message = await response.json()
        console.log(message)
    } catch (err) {
        console.error('Caught exception', err)
    }
}

/*
Result is a quote from Taylor Swift, as a JSON object. For example:
  {"quote":"The only one who's got enough of me to break my heart."}
*/
```

> Note that when making a HTTP request from Go, the WebAssembly runtime internally converts the calls to fetch requests in the browser. So, even when using WebAssembly, you're still bound to the same security policies and requirements as JavaScript `fetch` calls, including CORS.

## Streaming from Go code

Lastly, one more thing. We've seen how we can make HTTP requests and return data from WebAssembly/Go. There's only one issue:

```go
data, err := ioutil.ReadAll(res.Body)
```

In this line, we're reading the entire response's body in memory, before returning it to JavaScript. This is fine in many (most?) cases… but what if you're trying to read a very large file, say a video? The call above would require a lot of memory.

Thankfully, we can stream the response back. Sadly, because of JavaScript's relatively immature support for streams (outside of Node.js), it's not as straightforward. The solution involves creating a [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) JS object in the WebAssembly code, and then using its APIs to pass data as soon as it's available in the stream.

{{< gist ItalyPaleAle 8bded1641bdf734bbd14249cb3f3eb44 "http-streaming-request-wasm.go" >}}

This last iteration of `MyGoFunc(url)` can be used to retrieve data as a stream. For example, in our JavaScript code, we can request an image and see it arriving in chunks:

```js
async function MyFunc() {
    try {
        const response = await MyGoFunc('https://images.unsplash.com/photo-1571079520814-c2840ce6ec7b')
        const reader = response.body.getReader()
        let done = false
        while (!done) {
            const read = await reader.read()
            done = read && read.done
            console.log('Read', read.value.length, 'bytes')
        }
    } catch (err) {
        console.error('Caught exception', err)
    }
}
```

When you invoke this function, you'll see in the console a bunch of statements like `Read 16384 bytes`, repeated multiple times, sometimes with a different number of bytes, but never larger than 16384 because we were using a 16KB buffer.
