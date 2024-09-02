import { DenoKVRepository } from "@shopware-ag/app-server-sdk/integration/deno-kv";
import { configureAppServer } from "@shopware-ag/app-server-sdk/integration/hono";
import { Hono } from "hono";
import type {
  AppServer,
  Context,
  ShopInterface,
} from "@shopware-ag/app-server-sdk";
import { createNotificationResponse } from "@shopware-ag/app-server-sdk/helper/app-actions";

const app = new Hono();

declare module "hono" {
  interface ContextVariableMap {
    app: AppServer;
    shop: ShopInterface;
    context: Context;
  }
}

app.post('/app/action-button/product', async ctx => {
  console.log(`Got request from Shop ${ctx.get('shop').getShopId()}`)
  return createNotificationResponse('success', 'YEAA');
});

configureAppServer(app, {
  appName: 'SwagTest',
  appSecret: 'SwagTest',
  shopRepository: new DenoKVRepository(),
})

export default app;
