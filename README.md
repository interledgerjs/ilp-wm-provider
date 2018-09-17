# ILP Web Monetization Provider
> Enable Web Monetization using your own Interledger connection

_This tool is intended for experienced users, because it requires a knowledge of the
command line and Interledger tools like Moneyd._

This repo allows you to use Web Monetized without a Coil subscription. It does
this by implementing [the standard for a Web Monetization
provider](https://github.com/interledger/rfcs/blob/master/0028-web-monetization/0028-web-monetization.md#web-monetization-handler-api)
and running all of the infrastructure on your local machine. For ILP
connectivity it uses [moneyd](https://github.com/interledgerjs/moneyd).

The reason this code is being released is to allow people an alternative to Coil
if they want to use their own funds directly instead of paying a subscription, and
to serve as an example of how to implement a Web Monetization handler.

`ilp-wm-provider` differs from a Coil subscription in a few key ways:

1. Rather than paying a flat rate to Coil, you pay directly to the site out of
pocket.

2. This requires the use of Moneyd on your machine, which currently means you
need an XRP wallet. It also requires that an additional `ilp-wm-provider`
process is run.

3. Coil's servers are not touched in the process of payment. Only the public
Interledger infrastructure is used.

4. There is no chrome extension for this Web Monetization provider. Just like
Coil, it can work without an extension. Make sure you don't have the Coil
extension installed, because it will register itself over this handler.

## Setup

### Prerequisites

- Node.js version 8 or higher.
- [Moneyd should be installed and running on the livenet](https://medium.com/interledger-blog/joining-the-live-ilp-network-eab123a73665)

### Install `ilp-wm-provider`

```sh
npm install -g ilp-wm-provider
```

### Generate Certs

WM providers must run over HTTPS. However, `ilp-wm-provider` runs locally.
This means that you'll need a self-signed certificate.

```sh
# Generate root ssl cert.  When it asks you to generate a password remember
# what you put; you'll need it to sign your cert.  You can enter 'Example' on
# any of the other questions where it prompts you
openssl genrsa -des3 -out ./cert/rootCA.key 2048
openssl req -x509 -new -nodes -key ./cert/rootCA.key -sha256 -days 1024 -out ./cert/rootCA.pem

# Generate domain ssl cert
openssl req -new -sha256 -nodes -out ./cert/server.csr -newkey rsa:2048 -keyout ./cert/server.key -config <( cat ./cert/server.csr.cnf )
openssl x509 -req -in ./cert/server.csr -CA ./cert/rootCA.pem -CAkey ./cert/rootCA.key -CAcreateserial -out ./cert/server.crt -days 500 -sha256 -extfile ./cert/v3.ext
```

### Trust Certs

Now you have to add your certificate authority to your browser so you can use
it on websites. These instructions are for google chrome, but there exist similar
options on any other browser that can be found with some googling.

First, open the "Advanced" settings in google chrome on
[`chrome://settings`](chrome://settings).

![chrome settings](./docs/show_advanced.png)

Next, go to "Manage Certificates."

![manage certs](./docs/manage_certs.png)

Once you're there, go to the "Authorities" tab and click "Import."

![import cert](./docs/authorities.png)

Navigate to the `rootCA.pem` file in the `cert` folder in this repository.

![select pem](./docs/select_ca.png)

Select "Trust this certificate for identifying websites," and then confirm by
hitting "OK."

![trust ca](./docs/trust_ca.png)

Now your server will be able to run SSL locally!

### Start the Provider

Now you can run your provider with:

```sh
ilp-wm-provider
```

And navigate to [https://localhost:7771](https://localhost:7771).

## Environment Variables

- `WEB_PORT` - Which port to run the webserver on (default `7771`)

- `WS_PORT` - Which port to run the BTP server on (default `7772`)

- `MONEYD_URI` - The uri to connect to for moneyd access (default `btp+ws://localhost:7768`)

- `THROUGHPUT` - Throughput in units/second. These are the same units as your
  moneyd. The default value is `100`, which would be 100 drops/second on
moneyd-uplink-xrp.

