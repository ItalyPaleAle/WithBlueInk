---
title: "Building with Distributed Actors"
description: "Among my favorite patterns is one you may not have heard of"
date: 2025-11-19 08:00:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
comments: yes
resourceBundle: distributed-actors
coverImage:
  author: "Paolo Chiabrando"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@chiabra"
slug: "distributed-actors-model"
params:
  ogTitle: "Building with Distributed Actors: What and Why"
---

I like to describe a distributed actor as *a unit of state with single-threaded compute on top, available to every app in the distributed system*. It's a surprisingly compact definition for a programming model that can feel counter-intuitive if you haven't run into it before.

Most developers, even experienced ones, haven't. I certainly hadn't. And even when I was working full-time on Dapr—an open-source project that includes a distributed actors building block—it still took me months to really "get" actors. However, a sense of appreciation quickly followed, and eventually I fell in love with them as a pattern for building distributed systems.

Distributed actors aren't new. [Microsoft Orleans](https://learn.microsoft.com/en-us/dotnet/orleans/overview) popularized the model through its concept of *virtual actors* for .NET, [born in  Microsoft Research](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/Orleans-MSR-TR-2014-41.pdf) and used to power high-scale scenarios like Halo's backend. [Akka](https://doc.akka.io/sdk/index.html) brought the actor model to the JVM ecosystem. [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) apply the same principles in a managed cloud environment, even if they rarely use the word "actor" when describing them. And even [Swift](https://developer.apple.com/documentation/swift/actor) now has actors built directly into the language for backend development.

But despite all this, distributed actors remain fairly unknown, and often misunderstood.

## What distributed actors really are

At its simplest, a distributed actor is a named entity in your system that owns some state and exposes methods to operate on that state. The critical property is that the actor runs single-threaded: only one call executes at a time. In effect, every method invocation is processed in a turn-based fashion.

This solves one of the hardest problems in distributed systems: concurrency. If the actor is the exclusive owner of its state, and it processes calls sequentially, you don't need locks, or optimistic concurrency, or database transactions just to keep things consistent. The actor itself acts as the serialization point.

Actors also live *in-memory*, inside whichever application instance is currently hosting them. In a cluster of N apps, an actor may end up co-located with the caller purely by chance. That's fine: you always talk to the actor through the runtime, and it knows where the actor lives. If the app hosting the actor crashes, the runtime simply places the actor elsewhere the next time it's called; the model is resilient by design.

## A familiar example: the shopping cart

Imagine you were building an ecommerce website, and were tasked to implement a shopping cart.

### Without actors

The traditional approach to a shopping cart is centered on a database. When a customer adds an item, your request handler:

1. Starts a transaction.
2. Loads the cart by ID.
3. Applies the update.
4. Commits the transaction.

You need the transaction because two concurrent requests could conflict. This is essentially the classic "double spending" problem: if two requests A and B happened at the very same time, A and B would load the same cart, and then would both make changes to it and save them concurrently, so that one of the two changes would be lost. The transaction ensures updates happen in order, but you pay for it: four round-trips to the database for every action.

### With actors

With actors, you define an actor type called `Cart`. Each cart ID corresponds to one actor instance, and that instance is the sole owner of its state. If a cart doesn't exist yet, the actor is created automatically by the runtime on the first call.

When you call `AddItem`, the actor performs the update entirely in memory and then persists the new cart to the database. No transaction required, because all calls are automatically serialized: the actor processes them one at a time. A second `AddItem` call queues behind the first, sees the updated in-memory state, and persists its own change. Reads such as `GetItems` can return data straight from memory without hitting the database at all.

You still persist to the database so the cart isn't lost if the app crashes, but you've eliminated most of the I/O: state is hot and local. only writes require interacting to the databaase, and because there's no need for reads beforehand or transactions, they're complete in a single round-trip (the only time you would read from the database is when an actor is first allocated, to check if there's state to resume from).

There's more, as you can also move the business logic into the actor itself, helping keep your code organized. For example, let's say your store allows a maximum of 10 items per cart. In the actor model, that enforcement becomes a simple `if` at the top of `AddItem`.

Or imagine a method such as `EmailCartContents`, which sends an email to the user. That operation can live directly in the actor, benefiting from the same consistency guarantees as everything else.

Here's a bit of pseudocode to illustrate the shape:

```ts
// Cart is an actor containing a shopping cart
class Cart(cartId: string) {
    private items: List<Item>

    // Invoked when the actor is initialized
    constructor() {
        // Load from the database any state to resume from
        this.loadFromDatabase()
    }

    public GetItems(): List<Item> {
        return this.items
    }

    public AddItem(item: Item): void {
        // Business logic: limit cart to 10 items
        if (items.count >= 10) {
            throw Error("Cart is full")
        }

        this.items.add(item)
        this.persistToDatabase()
    }

    public RemoveItem(itemId: string): void {
        this.items.removeWhere(it => it.id == itemId)
        this.persistToDatabase()
    }

    public EmailCartContents(address: string): void {
        sendEmail(address, this.items)
    }

    private loadFromDatabase() {
        // Populate this.items with data from the DB
        // Key is "cartId"
        // ...
    }

    private persistToDatabase() {
        // Save this.items
        // Key is "cartId"
        // ...
    }
}
```

This code looks like textbook OOP (Object-Oriented Programming), but the actor runtime adds the "magic". Each cart is a little stateful "microservice" with exactly one concurrent request at a time.

## Another example: an IP-based rate limiter

Rate limiting is one of those problems where engineers often reach straight for external databases like Redis. Redis works well, but it requires deploying and operating a cache cluster. With actors, you get another option, one that doesn't require any external service at all.

Imagine an actor type called `RateLimiter`, where each instance is identified by an IP address. The actor keeps a counter of requests in the last hour. Because the state doesn't need to be durable (if the server crashes, losing rate-limit history is fine), everything stays purely in memory.

Each request hits the actor for its IP, increments the counter, and either allows or rejects the request. Again, the single-threaded execution model gives us safety without locks or distributed transactions.

Here's a sketch:

```ts
class RateLimiter(ip: string) {
    private count: int
    private lastReset: datetime

    public AllowRequest(): bool {
        if (now() - lastReset > 1 hour) {
            this.count = 0
            this.lastReset = now()
        }

        this.count++

        if (count > MAX_REQUESTS_PER_HOUR) {
            return false
        }
        return true
    }
}
```

The runtime ensures all calls for a given IP go to the same actor instance, so concurrency issues simply vanish.

## Invoking your actors from application code

So far we've talked about what actors are and what they *do*, but not how you actually call them.

In a real framework you don't usually `new` an actor directly. Instead, you go through a runtime that knows how to:

- Locate or create the actor instance.
- Route the call to wherever that instance is currently loaded.
- Serialize the request and response.
- Handle retries, failures, and so on.

To keep things simple, let's use a very small, imaginary API:

```ts
ActorRuntime.Invoke(methodName: string, data: any): any
```

The runtime is already bound to a specific actor type and ID. You just tell it *what* you want to do (`methodName`) and pass the payload (`data`). The runtime takes care of the rest.

Here's what calling the `Cart` actor might look like from your web app:

```ts
// Somewhere in your request handler

let cart = ActorRuntimeFor("Cart", cartId)

// Add an item
await cart.Invoke("AddItem", {
    itemId: "abc-123",
    quantity: 2
})

// Read back the cart contents
let items = await cart.Invoke("GetItems", null)

// Email the cart contents
await cart.Invoke("EmailCartContents", {
    address: "someone@example.com"
})
```

The important bit is not the exact API shape, but the boundary: your application code just invokes methods on a logical actor, and the runtime resolves *where* and *how* the call is executed.

The same idea works for the rate limiter. Each IP gets its own actor instance, and your middleware just invokes a method on it:

```ts
// In your HTTP middleware

let limiter = ActorRuntimeFor("RateLimiter", clientIp)

let allowed = await limiter.Invoke("AllowRequest", {
    path: request.path
})

if (!allowed) {
    return TooManyRequests()
}

return next()
```

Again, all concurrency control and state management lives inside the actor. From the caller's perspective, it's just a method invocation that might fail or succeed like any other remote call.

## Deferred invocations: timers, reminders, alarms

Most actor frameworks also support deferred or scheduled invocations, often called *timers*, *reminders*, or *alarms*. This allows an actor to schedule future work without any external scheduler.

For example, our `Cart` actor could set a cleanup timer whenever it processes a request. If the timer fires after, say, 2 hours of inactivity, the actor can delete itself from memory and remove its corresponding record from the database. It's a clean, local, and self-contained lifecycle.

The modified pseudo-code could look like this:

```ts
class Cart(cartId: string) {
    public GetItems(): List<Item> {
        // Reset the timer after each invocation
        this.setDeactivateTimer()

        // Rest of the code unchanged
        // ...
    }

    public AddItem(item: Item): void {
        // Reset the timer after each invocation
        this.setDeactivateTimer()

        // Rest of the code unchanged
        // ...
    }

    public RemoveItem(itemId: string): void {
        // Reset the timer after each invocation
        this.setDeactivateTimer()

        // Rest of the code unchanged
        // ...
    }

    private setDeactivateTimer() {
        // Reset the timer so it's invoked after 2 hours of the last invocation
        ActorRuntime.setTimer("deactivate", date("+2 hours"))
    }

    // Method invoked by alarms
    public OnAlarm(alarmName: string) {
        if (alarmName == "deactivate") {
            // Delete the cart from the database
            // Key is "cartId"
            deleteFromDatabase()
        }
    }
}
```

Actors can maintain themselves, repair themselves, age-out their own state, and coordinate long-running operations without any cron jobs or queue orchestrators.

## Why the actor model is quietly powerful

Distributed actors sit at an interesting intersection. They're stateful, yet they scale horizontally. They're familiar to code against, yet powerful enough to express complex distributed workflows. They remove entire classes of concurrency problems by constraining how computation happens, not by bolting on transactional machinery. And they let you write business logic in a natural, object-shaped way while still operating in a distributed system.

They're not the right abstraction for everything, but when they fit, they often fit beautifully. Once the model clicks, you will very likely keep finding problems that actors make easier.

If you haven't used actors before, I hope this helped demystify them. And if you're building a distributed system that needs consistency, locality of state, or per-entity compute, I recommend giving them a serious look. They might become your favorite pattern too.
