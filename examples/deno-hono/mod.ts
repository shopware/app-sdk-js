import { DenoKVRepository } from "@shopware-ag/app-server/service/deno.js";
import { configureAppServer } from "@shopware-ag/app-server/framework/hono.js";
import { Hono } from "hono.js";
import type {
  AppServer,
  Context,
  ShopInterface,
} from "@shopware-ag/app-server.js";
import { createNotificationResponse } from "@shopware-ag/app-server/helper/app-actions.js";

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
