---
title: "Please all, stop writing your own user authentication code"
description: "It's time to adopt safer solutions, and save time and money"
date: 2020-04-08
author: "Alessandro Segala"
image: "img/authentication.jpg"
comments: yes
authorTwitter: "@ItalyPaleAle"
slug: "stop-writing-your-own-user-authentication-code"
---

Most apps require some sort of authentication. You might be a developer working for a large company on their line of business apps, which require limiting access to authorized employees and checking their permissions. Or, you might be building a new SaaS app and you want users to create and maintain their profiles.

In both those cases and more, your first step when building the app will likely be creating the authentication and user management workflows. That is: a sign-up form and a login page, at the very least. Authentication is one of the most common features developers working on web apps are asked to implement, yet it's also one of the most overlooked ones.

Building a *safe* authentication system is a really hard task, much harder than you'd think, and very easy to get wrong. Even worse, mistakes can have catastrophic effects. At its core, user management and authentication require just a few web forms, and it could *appear* to be a very simple task. However, the devil is in the detail, and building those things securely (and in a privacy-conscious way, when possible or even required) is not small feat.

## Identity-as-a-Service

The good news is that you don't need to roll your own user management and authentication logic. It's 2020, and we have plenty of valid Identity-as-a-Service solutions that make it extremely easy to add identities to your application, safely.

To mention a few popular options (in alphabetic order):

- [Auth0](https://auth0.com/)
- [Azure AD](https://docs.microsoft.com/en-us/azure/active-directory/fundamentals/active-directory-whatis) for enterprise apps (works with the Office 365 directory), and [Azure AD B2C](https://docs.microsoft.com/en-us/azure/active-directory-b2c/active-directory-b2c-overview) for SaaS
- [Google Identity Platform](https://developers.google.com/identity) for enterprise and consumer apps (works with the G Suite directory too)
- [Okta](https://www.okta.com/)

Additionally, there are social networks' identity providers too, such as [Apple](https://developer.apple.com/sign-in-with-apple/), [Facebook](https://developers.facebook.com/docs/facebook-login/), [GitHub](https://developer.github.com/v3/guides/basics-of-authentication/), [Twitter](https://developer.twitter.com/en/docs/twitter-for-websites/log-in-with-twitter/login-in-with-twitter), etc. These are very easy for consumers to use, and provide apps with access to potentially lots of data right off the bat, but sometimes might have negative privacy implications for your users.

There's really no reason why you shouldn't use an identity provider service. They will save you a lot of development time that you can invest in building your actual app, and they're very powerful right out of the box. Most importantly, however, they're significantly safer than rolling your own solution.

## Security is in the large numbers

Most identity provider services offer advanced security features, such support for multi-factor authentication (MFA), or security certificates or keys (including U2F, FIDO2, [WebAuthn](https://www.yubico.com/wp-content/uploads/2019/10/WebAuthn-Why-it-Matters-How-it-Works.pdf), etc).

Don't under-estimate the importance of this: according to a [report by Microsoft](https://www.microsoft.com/security/blog/2019/08/20/one-simple-action-you-can-take-to-prevent-99-9-percent-of-account-attacks/), enabling MFA can prevent 99.9% of account compromise attacks.

However, there's another, lesser-known aspect that makes using an identity provider service safer than rolling your own solution: thanks to their very large number of users, they can see patterns and prevent attacks more easily.

By having millions of users who perform millions of authentications per day, these large identity providers have gained enough data to build AI-infused models that better identify suspicious patterns.

For example, let's say that one of your users based in Canada signs in from their home, and then two hours later the same account is successfully used in Ukraine. Identity provider services would flag this as suspicious, and would deny the sign-in outright, or at least ask for another form of verification (e.g. a MFA token). They can also notify the impacted users and/or the admins.

## Common objections

### But, it's not really hard to build a user management and authentication logic

Sign up and log in forms are just one side of the issue. You need to deal with a lot more than just building a form to allow users to create an account and type their credentials.

To start, you need implement other business logics, such as enforcing password security rules (*but please, listen to the NIST and [don't forcefully make passwords expire at regular intervals](https://pages.nist.gov/800-63-FAQ/#q-b05), and [don't impose creative rules](https://pages.nist.gov/800-63-FAQ/#q-b06) such as requiring uppercase and lowercase and symbols and…*) validating email addresses and/or phone numbers, and offering users a way to reset their passwords (securely).

There are lots of details to keep in mind while designing those systems, and making mistakes is surprisingly easy: very large companies have been caught not hashing passwords in their databases (or not hashing them *properly*), accidentally dumping passwords in clear-text in log files, having password reset forms that can be exploited too easily with social engineering, etc.

Lastly, applications can greatly benefit from advanced security features that many providers already offer, including support for multi-factor authentication and security tokens.

### But, those services authentication services aren't always free, especially as my app grows

You know what else isn't free? Getting hacked and having to pay the damages, in terms of direct remediation costs (if any), in terms of time spent fixing the app urgently, and not least in terms of loss of trust from your users.

Even before that, implementing a safe authentication system and maintaining it, operating the user database, etc, all come at the cost of time and resources for both development and operations.

### But, I am a very senior developer and I know how to build a safe authentication system

First of all, congratulations, as really knowing how to build these things safely is less common than you'd think and expect.

If you really are a very experienced developer, however, chances are that your time is best spent working on other parts of your app, which deliver more value to your users.

Or, if you really want to work on auth systems, you might consider joining companies like Microsoft, Auth0, Facebook, etc, and work on improving their identity platforms.

### But, I want to maintain control over my users

To start, let me ask you: *why?*. Unless you're building the new Facebook, in which case, yes, data will be your biggest asset and the more you collect, the better; you probably don't really *need* it.

Additionally, collecting more data about your users might even increase your costs to comply with regulations like GDPR. And it will make breaches potentially more damaging and more expensive.

Most solutions I listed above still let you get deep visibility over your users and what they do.

Hosted services tend to be a bit sticky, so if you're concerned about the ability to migrate to something else in the future, you might consider using a self-hosted identity server instead–but remember those systems are more complex to maintain and often lack the advanced security features possible because of the numbers.

## How to get started

I hope I convinced you to switch to an identity provider. Now, let's see how to get started.

The good news is that all the four providers I listed above (Auth0, Azure AD, Google Identity Platform, Okta) and many more leverage the same protocols: OpenID Connect / OAuth 2.0. Both are modern, industry-standard protocols, with client libraries for every programming language and framework.

At a high level, the steps include:

1. Register your application with the identity provider. They will give you an Application ID (or Client ID) and a Secret Key (or Client Secret).
2. Define the permissions your app requires. In addition to returning the user's profile, depending on the identity service you can also get access to much more data, including the user's email inbox, their cloud storage, etc (e.g. via Office 365 or G Suite)
3. Include the client library in your app

Without trying to explain in details how OpenID Connect works, the general flow involves the app redirecting the user to a page on the identity provider's server. The user will complete the authentication flow there, and then is redirected to your app along with a JWT token.

This JWT token, which is cryptographically signed and has a validity limited in time, can be used to maintain a session for your user. That is, for as long as the token is valid, when it is presented to your application you can treat the request as if coming from the user the token belongs to.

The same JWT token also includes claims about the user. These vary depending on the service, but usually they include the user name, their email address and/or their ID.

Your application can use those claims to identify the user, and you can use the same user ID to refer to data stored in your application.

As mentioned above, JWT tokens are cryptographically signed, so when you verify the token's signature, you're guaranteed that no one tampered with the claims.

### Using OpenID Connect in a client-server app

The instructions depend heavily on the language or framework you're using to build your app.

The [jwt.io website](https://jwt.io/#libraries-io) has a comprehensive list of libraries to verify JWT tokens.

For some stacks, you can also leverage higher-level solutions, such as [express-jwt](https://github.com/auth0/express-jwt) or [passport](https://github.com/jaredhanson/passport) for Node.js/Express.

### Using OpenID Connect in a static web app or a native app

Static web apps (also known as "JAMstack apps") and native apps (e.g. desktop or mobile) can use OpenID Connect in a slightly different way. In the OAuth 2.0 specification, this is called the "implicit flow" in the OAuth 2.0 specification.

The implicit flow does not require using a Client Secret: because your app runs on the client, there's no way to safely distribute that.

1. Your app redirects the user to the authentication endpoint, making sure that the query string contains `scope=id_token`
2. The user completes the authentication flow with the identity provider
3. The user is redirected to your app, and the JWT session token is appended as a fragment to the page URL's (the fragment is what follows the `#` sign). It is in a field called `id_token`.
4. Your app gets the JWT from the URL's fragment, then validates it. If it's valid, your user is authenticated, and you can use the claims inside the JWT to get information on the user.

To validate a JWT in a static web app, you can use the [idtoken-verifier](https://github.com/auth0/idtoken-verifier) module. Desktop and mobile apps can use similar libraries for the technology you're using to develop them.

> When building client-side apps such as static web apps or native ones, it's important to ensure that tokens are signed using RSA-SHA256 (in the JWT header, `alg` must be `RS256`), which is asymmetric: tokens are signed with a secret key within the identity provider, and your app can verify them using a public key. The other common algorithm, HMAC-SHA256 (or `HS256`), uses a symmetric key to sign and verify tokens, which cannot safely be distributed to client-side apps.

Your client-side app can then use this JWT in each request made to back-end API servers, usually passed in the `Authorization` header or in a cookie. In this case, the JWT acts just like any other session token, but with self-contained claims.

The API server will check the presence of the JWT and validate it again; if the validation succeeded (and the token has not expired), it can consider the user as authenticated and read its user ID from the claims inside the JWT.

<small>*Cover photo by Paulina Sáez ([Unsplash](https://unsplash.com/@polisaez))*</small>