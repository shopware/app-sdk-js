import { InMemoryShopRepository } from "@shopware-ag/app-server.js";
import { configureAppServer } from "@shopware-ag/app-server/framework/hono.js";
import { Hono } from "hono.js";
import type {
  AppServer,
  Context,
  ShopInterface,
} from "@shopware-ag/app-server.js";
import { createNotificationResponse } from "@shopware-ag/app-server/helper/app-actions.js";

import { serve } from '@hono/node-server';

declare module "hono" {
  interface ContextVariableMap {
    app: AppServer;
    shop: ShopInterface;
    context: Context;
  }
}

const app = new Hono()

configureAppServer(app, {
    appName: "Test",
    appSecret: "Test",
    shopRepository: new InMemoryShopRepository(),
});

app.post('/app/product', async (ctx) => {
    const shop = ctx.get('shop');
    console.log(shop.getShopUrl());

    const client = ctx.get('context');
    console.log(await client.httpClient.get('/_info/version'));

    return createNotificationResponse('success', 'Product created')
});

serve(app, (info) => {
  console.log(`Listening on http://localhost:${info.port}`)
})
