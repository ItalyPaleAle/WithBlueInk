---
title: "Business logic does not (usually) belong in the database"
description: "When to use stored procedures or complex queries, and when to keep logic in your application server"
date: 2026-03-04 00:00:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
comments: yes
resourceBundle: "db-or-app-server"
coverImage:
  author: "Kelsy Gagnebin"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@kelsymichael"
slug: "business-logic-does-not-belong-in-the-database"
---

A while back, while building a fairly data-heavy application, I started developing (pun intended) an appreciation for stored procedures. I could move certain logic into the database with the promise that things would be *fast*. No round-trips, no serialization overhead, just the database doing what it does best, right next to the data. I got excited. Maybe a little too excited.

Over the following months, more and more business logic was migrated into stored procedures and complex queries—I'm talking hundreds (plural) of lines of SQL code, with branches, loops, etc. It worked great… until it didn't. Deployments became painful because every release required coordinating application changes with database migrations. Debugging got harder: when something went wrong, the tooling was just not there. Writing tests became a lot harder, especially because there's no pure SQL unit testing framework. And the database server, which was the most expensive piece of infrastructure we were running, was now shouldering work that had nothing to do with storing or retrieving data.

We eventually pulled most of that logic back into the application, and the experience taught me a lot about where business logic actually belongs.

## The forces at play

The answer, it turns out, comes down to understanding two fundamental constraints of server-side systems.

The first is that **the network is almost always the bottleneck**. It's the slowest part of any distributed system, adding latency to every request and capping throughput. Even a 10 Gbps link between two servers in the same rack isn't "free": there's still serialization overhead and the fact that every network hop is orders of magnitude slower than an in-memory operation. This gets worse in a hyperscale cloud environment, where network latency between services is often in the order of single-digit milliseconds at best, and can spike higher under load: while a millisecond may not seem much, each database round-trip has to pay for this, which means each query in a sequence.

The second is that **app servers and database servers have very different cost profiles**. App servers are commodity hardware. You can run them on the smaller VMs your cloud provider offers, and when you need more capacity, you spin up more instances behind a load balancer, possibly with auto-scaling. Databases, on the other hand, especially at scale, demand specialized hardware: fast CPUs, large amounts of memory, and high-performance storage. Scaling a database vertically is expensive, and scaling it horizontally (sharding, read replicas) adds significant operational complexity. In general, it's much cheaper and much easier to add another app server than it is to upgrade or scale out your database.

These two facts shape the entire discussion. This is not specific to any database: it applies just as well to Postgres, MySQL, Microsoft SQL Server, etc.

## In almost all cases: keep logic in your app

After going through the cycle of moving logic into the database and then pulling it back out, I came to appreciate why the application server is the right place for the vast majority of business logic. Many of these are things I didn't fully value until I lost them.

**It's cheaper hardware, and it scales horizontally.** When traffic spikes, you can add more app server instances in minutes. Database servers don't scale that way. Every cycle of business logic you move off the database is a cycle you're running on hardware that's cheaper and easier to scale. If your stored procedure is doing work that doesn't strictly need to be co-located with the data, you're burning expensive database CPU time that could be spent answering queries instead.

**Deploying updated logic is straightforward.** Pushing a new version of your application is a well-understood process: build, test, deploy. Updating stored procedures, on the other hand, requires running database migrations, which often need to be coordinated carefully, may require downtime or at least extra caution, and are generally harder to roll back if something goes wrong. In our case, what used to be a clean "deploy the app" step turned into "deploy the app *and* run these migration scripts in the right order, and hope nothing breaks in between". In many teams, deploying database changes involves a different (and slower) approval process than deploying application code.

**Your debugging and observability tools are better.** Modern application development gives you powerful debuggers, structured logging, distributed tracing, and profiling tools. With database stored procedures, you're largely on your own. Most database engines offer limited debugging support, and correlating a stored procedure's behavior with the rest of your system's telemetry is painful.

**Testing is more practical.** Writing unit tests for application code is a solved problem across every major language and framework. Testing stored procedures typically requires a live database instance, is slower, harder to isolate, and doesn't integrate well into CI/CD pipelines.

**Gradual rollouts are simpler.** With application code, we have well-known processes and tools to do blue/green deployments, canary releases, feature flags, and progressive rollouts. You can have multiple versions of your logic running side-by-side, shifting traffic gradually to validate that the new version behaves correctly. Stored procedures don't give you that flexibility: the database is a shared resource, and all callers see the same version of a stored procedure at the same time. If a migration introduces a bug in a stored procedure, every client is immediately affected.

**Separation of concerns stays clean.** More philosophically, the database's job is to store and retrieve data efficiently. Your application's job is to implement business rules. When you push business logic into stored procedures, you blur that line, making your system harder to reason about. Business rules end up scattered across two very different codebases (one in your application's language, one in SQL), written in different paradigms, tested with different tools, and deployed on different schedules.

Here are some examples of work that usually should belong in your application server:

- **Validating business rules** before writing data: checking that a user has permission to perform an action, that an order meets minimum thresholds, or that input data conforms to your domain's constraints.
- **Orchestrating workflows** that involve multiple steps or external services: processing a payment, sending a notification, updating a search index.
- **Transforming data for an API response**: formatting dates, computing derived fields, assembling nested objects from multiple queries.
- **Any logic that's likely to change frequently**: pricing rules, promotion logic, onboarding flows: anything that the business side iterates on regularly.

## The exceptions: when the database is the right place

Now, I'm not saying I regret *all* of it. Some of the logic I moved into the database genuinely belonged there, and that's where it stayed even after I cleaned things up. These cases tend to share a common trait: the alternative would involve **moving large amounts of data across the network**, **holding database locks longer than necessary**, or **both**.

### Aggregations and analytical queries

If you need to scan thousands or millions of rows to compute a sum, an average, a count, or any other **aggregate**, doing that in your application means pulling all those rows across the network and into the app server's memory. That's slow, bandwidth-intensive, and memory-hungry.

The database engine is purpose-built for this. It can scan rows directly from storage, apply the aggregation in-process, and return a single result. The data never leaves the machine.

For example:

```sql
-- Instead of fetching every order row and summing in your app:
SELECT customer_id, SUM(amount) AS total_spent
FROM orders
WHERE created_at >= '2026-01-01'
GROUP BY customer_id
HAVING SUM(amount) > 1000;
```

This is a query that might scan millions of rows but returns only a handful of results. Running it in the database avoids shipping all that data over the wire.

The same principle applies to JOINs. When you need to **combine data from multiple tables**, the database can do this efficiently using its query planner, indexes, and in-memory buffers. Fetching the data from each table separately into your app, then joining in application code, is almost always slower and more complex.

A practical note: these kinds of queries are often analytical or reporting-oriented. If that's the case, consider running them against a **read replica** rather than your primary database, so you don't add load to the instance serving your production traffic.

### Reducing round-trips and lock duration

Consider a transactional workflow where you need to read a value, perform some calculations, and write back the result, all within a transaction to ensure consistency. If each step is a separate network round-trip, you're holding a database lock for the duration of all those round-trips combined, with the other transactions that need the same rows are blocked and waiting.

In this case, wrapping the transaction inside a stored procedure, or creating more complex queries, could make more sense:

```sql
-- A simple "claim the next available task" pattern.
-- Done as a single statement, this is fast and holds the lock briefly:
UPDATE tasks
SET status = 'processing', assigned_to = @worker_id
WHERE id = (
    SELECT id FROM tasks
    WHERE status = 'pending'
    ORDER BY priority DESC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
);
```

If you had done this in your application, within a transaction, you would have had a total of 4 database round-trips:

- An initial `BEGIN TRANSACTION` statement to start the transaction. While this is normally abstracted by higher-level methods your database library offers, under the hood it does require sending a `BEGIN TRANSACTION` command to the database, which requires a roundtrip.
- A `SELECT` query to retrieve the first available task.
- An `UPDATE` query to update the retrieved task.
- Finally, a `COMMIT TRANSACTION` statement (which is usually abstracted by libraries).

While the query above may be more complex, reducing from 4 round-trips to 1 (or a 75% reduction) significantly reduces the impact of network latency.

When using a transaction, the duration of the lock is significantly shorter, with your rows/tables being locked for microseconds instead of milliseconds.

### Enforcing consistency across multiple consumers

Sometimes, multiple different applications or services access the same database. Maybe you have a web app, a batch processing system, and a data pipeline, all reading and writing to the same tables.

When a particular business rule must be enforced regardless of which system is writing the data, placing that rule in the database can be the most reliable approach. This could be a view, a stored procedure that all writers must call, a trigger that fires on insert or update, or a CHECK constraint.

For example, if every system that inserts a financial transaction must also update a running balance, a trigger or stored procedure ensures that invariant holds even if one of the consuming applications has a bug or skips a step.

This isn't without trade-offs. Triggers in particular can make debugging harder and introduce surprising behavior. But when the alternative is trusting every consumer to independently implement the same logic correctly, the database becomes a reasonable enforcement point.

## It's about where the data is

The pattern behind the exceptions is data locality. When the operation needs to touch a large volume of data and the result is small, let the database do the work. When the operation is primarily about applying business rules and the data volume is modest, keep it in your app where the tooling is better and the hardware is cheaper.

Most business logic falls squarely in the second category. Looking back, the instinct that led me down the stored procedure path came from seeing how fast things could be when the logic ran right next to the data. That's real, and for the right workloads, it's the correct call. But I was generalizing from the exception, not the rule. The overhead I was saving on network round-trips, I was paying back many times over in deployment pain, debugging difficulty, and expensive database CPU cycles spent on work that a commodity app server could have handled.

Today, when I'm deciding where a piece of logic should live, I ask myself one question: am I doing this because the data needs to stay close to the computation, or because it just feels like a convenient place to put code? If it's the latter, the app server is almost certainly the better home for it.
