import { Hono } from "hono";
import { configureAppServer } from "@shopware-ag/app-server/framework/hono";
import { BunSQliteRepository } from "./repository.js";
import { AppServer, ShopInterface, Context } from "@shopware-ag/app-server";
import {
  ActionButtonRequest,
  BrowserAppModuleRequest,
} from "@shopware-ag/app-server/types";
import { createNotificationResponse } from "@shopware-ag/app-server/helper/app-actions";

const app = new Hono();

configureAppServer(app, {
  appName: "MyApp",
  appSecret: "my-secret",
  shopRepository: new BunSQliteRepository(),
});

declare module "hono" {
  interface ContextVariableMap {
    app: AppServer;
    shop: ShopInterface;
    context: Context;
  }
}

app.get("/app/browser", (c) => {
  const ctx = c.get("context") as Context<BrowserAppModuleRequest>;

  console.log(`Got request from ${ctx.payload["shop-id"]}`);

  return c.html(
    '<script>window.parent.postMessage("sw-app-loaded", "*");</script><h1>Hello World</h1>',
  );
});

app.post("/app/action-button", (c) => {
  const ctx = c.get("context") as Context<ActionButtonRequest>;

  return createNotificationResponse("success", "yeeaa");
});

export default app;
