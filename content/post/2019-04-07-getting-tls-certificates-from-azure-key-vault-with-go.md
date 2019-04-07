---
title: "Getting TLS certificates from Azure Key Vault with Go"
description: "Whether you're using Go or another language, some advice and code to save you time"
date: 2019-04-07 16:26:00
author: "Alessandro Segala"
image: "img/key-vault.jpg"
comments: yes
authorTwitter: "@ItalyPaleAle"
---

I recently had to build an app in Go to retrieve TLS certificates stored on [Azure Key Vault](https://azure.microsoft.com/en-us/services/key-vault/), and because of some quirks this took way longer than I expected (*admittedly, my limited experience with Go didn't really help*). Sharing is caring, so I'm posting the code here for everyone else 🙌🏻

Even if you're not working with Go, read below for the explanation of the quriks and how to solve them.

## TL;DR—just show me the code

This code retrieves a TLS certificate from Azure Key Vault, grabbing the latest version, and then stores the certificate and key on disk in PEM format.

{{< gist ItalyPaleAle 3f0570e358c8a6ea392d5650362b6aac "azure-key-vault-certificate.go" >}}

You can use the `AzureKeyVaultCertificate` struct to request certificates stored in Azure Key Vault. An example invocation is in the `main` function.

The example above will grab authentication data from environmental variables (see `auth.NewAuthorizerFromEnvironment()` in the code above). For more information, see the [documentation](https://github.com/Azure/azure-sdk-for-go/#more-authentication-details) for the Azure SDK for Go.

## What you need to know about retrieving certificates from Azure Key Vault

Whether you're using Go or another language, there are a few things I learnt about using Azure Key Vault to retrieve TLS certificates which will be useful to you.

### Authenticating your app to Azure Key Vault's data plane

Azure Key Vault has two separate planes:

- The management plane allows you to interact with the Azure Resource Manager provider to create, update and delete vaults
- The data plane allows you to read and write secrets inside a vault

This is a very important difference. When you authorize the Azure SDK, by default you're getting credentials for the management plane; getting credentials for the data plane requires a different module.

Using Go:

- The default module, `github.com/Azure/go-autorest/autorest/azure/auth` ([GoDoc](https://godoc.org/github.com/Azure/go-autorest/autorest/azure/auth)) is for the management plane only
- For the data plane (what we need in this case), you need to use `github.com/Azure/azure-sdk-for-go/services/keyvault/auth` ([GoDoc](https://godoc.org/github.com/Azure/azure-sdk-for-go/services/keyvault/auth))

### Imported TLS certificates create three items in Azure Key Vault

Each TLS certificate creates:

- One *Certificate* entry, containing the public certificate only
- One *Key* entry, containing the RSA key only, which can be used for cryptographic operations but is not useful in our case
- One *Secret* entry, containing the full certificate in PKCS#12 (PFX) format

### Each certificate can have multiple versions

Versions are non-sequential 128-bit identifiers, encoded as hex.

While you could manually pass the ID of the version you're trying to retrieve, the code above first fetches the list of versions and then picks the most recent one.

### Names and version IDs are the same for all three items

This means that if you have a certificate named `withblueink-com` (you can't use dots in secret names) and the latest version is `1e80111ba8c0794d561f2a3dfa7c4211`, you will be able to retrieve the certificate, key and secret with the same name and version strings. This makes things much easier!

### Certificates are stored as secrets, as PFX files

You can retrieve your full TLS certificate (certificate and key) from Azure Key Vault as a secret (*not a certificate*). The content of the secret is a base64-encoded PKCS#12 (PFX) file, with no password.

The code above takes care of that: first, it decodes the file from base64, and then it extracts the certificate and key from the PKCS#12 archive.

## Appendix A: storing your TLS certificate inside Azure Key Vault

You can create a new Key Vault and store a TLS certificate in it using the [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli). Note that, as of writing, you can only store in Azure Key Vault certificates that use RSA private keys; ECDSA keys aren't supported.

First, assuming you have a certificate named `certificate.pem` and a key named `key.pem`, you need to convert them to a PKCS#12 (PFX) archive. With OpenSSL, it's easy:

````sh
# When asked for a password, hit return (twice) to use an empty password
openssl pkcs12 -export -inkey key.pem -in certificate.pem -out certificate.pfx
````

Create a new Azure Key Vault if you need to:

````sh
# Create a Resource Group
RESOURCE_GROUP="MyKeyVault"
LOCATION="WestUS2"
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION"

# Create a Key Vault
# The name must be globally unique
KEYVAULT_NAME="withblueink"
az keyvault create \
  --name "$KEYVAULT_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION"
````

You can them import the certificate in PFX format, which includes both the certificate and key:

````sh
az keyvault certificate import \
  --vault-name "$KEYVAULT_NAME" \
  --file "certificate.pfx" \
  --name "withblueink-com"
````

After this, your certificate can be retrieved with the code above, using `withblueink` as vault name, and `withblueink-com` as certificate/secret name.

## Appendix B: Authorizing your app

There are multiple ways to authorize your app to retrieve the certificate from Azure Key Vault. The code above gathers credentials from the environment, which means that it automatically selects among different options:

- If your app is running within Azure, you can use [Managed Service Identities](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview).
- In all cases, you can use a Service Principal; in the OAuth2 specs, this is called "Client credentials grant", or more colloquially "Machine-to-Machine flow".

To use a Service Principal:

````sh
# Create a Service Principal for an app called "KeyVaultSP"
az ad sp create-for-rbac --name "KeyVaultSP" --skip-assignment
````

Response will look similar to this. Make sure you note down the *password* (you won't see it again!), the *appId* and the *tenant*:

````json
{
  "appId": "f13db91b-2a02-4fbe-826d-5c9049d23561",
  "displayName": "KeyVaultSP",
  "name": "http://KeyVaultSP",
  "password": "d3961f1e-8f20-4636-b695-82f961e154c0",
  "tenant": "de366b7a-4861-4e17-b67b-8e3cdd4f2408"
}
````

To authorize the Service Principal to read your certificates and secrets (necessary to use the code above):

````sh
# This is the "appId" from the result above
AZURE_CLIENT_ID="f13db91b-2a02-4fbe-826d-5c9049d23561"
az keyvault set-policy \
  --name "$KEYVAULT_NAME" \
  --spn "$AZURE_CLIENT_ID" \
  --secret-permissions get \
  --certificate-permissions get list
````

Lastly, you can use those credentials with your app, by setting the right environmental variables:

````sh
# This is the tenant from the result above
AZURE_TENANT_ID="de366b7a-4861-4e17-b67b-8e3cdd4f2408"
# This is the appId from the result above
AZURE_CLIENT_ID="f13db91b-2a02-4fbe-826d-5c9049d23561"
# This is the password from the result above
AZURE_CLIENT_SECRET="d3961f1e-8f20-4636-b695-82f961e154c0"

# Run the code
go run .
````

<small>*Original cover photo by Tim Evans ([Unsplash](https://unsplash.com/@tjevans))*</small>
