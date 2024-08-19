import { AppServer, InMemoryShopRepository } from '@shopware-ag/app-server'
import { createNotificationResponse } from '@shopware-ag/app-server/helper/app-actions'

const app = new AppServer({
    appName: 'MyApp',
    appSecret: 'my-secret',
    authorizeCallbackUrl: 'http://localhost:3000/app/callback',
}, new InMemoryShopRepository());

const server = Bun.serve({
    port: 3000,
    async fetch(request) {
        const { pathname } = new URL(request.url);
        if (pathname === '/app/register') {
            return app.registration.authorize(request);
        } else if (pathname === '/app/callback') {
            return app.registration.authorizeCallback(request);
        } else if (pathname === '/app/product') {
            const context = await app.contextResolver.fromSource(request);

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
