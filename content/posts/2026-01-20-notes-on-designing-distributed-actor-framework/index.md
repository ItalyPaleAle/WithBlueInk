---
title: "On Designing a Distributed Actor Framework"
description: "Notes from my experiences using, maintaining, and designing actor frameworks"
date: 2026-01-20 00:00:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
comments: yes
resourceBundle: designing-distributed-actor-framework
coverImage:
  author: "Gabriel Vasiliu"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@conexspot"
slug: "notes-on-designing-distributed-actor-framework"
params:
  ogTitle: "Notes on Designing a Distributed Actor Framework"
---

If you're into distributed systems, building a distributed actor framework is one of those projects that sits at the intersection of challenging and deeply satisfying. It forces you to think about concurrency, state management, fault tolerance, and distributed coordination all at once. Even if you're not currently designing one, understanding how these systems work can sharpen your intuition for distributed systems in general.

These notes come from my experiences on multiple sides of the actor framework world. I was a maintainer of Dapr, which includes a distributed actor runtime. As a user, I've worked with actors in Dapr, .NET Orleans, and Cloudflare Durable Objects. And this past summer, I built my own actor framework in Go, tentatively named "Francis" (_a nod to the legendary Francis Ford Coppola, director of The Godfather_).

A quick disclaimer before we dive in: this is a **collection of notes** based on my own experiences. It doesn't necessarily reflect the correct, or even best, practices. Your designs may need to deviate based on your specific requirements. Think of this as a map of the territory I've explored, not a definitive guide.

## What is a distributed actor?

If you're already familiar with the distributed actor model, feel free to skip ahead. For everyone else, here's the short version.

A distributed actor is a **unit of state with single-threaded compute on top**, available to every application in a distributed system.

Each actor has a **type** (think of it as a class) and an **ID** (the specific instance). Together, the type and ID uniquely identify an actor within the cluster. A ShoppingCart actor with ID `user-123` is distinct from a ShoppingCart with ID `user-456`, and both are distinct from an Inventory actor with ID `warehouse-east`.

The "single-threaded" part is crucial. Each actor instance processes **one request at a time**. If multiple requests arrive simultaneously, they queue up and wait their turn. This eliminates an entire class of concurrency bugs: you never have to worry about race conditions or locks within an actor's state.

The "distributed" part means actors can **live on any node in the cluster**, and clients don't need to know where. You invoke an actor by its type and ID, and the runtime figures out which host is responsible for it. If that actor isn't currently active, the runtime spins it up transparently.

I've written a more thorough explanation of the distributed actor model in a [previous post]({{< ref "2025-11-19-distributed-actors-model" >}}) if you want the deeper dive.

## Some terminology

Before getting into the design challenges, let's establish a shared vocabulary:

- **Actor type**: The "class" of the actor, defining what methods it supports and what state it manages.
- **Actor ID**: The unique identifier for a specific instance of an actor of the given type.
- **Actor host**: A node capable of executing actors of a given type.
- **Cluster**: The set of all actor hosts.
- **Actor client**: An application that invokes actors but doesn't host them. _Note: A host can also be a client._
- **Turn-based concurrency**: Each actor instance serves one request at a time. Other requests wait their turn.
- **Hibernation**: When an actor has been idle for a while, the runtime can remove its state from memory. The actor's persistent state remains, and it can be reactivated later.
- **Alarms** (or **reminders**): A mechanism for an actor to schedule itself to be invoked at a future point in time, either once or on a repeating schedule.

## The problems you need to solve

Designing a distributed actor framework means solving a series of interconnected problems. I'll walk through them roughly in order of increasing complexity (as per my subjective evaluation), although in practice you'll be thinking about all of them at once.

### How to expose methods

At its core, an actor is something that receives messages and does work. The most straightforward way to expose this is as an **HTTP endpoint: `POST /actor/:actorType/:actorId/:method`**.

You want actors to support **multiple methods** so they can perform different operations on their state. A ShoppingCart actor might have `GetItems`, `AddItem`, `RemoveItem`, and `Checkout`.

POST is the right HTTP verb here since you're sending messages and expecting the actor to do something. POST requests are also treated as non-idempotent in REST conventions, which matches the semantics of actor invocations.

When designing an actor framework, you'll almost certainly want to build **an SDK that abstracts away the raw HTTP handling**. Developers shouldn't need to manually parse URLs and route requests. The SDK can also provide helpers for state management, which we'll get to later.

HTTP isn't the only option. **gRPC** works well too, with a single method like `InvokeActor(actorType, actorId, method, data)`. The choice depends on your ecosystem and performance requirements.

> What about message queues like Kafka, RabbitMQ, NATS, etc? They're generally not a good fit for external actor invocation. The async nature introduces latency that defeats the purpose of synchronous actor calls, and there's no natural way to send responses back to the caller.

### Turn-based concurrency

Each actor instance maintains **its own queue** of incoming messages. Two actors of the same type but different IDs have completely separate queues, and requests to one don't block requests to the other.

Your actor host needs to ensure that methods are invoked strictly **one at a time per actor instance**. When a request arrives for an actor that's already processing something, it joins the queue. Ideally, requests are processed in order, though some frameworks relax this guarantee.

The implementation typically involves a mutex or similar synchronization primitive per actor instance. The tricky part is managing these efficiently when you have thousands of active actors, each with their own queue.

### Actor lifecycle

One of the elegant properties of the actor model is that **actors don't require explicit activation**. Clients invoke an actor by type and ID, and if it's not currently active, the runtime activates it transparently on a capable host. The client doesn't know or care whether the actor was already running.

Many frameworks allow actor definitions to include **activation callbacks**. This might be a class constructor, or a dedicated method like Orleans' `OnActivateAsync`: these callbacks let actors initialize state, establish connections, or perform other setup work.

While active, actors should **keep as much state as possible in memory** for performance. Thanks to turn-based concurrency, there's no risk of concurrent modifications, so reads can be served directly from memory without synchronization. The exception is actors with very large state, where you might want to offload some data to disk or external storage.

When an actor has been idle for a configurable period, the runtime can **hibernate** it. In practice, this means deleting its in-memory state. The _idle timeout_ should be configurable per actor type, since the right value depends on your access patterns. Longer timeouts mean actors stay warm and responsive, but too long and you risk running out of memory with many idle actors consuming resources.

If the framework supports it, hibernation can trigger a **deactivation callback** (like Orleans' `OnDeactivateAsync`) for cleanup work. But here's a critical point: **do not rely on the deactivation callback being invoked**: actors can disappear without warning if the host process crashes or the server goes down. Any state you care about preserving must be persisted before the deactivation callback, not during it.

When a client invokes a hibernated actor, the runtime simply activates it again. The runtime has no special knowledge of whether an actor is "new" or "resuming", and actors themselves don't know either. On activation, the actor fetches any persisted state if it exists, and proceeds from there.

### Managing actor state

Actors need somewhere to store state that survives hibernation and host failures. This is typically an external **datastore** like a relational database, a key-value store, or a document database.

The framework should provide APIs for actors to read and write their state. A common pattern is a key-value interface **scoped to the actor**: `GetState(key)` and `SetState(key, value)`. Some frameworks offer richer abstractions, but key-value is very effective on its own.

Consistency matters here. When an actor writes state and then reads it back, it must see its own write, even if it's been moved to a different host (or datacenter) in the meanwhile: eventual consistency is usually not acceptable for actor state. This often constrains your choice of datastores and replication strategies.

Another consideration is the serialization format: JSON is human-readable and debuggable, ProtoBuf or MessagePack are more compact and faster. The choice affects storage costs, serialization overhead, debuggability, and the ability to share data between systems written with different technologies.

### Alarms or reminders

Actors often need to do work at some point in the future. Maybe an Order actor should check if payment has been received after 30 minutes, or a Session actor should expire after an hour of inactivity.

**Alarms** (sometimes called **reminders**) let an actor schedule a future invocation of itself. They can be **one-shot** or **repeating** on an interval, optionally with a maximum number of repetitions or a TTL after which the alarm is automatically deleted.

When an alarm fires, it's delivered as a regular message to the actor. With turn-based concurrency, alarms wait for the actor to become available, just like any other request. If the actor is hibernated when the alarm's due time comes up, the runtime activates it on a capable host (assuming there's capacity). This means alarms survive hibernation and even host restarts: if an actor sets an alarm and then hibernates, the runtime will reactivate the actor when the alarm fires.

> **Fire-and-forget with alarms**. An interesting case: alarms can be scheduled for "right now" (with a due time in the past or immediate). This enables patterns like _fire-and-forget messaging_, where you want to invoke an actor without waiting for a response. The alarm gets queued for immediate execution, and you get the framework's built-in retry logic for free.

#### Alarm identity and APIs

Each alarm needs a unique identifier: typically a tuple of **`(actorType, actorId, alarmName)`**: the `alarmName` lets a single actor have multiple distinct alarms.

Your framework needs at least two APIs for alarms:

1. Create or update: If an alarm with the same name already exists for that actor, the old one is replaced. This is important for patterns like "reset the session timeout on every user action."
2. Delete: Cancel a pending alarm.

A design choice: should only the actor itself be allowed to manage its alarms, or can external clients create and delete alarms too? Restricting to the actor itself is safer and simpler to reason about, but external alarm creation can enable useful patterns like scheduled job triggering.

#### Centralized alarm execution

It's generally best to have a **centralized service handle alarm execution**. In Francis, the same controller that handles actor placement also executes alarms. The centralized service watches for alarms that are due, makes a synchronous invocation to the actor, waits for the work to complete, and only then marks the alarm as done (or schedules the next occurrence for repeating alarms).

Alarms need **persistent storage** so they survive controller crashes. The storage tracks the alarm's identity, due time, repeat interval (if any), and any payload to deliver to the actor.

#### Delivery guarantees and edge cases

Like everything in distributed systems, achieving _exactly-once_ delivery for alarms is incredibly hard. Most systems settle for **_at-least-once_ delivery**, which means alarms might occasionally be delivered more than once.

Consider this scenario: the actor receives the alarm, completes the work, sends an acknowledgment back to the controller, but the controller never receives it due to a network failure. The controller will retry, and the actor receives the alarm again. Your actor code needs to handle this gracefully, ideally by making alarm handlers idempotent.

A few other edge cases to consider:

- Alarm controller downtime: if the controller (or all its replicas) is down when an alarm is due, it should execute as soon as possible after coming back online.  
  However, for repeating alarms, if multiple occurrences were missed (say, a per-minute alarm during a 10-minute outage), execute it only once rather than firing 10 times in rapid succession and overwhelming the actor.
- No available hosts: if there's no host capable of running the actor (because all hosts for that actor type are down or at capacity), the alarm should be retried later once capacity becomes available, rather than being silently dropped.
- Failed execution: if an alarm fires but the actor invocation fails, the controller should retry after a delay. However, set cap the retries eventually to avoid infinite loops when an actor is fundamentally broken.

### Failure handling and retries

Distributed systems fail in creative ways. Hosts crash, networks partition, databases become temporarily unavailable. Your actor framework needs a strategy for handling these failures.

For actor invocations, the question is: what happens when a call fails? Some frameworks automatically retry with exponential backoff. Others surface the error to the caller and let them decide. The right choice depends on whether the operation is idempotent and how your users expect errors to behave.

Host failures are particularly interesting. If a host crashes while an actor is processing a request, what happens? The client will see a connection error and might retry. But if the actor had partially updated its state before crashing, you could end up with inconsistent data. This is mostly a problem for developers building actors than for the runtime itself, and it's where careful state management and idempotency become important.

### Communicating between actors

Actors don't exist in isolation. An Order actor might need to call an Inventory actor to reserve items. A Game actor might broadcast state updates to multiple Player actors.

The mechanics of actor-to-actor communication*are similar to client-to-actor communication: you invoke by type and ID, and the runtime routes the request. But there's a subtle trap waiting for you: **reentrancy**.

Consider what happens if Actor A calls Actor B, and Actor B synchronously calls back to Actor A. Under turn-based concurrency, Actor A is blocked waiting for B's response, which means A's queue isn't processing new requests. When B's callback arrives, it joins A's queue behind… A's own pending request. The result is a **deadlock**.

Different frameworks handle this differently. Orleans supports reentrant grains (actors are called _grains_ in Orleans): you can mark a grain class with `[Reentrant]`, and Orleans will allow callbacks within a call chain to enter the actor even while it's "busy" waiting. Orleans tracks the call chain via a _correlation ID_ in the request context. Other frameworks simply document the footgun and leave it to developers to avoid circular calls.

Some frameworks also support **"fire-and-forget"** invocations, where the caller sends a message but doesn't wait for a response. This is useful for notifications and events where you don't need acknowledgment. The challenge is error handling: if the message fails, there's no way to tell the caller. One workaround, used by Dapr Workflow internally, is to implement fire-and-forget as an immediately-scheduled alarm. You get the framework's built-in retry logic, at the cost of some additional latency due to the need to manage persistency and because of the alarm scheduler.

### Inter-cluster communication

Inside a cluster, all clients need to be able to reach all hosts. Hosts run HTTP or gRPC servers that must accept incoming requests from anywhere in the cluster.

Security matters here. You almost certainly want TLS for in-cluster communication, which means generating and distributing certificates. You probably also want authentication, either via **mTLS** (where the certificate itself proves identity) or at the application layer with **tokens or API keys**.

If your actors need to communicate across cluster boundaries, perhaps between different regions or environments, the complexity multiplies. You need to handle different network topologies, higher latencies, and potentially different trust boundaries.

### Placing actors on hosts

This is where distributed actor frameworks get genuinely interesting. When a client invokes an actor, how does the system decide which host should run it?

The most important constraint is that a given actor instance must run on **exactly one host at a time**. If the same actor somehow runs on two hosts simultaneously, you lose the single-threaded guarantee and all the consistency properties that come with it. An actor runtime's main job is to prevent this catastrophic possibility.

There are two broad approaches, centralized or decentralized placement.

#### Centralized placement

In this model, a dedicated **controller service** maintains the mapping from actors to hosts.

When a client wants to invoke an actor, it first asks the controller "where does this actor live?" The controller either returns the address of a host that's already running the actor, or picks a host and tells the actor to activate there.

- The **advantages** are flexibility and global knowledge.  
  The controller can make smart placement decisions based on host load, locality, or other factors.  
  It can rebalance actors across hosts as conditions change, given that it has a complete view of the cluster.
- The **disadvantages** are the extra latency (every invocation needs a controller round-trip) and the controller being a single point of failure.  
  If the controller goes down, no new actors can be invoked. You can mitigate this with replication, but then you need to coordinate state across controller replicas.

In my "Francis" framework, the controller stores placement information in a Postgres or SQLite database. This lets the controller itself be replicated for availability, but the database becomes the bottleneck at scale. Orleans takes a different approach, using a distributed hash table to replicate placement information across nodes in memory.

Caching can help with the latency problem. After invoking an actor, clients can cache the placement information and skip the controller on subsequent calls. But caching introduces its own challenges: what if the actor moves to a different host, or the original host restarts?

Here's a pattern for safe placement caching:

1. Each host generates a random _host ID_ on startup. If the process/container restarts, it gets a new ID.
2. Placement responses include `(actorType, actorId, address, port, hostId)`.
3. Clients cache this tuple, with a cache TTL based on either a configured maximum or the actor's hibernation deadline.
4. When invoking an actor, the client includes the cached `hostId` in the request header.
5. The receiving host compares the request's `hostId` with its own. If they differ, the host was restarted and isn't running that actor anymore. The client must re-query the controller.

This catches the case where a cached address points to a host that has restarted and no longer has the actor active.

#### Decentralized placement

The alternative is to eliminate the controller entirely. In this model, clients determine actor placement themselves using a deterministic algorithm, typically _consistent hashing_.

The biggest **advantage** is the reduced latency when invoking actors. Given a list of known hosts and an actor's type and ID, consistent hashing produces the same answer everywhere without any coordination: no controller round-trip, no single point of failure. Clients just need an up-to-date view of which hosts are in the cluster.

The membership list can be maintained via a gossip protocol, a shared configuration store, or simply by having all hosts register with a service discovery mechanism that clients also read from.

Consistent hashing also handles host changes gracefully. When a host joins or leaves, only a fraction of actors need to move, proportional to the change in cluster size. This is much better than naive modulo hashing, which would shuffle almost everything.

The **downsides** are reduced flexibility and more complex failure handling.  
You can't easily rebalance actors based on load since the hash function determines placement.  
And if a host fails, actors that hash to it become temporarily unavailable until the membership list updates everywhere. Clients might send requests to a dead host, wait for a timeout, and only then retry with an updated membership list.  

Finally, every time there's a change in the number of hosts (e.g. a host is added or removed), the placement tables must be disseminated to every node (client or host) in the cluster. While that's happening, the cluster must be in a frozen state: no actor can be invoked until each node has received the updated table. This can be a problem in clusters with lots of nodes. Lots of hosts means changes happen more frequently. Lots of clients means disseminating changes takes longer.

The decentralized placement approach works best when the number of actor hosts is limited and, most importantly, stable.

### Handling host failures and rebalancing

When a host fails, actors that were running on it need to be activated elsewhere.

In the _centralized model_, the controller detects the failure (via **health checks** or heartbeats) and updates its placement information. Subsequent invocations for affected actors get routed to new hosts.

In the _decentralized model_, the membership list updates to remove the failed host, and the consistent hash function naturally routes affected actors to different hosts. The challenge is propagating the membership change quickly enough to minimize disruption.

Either way, actors activated on a new host start fresh. They load any persisted state, but in-memory state from the failed host is lost. This is why persisting state promptly matters.

**Rebalancing**, moving actors proactively to even out load, is much easier with centralized placement. The controller can decide to move an actor (asking the current host to shut the actor down before the hibernation deadline), update its placement information, and let the next invocation activate it on the new host. With decentralized placement, you're mostly stuck with whatever the hash function gives you, unless you introduce **virtual nodes** or other techniques to influence distribution.

## Maintainability and scaling

The problems above cover the basics of a working actor framework. But building something production-ready, especially at scale, introduces additional challenges.

### Actor versioning and upgrades

How do you roll out a new version of actor code without downtime?  
During a rolling deployment, some hosts run v1 and others run v2. Or, an actor might be hibernated on a v1 host and later reactivated on a v2 host.

If the new code expects a different state shape, say a field was renamed or a nested object was flattened, you need a migration strategy. Options include _lazy migration_ (the actor transforms old state on activation), explicit migration scripts run during deployment, or _versioned state_ with adapters that can read multiple formats.

Some frameworks support **actor type versioning** where v1 and v2 are treated as entirely different types. This allows gradual migration but adds complexity to client code that needs to know which version to invoke.

### Observability

When something goes wrong in a distributed actor system, you need visibility into what happened. This means tracing, logging, and metrics.

**Distributed tracing** with OpenTelemetry integration is critical for debugging production issues. A single user request might touch dozens of actors across multiple hosts. Without tracing, correlating those interactions is nearly impossible.

**Logs** should include trace IDs too, so you can connect log entries across actor invocations. OpenTelemetry-enabled logging libraries can often do this automatically.

Finally, **metrics** should cover actor activation counts, invocation latency, queue depths, state sizes, and hibernation rates. These help you understand system behavior and detect problems before they become outages.

### Garbage collection of actors

What happens to actors that will never be invoked again? Consider a ShoppingCart actor for a session that was abandoned. The actor itself gets hibernated, but its persisted state sits in the database forever, consuming storage.

Two approaches to state cleanup:

- **Active cleanup via alarms**: Every time an actor is invoked, it sets or resets an alarm for some point in the future (say, 12 hours).  
  If the actor isn't invoked again before the alarm fires, the alarm triggers and the actor deletes its own persisted state. This is a programming pattern; the framework doesn't need special support.
- **Passive cleanup via TTL**: When state is persisted, it includes a time-to-live (TTL).  
  Either the datastore supports TTLs natively (some do), or the framework runs a background job that periodically deletes expired state. For Postgres or SQLite, this might be a scheduled query that removes rows past their TTL timestamp.

**Alarms** themselves generally should not be garbage collected, since an alarm for a hibernated actor is supposed to wake it up. But repeating alarms might benefit from a maximum lifetime to prevent runaway actors from consuming resources indefinitely.

### Backpressure

What happens when requests arrive faster than an actor can process them? The per-actor queue grows. But should it be bounded or unbounded?

- **Unbounded queues** risk out-of-memory conditions if a popular actor gets flooded. They also mean callers might wait arbitrarily long for responses, likely timing out before they're served.
- **Bounded queues** force a decision: when the queue is full, do you reject new requests or block the caller? Rejection is cleaner but means the client needs to handle failures. Blocking can cascade into broader system slowdowns.

Another concern is **host-level overload**. Some frameworks limit the number of active actors per host. In the centralized model, the controller can avoid assigning new actors to an overloaded host. In the decentralized model, this is harder since the hash function determines placement. The host can reject activation requests, but the actor can't automatically move elsewhere.

Finally, **client-side backpressure** also matters. How do clients learn to slow down? Returning HTTP 429 with a `Retry-After` header is one option. This ties back into observability: you need metrics to detect overload before it cascades into an outage.

### Partitioning and sharding at scale

At very large scale, with millions of actors and hundreds of hosts, even the approaches described above have limits: the placement table or membership list becomes huge, a single controller database or gossip protocol can't keep up, network topology starts to matter as cross-datacenter latency affects every invocation.

Partitioning strategies include:

- **By actor type**: Different pools of hosts handle different actor types. This is operationally straightforward but limits flexibility; you can't easily have actors of different types on the same host.
- **By actor ID prefix or range**: Actors with IDs starting with A-M go to partition 1, N-Z to partition 2. This allows horizontal scaling of the control plane while keeping actor types flexible.
- **By tenant**: In multi-tenant systems, each tenant's actors are isolated to a partition. This provides natural isolation and allows per-tenant scaling.

**Cross-partition actor communication** adds complexity. Now you need routing between partitions, which might live in different regions with different latency characteristics.

Finally, note that **alarms may need partitioning too**. Often they can follow the same partitioning scheme as the actors themselves, but at high scale, alarm storage and execution become their own bottleneck.

## Where to go from here

Building a distributed actor framework is a deep rabbit hole. I've touched on the major problems you'll encounter, but each one could easily be its own article. The details of consistent hashing algorithms, the subtleties of distributed consensus, the trade-offs between different serialization formats… there's always more to learn.

If you're considering building your own framework, I'd encourage you to start small. Get the basics working: actor invocation, turn-based concurrency, state persistence. Then add complexity incrementally as you understand your actual requirements. Premature optimization for scale you don't have yet is a common trap.

If you're evaluating existing frameworks, I hope this gives you a better sense of what questions to ask. How do they handle placement? What happens during host failures? How do they approach versioning and upgrades?

And if you just find distributed systems interesting, I hope these notes have been a useful tool or at least just a fun read. There's something deeply satisfying about building systems that coordinate work across many machines while maintaining strong guarantees. Actors are one elegant way to tame that complexity.
