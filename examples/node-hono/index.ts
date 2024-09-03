import { configureAppServer } from "@shopware-ag/app-server-sdk/integration/hono";
import { Hono } from "hono";
import type {
  AppServer,
  Context,
  ShopInterface,
} from "@shopware-ag/app-server-sdk";
import { createNotificationResponse } from "@shopware-ag/app-server-sdk/helper/app-actions";

import { BetterSqlite3Repository } from '@shopware-ag/app-server-sdk/integration/better-sqlite3';

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
    shopRepository: new BetterSqlite3Repository('shop.db'),
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
