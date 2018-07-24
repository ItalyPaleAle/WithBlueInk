---
layout:     post
title:      "How to use s3cmd and any other Amazon S3-compatible app with Azure Blob Storage"
subtitle:   "A world of apps and tools finally working with Azure Storage, in just 5 minutes!"
date:       2017-10-29 21:44:00
author:     "Alessandro Segala"
header-img: "img/minio.jpg"
comments:   yes
---

In the cloud storage world, it's not a secret that the Amazon S3 APIs are considered the *de facto* standard. Countless third-party and open source apps, libraries and tools are built to take advantage of S3, including very popular tools like [s3cmd](https://github.com/s3tools/s3cmd).

Azure provides excellent object storage too with **Azure Blob Storage**, which offers unmatched durability, virtually infinite capacity and multiple tiers of storage. Prices are equal to — when not lower than — Amazon's offerings too! However, because Azure Blob Storage was developed before the world decided to "standardize" on the S3 APIs, the two use different interfaces, and so most applications and libraries designed to work with Amazon S3 do not support Azure.

## Enter Minio

The solution is incredibly simple, and it's a free, lightweight, open source app called **[Minio](https://minio.io/)**: an object storage server that exposes S3-compatible APIs. Minio's main goal was to simply expose local storage as object storage, but a few weeks back the developers implemented a gateway feature that allows proxying requests to — you guessed it — Azure Blob Storage.

In short, Minio allows us to convert Azure Blob Storage APIs to Amazon S3! Best of all: Minio itself is very lightweight (written in Golang), and it's available as a Docker container.

Running Minio as a Docker container is really simple:

````bash
$ docker run -p 9000:9000 \
    -e "MINIO_ACCESS_KEY=azureaccountname" \
    -e "MINIO_SECRET_KEY=azureaccountkey" \
    minio/minio gateway azure
````

## Minio on Web Apps on Linux

Minio is a self-hosted solution, which means that you will need a server to run it. Thanks to Minio developers publishing Docker containers, however, a very simple and cost-effective solution is to use **Azure Web Apps on Linux** and **custom container support**.

To deploy Minio on an Azure Web App, follow these simple steps. You will need the [Azure CLI 2.0](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) (or "az cli") installed on your machine, and, of course, an Azure subscription (or a [free trial](http://azure.com/free)).

If you haven't done it already, log in to Azure using the CLI with this command, then follow the instructions on the terminal to authenticate using the web browser:

````bash
az login
````

The first thing we need to do is to create a **Resource Group**, which is nothing but a logical grouping unit where all of our Azure resources are deployed:

````bash
az group create --name "Minio" --location "WestUS"
````

Next, we will create the actual **Blob Storage Account** in which our data will be stored; you can skip this if you already have a Storage Account that you want to use. There are multiple tiers of storage (hot vs cool), and multiple levels of redundancy (LRS, GRS, RA-GRS); for an explanation of the different options, I'm better off referring you to the [official documentation](https://docs.microsoft.com/en-us/azure/storage/storage-blob-storage-tiers). In this example, we're using a "Blob Storage Account" (a new kind of Storage Account that offers hot and cool storage, and lower rates for both), in LRS (Locally Redundant Storage: data is replicated 3 times within the same Azure datacenter) and "cool" tier (data is always online, but retrieval are charged a small fee per GB). Note that we're adding two recurring parameters for the Resource Group and location as well. The full list of options for the command below is in the [CLI reference](https://docs.microsoft.com/en-us/cli/azure/storage/account#create). Lastly, remember that the name of the storage account has to be *globally* unique.

````bash
az storage account create \
    --name "aleminiostorage" \
    --kind BlobStorage \
    --sku Standard_LRS \
    --access-tier Cool \
    --resource-group "Minio" \
    --location "WestUS"
````

After the account is created, we need to get the **Account Key**:

````bash
az storage account show-connection-string \
    --name "aleminiostorage" \
    --resource-group "Minio"
````

Output:

````json
{
  "connectionString": "DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;AccountName=aleminiostorage;AccountKey=rOduFZr22jJ+..."
}
````

The Account Key is at the end of the connectionString parameter, and it's a base64-encoded string. Take note of that, as we'll need it in the next steps.

It's now time to deploy Minio to the **Web App on Linux**. First, we need to create an App Service Plan, which represents the managed VM(s) that will serve our app; after that, we're creating a Web App inside it. We're picking a "B1" (Basic 1) tier, which should be enough to run our lightweight Minio app; note also the `--is-linux` flag, to create a Linux-based Web App. As in the case of the storage account, the name of the Web App (`aleminio` in the example below) has to be globally unique too. We're also configuring the Web App to run the `minio/minio` image from Docker Hub.

> Note: Traffic between your Azure Web App and the Azure Storage Account is free of charge, for as long as the two are in the same Azure Region!

````bash
# Create the App Service Plan
az appservice plan create \
    --name "MinioAppPlan" \
    --is-linux \
    --sku B1 \
    --resource-group "Minio" \
    --location "WestUS"

# Create the Web App configured with the minio/minio container
az webapp create \
    --name "aleminio" \
    --deployment-container-image-name "minio/minio" \
    --plan "MinioAppPlan" \
    --resource-group "Minio"
````

The Web App on Linux should now be up and running, at the URL *webappname*.azurewebsites.net - in my example, `https://aleminio.azurewebsites.net`.

On the last step, let's configure Minio on the Web App. First, we need to pass the configuration as environmental variables, similarly to what we did with the `-e` flag in the Docker run command above. We then need to tell the Web App what command to execute on the Docker container to start Minio in gateway mode.

````bash
# Environmental variables
# The value for MINIO_ACCESS_KEY is the name of the Storage Account
# Fill MINIO_SECRET_KEY with the Storage Account Key instead
az webapp config appsettings set \
    --settings "MINIO_ACCESS_KEY=aleminiostorage" "MINIO_SECRET_KEY=rOduFZr22jJ+..." "PORT=9000" \
    --name "aleminio" \
    --resource-group "Minio"

# Startup command
az webapp config set \
    --startup-file "gateway azure" \
    --name "aleminio" \
    --resource-group "Minio"
````

We're done! Give the Web App a few seconds to start, then you'll have your **Minio Amazon S3-compatible gateway working**!

Configure your **client apps/libraries** with the following settings:

- S3 endpoint: `https://webappname.azurewebsites.net`, replacing *webappname* with the name of your Web App (and note the use of https)
- Access Key: the name of your Azure Blob Storage Account; in the example above, *aleminiostorage*
- Secret Key: the Account Key of your Azure Blob Storage Account

## s3cmd

As an example, let's configure s3cmd to use our own Minio server.

Download the [s3cmd](https://github.com/s3tools/s3cmd/releases) binary from GitHub and extract it somewhere.

> Note: make sure you're using s3cmd 2.0.1 or higher, as previous releases have issues with Minio as gateway to Azure Storage. Additionally, please make sure you're using Minio 2017-10-27 or higher.

Create then a file named `~/.s3cfg` to configure s3cmd:

````conf
# Setup endpoint: hostname of the Web App
host_base = aleminio.azurewebsites.net
host_bucket = aleminio.azurewebsites.net
# Leave as default
bucket_location = us-east-1
use_https = True

# Setup access keys
# Access Key = Azure Storage Account name
access_key =  aleminiostorage
# Secret Key = Azure Storage Account Key
secret_key = rOduFZr22jJ+...

# Use S3 v4 signature APIs
signature_v2 = False
````

You should be able to use s3cmd now! Some examples:

````bash
# Create a bucket
$ ./s3cmd mb s3://testbucket
Bucket 's3://testbucket/' created

# List all buckets
$ ./s3cmd ls s3://
2017-06-12 19:58  s3://testbucket

# Uplaod some files
$ ./s3cmd put photos/* s3://testbucket
````

Let me know in the comments how you plan to use Minio with Azure Blob Storage!

<small>*Cover photo by Jacek Malinowski ([Unsplash](https://unsplash.com/@jaxek))*</small>