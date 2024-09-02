import { Hono } from "hono";
import { logger } from 'hono/logger'
import { configureAppServer } from "@shopware-ag/app-server-sdk-hono";
import { BunSqliteRepository } from "@shopware-ag/app-server-sdk/integration/bun-sqlite";
import {
  AppServer,
  ShopInterface,
  Context,
  SimpleShop,
} from "@shopware-ag/app-server-sdk";
import {
  ActionButtonRequest,
  BrowserAppModuleRequest,
} from "@shopware-ag/app-server-sdk/types";
import { createNotificationResponse } from "@shopware-ag/app-server-sdk/helper/app-actions";

const app = new Hono();
app.use(logger());

configureAppServer(app, {
  appName: "MyApp",
  appSecret: "my-secret",
  shopRepository: new BunSqliteRepository('shop.db'),
});

declare module "hono" {
  interface ContextVariableMap {
    app: AppServer;
    shop: ShopInterface;
    context: Context;
  }
}

app.get("/app/browser", (c) => {
  const ctx = c.get("context") as Context<SimpleShop, BrowserAppModuleRequest>;

  console.log(`Got request from ${ctx.payload["shop-id"]}`);

  return c.html(
    '<script>window.parent.postMessage("sw-app-loaded", "*");</script><h1>Hello World</h1>',
  );
});

app.post("/app/action-button", (c) => {
  const ctx = c.get("context") as Context<SimpleShop, ActionButtonRequest>;

  return createNotificationResponse("success", "yeeaa");
});

export default app;
