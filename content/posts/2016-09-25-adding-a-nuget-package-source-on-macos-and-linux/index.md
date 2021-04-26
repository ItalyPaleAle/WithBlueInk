---
title: "Adding a NuGet package source on macOS and Linux"
description: "How to unblock MyGet and other custom feeds"
date: 2016-09-25 20:42:00
author:
  name: "Alessandro Segala"
  handle: "ItalyPaleAle"
image: "img/boxes.jpg"
comments: yes
coverImage:
  author: "Rob Deutscher"
  linkName: "Flickr"
  linkURL: "https://flic.kr/p/dsFGzL"
  license: "CC BY"
---

I've decided to play a bit with .NET Core on macOS and Linux, given that is now fully open source and cross-platform. For a simple C# project, I had to install a NuGet package (specifically, [ImageProcessorCore](https://github.com/JimBobSquarePants/ImageProcessor)) that was not published on the official gallery, but rather on MyGet, and because of that the normal `dotnet restore` failed. The solution, adding a new NuGet package source, was simple in principle, but hard to figure out in practice when not using Windows!

On macOS and Linux, NuGet stores its configuration and downloaded packages in a folder called `.nuget` inside your home directory.

> **Tip:** As with every file and folder whose name starts with a dot,`.nuget` is normally hidden when you open your home directory on UNIX systems, so you may need to access the file using the terminal or going to the folder in another way.
> 
> On the Finder in macOS, from the top menu choose "Go" and then "Go to Folder...", then type `~/.nuget/` and press "Go".

Inside the `.nuget` directory there are two folders:

- `NuGet` contains the configuration file `NuGet.Config`
- `packages` is the location where all downloaded packages are cached

Open the file `NuGet/NuGet.Config` with any text editor to see the configuration for NuGet, including package sources. You can install another source simply by adding another XML element within `<packageSources>`.

For example, here is my `NuGet.Config` with the public MyGet feed enabled:

````xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" protocolVersion="3" />
    <add key="myget.org" value="https://www.myget.org/F/imageprocessor/api/v3/index.json" protocolVersion="3" />
  </packageSources>
</configuration>
````

### 21 October 2016 - Update

As Toby Henderson pointed out in the comments section below, you can also add a `NuGet.Config` file locally in the **root folder of your project**; the syntax is the same as in the example above. Using a local file lets you check it into source control (e.g. git), so other contributors to the project do not have to modify their environment, and as such is a much better approach for adding project-specific package sources.
