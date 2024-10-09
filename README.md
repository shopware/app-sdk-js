# Shopware App Server SDK in TypeScript

This SDK is written in pure Typescript with portability in mind being able to use it on Node (20+), Deno, Cloudflare Worker or other runtimes.

## Features

- Provides registration process for app
- Verify and signing of requests / responses
- preconfigured API Client
- Complete Registration Handshake between Shopware and this

## How to use it?

```bash
npm install @shopware-ag/app-server-sdk --save
```

## Example

<details>
  <summary>Bun Plain</summary>

```typescript
import { AppServer, InMemoryShopRepository } from '@shopware-ag/app-server-sdk'
import { createNotificationResponse } from '@shopware-ag/app-server-sdk/helper/app-actions'

const app = new AppServer({
    appName: 'MyApp',
    appSecret: 'my-secret',
    authorizeCallbackUrl: 'http://localhost:3000/authorize/callback',
}, new InMemoryShopRepository());

const server = Bun.serve({
    port: 3000,
    async fetch(request) {
        const { pathname } = new URL(request.url);
        if (pathname === '/authorize') {
            return app.registration.authorize(request);
        } else if (pathname === '/authorize/callback') {
            return app.registration.authorizeCallback(request);
        } else if (pathname === '/app/product') {
            const context = await app.contextResolver.fromAPI(request);

            // do something with payload, and http client

            const notification = createNotificationResponse('success', 'Product created');

            // sign the response, with the shop secret
            await app.signer.signResponse(notification, context.shop.getShopSecret());

            return resp;
        }

        return new Response('Not found', { status: 404 });
    },
});

console.log(`Listening on localhost:${server.port}`);
```

</details>

Checkout the [examples](./examples) folder for more examples using:

- [Cloudflare Worker with Hono](./examples/cloudflare-hono)
- [Deno with Hono](./examples/deno-hono)
- [Node with Hono](./examples/node-hono)

or use clone them as a starting point for your own project.

```bash
# Node.js
npx tiged shopware/app-sdk-js/examples/node-hono demo-app

# Bun
npx tiged shopware/app-sdk-js/examples/bun-hono demo-app

# Deno
npx tiged shopware/app-sdk-js/examples/deno-hono demo-app

# Cloudflare Worker
npx tiged shopware/app-sdk-js/examples/cloudflare-hono demo-app
```

and then `cd demo-app` and `npm install` to install the dependencies.
