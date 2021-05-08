---
title: "Why storing secrets and passwords in Git is a bad idea"
description: "And what you should do with your apps' secrets instead"
date: 2021-05-07 00:00:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
comments: yes
resourceBundle: secrets
coverImage:
  author: "Zan"
  linkName: "Unsplash"
  linkURL: "https://unsplash.com/@zanilic"
slug: "storing-secrets-and-passwords-in-git-is-bad"
---

Today I was in a conversation with some developers and we started talking about proper storage for the secrets that an application needs. These are things like database passwords, API keys, authorization tokens, encryption keys, certificates, etc: collectively, we can refer to them as **secrets**.

As the name suggests, a lot of care should be put into protecting them, as if they were to end up in the wrong hands, they could cause your app's security to be severely compromised–or worse.

When you're building and deploying an app, how should you be managing secrets? And where should you be storing them?

I want to start by saying that there are multiple correct ways of dealing with that problem; in this article, we'll be looking at three (plus a bonus one). However, there's one way of managing secrets that is certainly wrong.

## The problem with storing secrets in source control

The mistake that many programmers (even experienced ones) make is to store secrets together with their code, checking them into source control (like Git). This is certainly the easiest, most convenient way to deal with the problem, but it's a rather bad idea.

In short, don't store your secrets in Git!

This applies to both secrets that are hardcoded into your application (such as putting the database password directly in the source code, which should be avoided at any cost), as well as keeping configuration files with secrets alongside your source code (such as `.env` or `config.json` files).

The most immediate reason why is connected to security. Source code repositories are meant to be shared, with your teammates, your company, or possibly with the entire world (as is the case for open source software).

In larger organizations there are usually distinct development and operations teams, and developers don't normally have access to production systems. Even in smaller teams where there's less separation between dev and ops, it's common to have different roles and individual responsibilities, so that not everyone needs access to all secrets.

You may think that if you are the sole developer working on a project today this may not apply to you, but that doesn't mean that in the future others will not be joining you on that codebase, perhaps even temporarily (for example, a contractor–or a friend–that is helping you solve one specific issue). Also, you will never know what could happen to your code, and it's always possible it will end up as open source one day in the future.

Keeping secrets outside of Git is especially important for future-proofing. Git is designed to keep a persistent history of all your code changes, so once a secret is checked into source control, removing it requires rewriting history, and that can be really hard if not impossible. Because Git is distributed, other developers may preserve your secret in their own local copies of the repo.

Of course, there's also the risk that your source code is leaked: in many cases this is a bad thing on its own, and it only gets worse if your repository contains any password or secret. Most developers working on a project maintain a local copy of the repository on their laptop, and that amplifies the risk that the code may leak due to hacks, malware, or just accidental disclosure (for example, if someone isn't aware that the codebase contains secrets, they may transfer it in non-secure ways, etc).

If security risks aren't enough of a reason on their own, there are also practical reasons. Most apps are deployed to multiple development or test environments before being pushed to production, and each environment connects to different resources or databases. For example, while developing on your laptop, you want to use a local database server, rather than connecting to the production one; same for your staging (or pre-production) environments.

Maintaining secrets in source control makes it much harder to have multiple environments and set the correct configuration for each environment.

So, if storing your secrets in your Git repo is a no-no, what are some better options?

## Good: use external config files

The first good option we are looking at is to use **external** configuration files. The key word here is _external_, as these files are not checked into source control.

Instead, these files are deployed to your servers separately, and are then loaded by your application at runtime. Because they are handled separately from your code, you can safely store secrets in these files too–in addition to any other non-secret configuration value your app may need (*just make sure you don't have copies of these files hanging around where they can be stolen!*).

For example, on a Linux server you may create a config file (such as `config.json`, or `config.yaml`, or `config.toml`, etc) in `/etc/myapp/` (or `~/.config` or other paths). At runtime, your app will try to look for config files in these folders and load them.

Aside from config files, you can store other secrets in the same folders, such as TLS certificates.

The important thing to note is that these config files are environment-specific and their lifecycle is independent from the one of your app.

For example, if your app runs on a server (like a virtual machine), these config files are deployed by an admin before your app is deployed, and they are managed separately from your application's code or binary. These files are not deployed together with your app, and can be updated at any time, even without needing to re-deploy your app (but your app may need to be restarted if you make a change to a config file).

If your app runs in a Docker container, these config files are normally not included in the container image, but are stored in a local volume and mounted in the container at runtime.

You can find libraries to deal with configuration files for every programming language or stack.

If you're building an app with Node.js, there are a lot of libraries that you can use to manage your app's external configuration. Some popular examples from NPM are [config](https://www.npmjs.com/package/config), [conf](https://www.npmjs.com/package/conf), or [convict](https://www.npmjs.com/package/convict) (this last one is developed by Mozilla, but is also more complex due to being feature-rich). There's even a library built by yours truly for some old projects, but which I won't link to because at this point it's not actively maintained anymore.

## Good: use environmental variables

Just as good of an option as the previous one (and actually, often used together with the previous one) is leveraging environmental variables.

These are configuration options (including secrets) that are set in the environment your app is running in. For example, in Node.js you can set the env var `DB_PASSWORD` when launching an app with:

```sh
DB_PASSWORD="P@ssw0rd" node index.js
```

Your code can then read that with `process.env.DB_PASSWORD`. In fact, `process.env` contains every single variable set in the environment your app is running in, including the default ones that are set by the operating system.

Other programming languages too have ways to read environmental variables.

Many configuration libraries, including some of those linked in the previous section (for Node.js), support environmental variables too, and it's common to allow env vars to override values set in the config files.

Of course, in your production server you are not going to launch your app manually, so you can't pass the env vars in the shell before starting the app. So, the way you use env vars depends on the way your application is deployed and possibly even on the platform you're running on.

For example, if your app's process is managed by systemd, you can use the `Environment=` option in your unit file (in the `[Service]` section) to define one or more env variables. For example, this sets 2 variables, `DB_PASSWORD` and `FOO`:

```text
[Service]
Environment="DB_PASSWORD=ssw0rd" "FOO=bar"
```

You can also define your variables in a file (often called `.env` or **dotenv**), in which each line contains one variable. For example, you can create the file `/etc/myapp/config` with values:

```text
FOO=bar
HELLO=world
```

Then within your systemd unit you load all the variables with the `EnvironmentFile=` key:

```text
[Service]
EnvironmentFile=/etc/myapp/config
```

Using environment files (or dotenv files) is usually more convenient because it allows seeing the entire app's configuration in one place, and it's separate from the rest of the systemd unit. Of course, it's important to treat the dotenv file like any other external configuration file, and keep that separate from your app's source repo!

If your app runs in a Docker container, you can set env vars with the `--env` flag for the `docker run` command (for example, `--env FOO=bar`). You can also use `--env-file` to load variables from an environment file, just like in the example above. Check out the full reference for the [`docker run` command](https://docs.docker.com/engine/reference/commandline/run/#set-environment-variables--e---env---env-file) to learn more.

Lastly, if your app runs on platform services, you can often leverage their own solution for injecting environmental variables.

For example, Azure Web Apps allows you to [set environmental variables](https://docs.microsoft.com/en-us/azure/app-service/configure-common?WT.mc_id=devcloud-00000-cxa) directly from the platform, that your app can access like any other env var. Other app or serverless platforms have similar capabilities, just make sure to check their documentation!

## Better: use a key vault

A better approach to managing secrets is to leverage a key vault. These are special applications or cloud services, sometimes backed by hardware-security modules (chips), that store all the secrets your applications need. At startup, then, your application can request the secrets it needs directly from the key vault.

For example, you can store all the secrets your app needs (database passwords, API keys, TLS certificates…) inside the key vault. Then you only need to pass one single secret to launch your app, which is the password to access the key vault, and which you can pass as an environmental variable. As soon as it starts, then, your app makes a request to the key vault and retrieves all the secrets.

HashiCorp's [Vault](https://www.vaultproject.io/) is a popular, open source vault application for keys and secrets. There are libraries for all the most popular stacks and programming languages to interact with Vault.

There are also managed services that offer key vaults, such as [Azure Key Vault](https://docs.microsoft.com/en-us/azure/key-vault/general/overview?WT.mc_id=devcloud-00000-cxa), and similar services from AWS and Google Cloud. HashiCorp offers a manged cloud version of Vault too, built on the open source product. You can find a quickstart for using Azure Key Vault with Node.js in the [documentation](https://docs.microsoft.com/en-us/azure/key-vault/secrets/quick-create-node?WT.mc_id=devcloud-00000-cxa).

As mentioned, using a key vault doesn't completely remove the need for managing secrets, as you will still need to pass one password to your application: the one to connect to the key vault itself.

However, using a key vault has plenty of benefits, including:

- All secrets are stored in a single, centralized place, so there are no config or env files to manage, deploy, and protect.
- Access control is easier: you can grant access to the key vault to the team (or individuals) who need to be able to manage the secrets only.
- It simplifies updating secrets for one or more applications. For example, if your database password changes, you only need to update it centrally in the key vault without having to modify the config files of every application, across all production servers.
- Because there's no config or env files to manage, it's easier to run your app on platform services, and it's easier to create dynamic environments to scale your app horizontally (that is: if you need to deploy your app on another server, you don't need to worry about ensuring all config files are in place, and you just need to deploy your app).
- Many key vault solutions also include auditing capabilities, so you can have a log of every person and application that access secrets in the vault, which can be very helpful to investigate security incidents.

As a bonus, many key vaults offer additional features such as the ability to store keys using HSM (hardware security modules), where they cannot be retrieved, as well as APIs to encrypt or decrypt data using keys stored in the vault, so your application never needs to manage the keys directly (and you don't have to implement cryptographic functions yourself). Vaults may be able to keys and certain other secrets secrets automatically for you, for increased security. Lastly, some vaults can store TLS certificates and even renew them for you, completely transparently! _(Raise your hand if you ever forgot to renew a production TLS certificate 🙋‍♂️)_

## Best: forgo secrets entirely (bonus)

By far the best way to protect secrets is… to not have secrets in the first place! 🙃 Granted, this is not something that applies to every app and in every scenario, so treat this as a bonus… But you can consider this the _gold standard_.

This is something that's easier to do when your app runs in the cloud or in a platform like Kubernetes. In this case, your app can access resources and have the underlying infrastructure or platform manage the access control.

For example, on Azure you can leverage [Managed Identities](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview?WT.mc_id=devcloud-00000-cxa), which allow you to attach an "identity" to Virtual Machines, Web Apps, Functions, Azure Kubernetes Service, etc (other cloud providers like AWS and Google have similar solutions). When you deploy your application to one of those services which have an assigned identity, your app gets automatic access to any Azure resource you allow it to, without requiring authentication. The Azure fabric assigns an identity to your app just by virtue of running on a specific server or service, and that identity grants access to services such as Azure Storage, Azure SQL, and Azure Key Vault, among others. This means that you can access your data on supported services (such as Azure Storage or SQL) without having to provide any credentials.

Even better, you can access Azure Key Vault without supplying any credentials, and automatically get access to every secret your app is entitled to. This solves the problem presented in the last section, when you still needed to pass a single key to your app so it can access Key Vault–now it just works.

If you have multiple environments, such as production and staging, you can assign different managed identities to each environment, so your app automatically gets access to the correct secrets, to access the correct database, etc.

Similar solutions can be implemented on platforms like Kubernetes too, regardless of where they it's deployed, for example by [integrating with Vault](https://www.vaultproject.io/docs/platform/k8s).

## Conclusion

I hope this article helps you understand some best practices for managing your apps' secrets without storing them in source control with all the associated risks. With increased sophistication and complexity, we've looked at using config files, env vars and env files, key vaults, and then managed identities to skip managing secrets altogether.

As I mentioned at the beginning, this article was not meant to be comprehensive, and there are other ways you can tackle the problem of managing and distributing secrets for your apps. Feel free to share your own best practices in the comment section below.
