import { Hono } from "hono";
import { logger } from 'hono/logger'
import { configureAppServer } from "@shopware-ag/app-server-sdk/integration/hono";
import { BunSqliteRepository } from "@shopware-ag/app-server-sdk/integration/bun-sqlite";
import {
  AppServer,
  ShopInterface,
  Context,
  SimpleShop,
} from "@shopware-ag/app-server-sdk";
import {
  ActionButtonRequest
} from "@shopware-ag/app-server-sdk/types";
import { createNotificationResponse } from "@shopware-ag/app-server-sdk/helper/app-actions";
import { EntityRepository } from "@shopware-ag/app-server-sdk/helper/admin-api";
import { Criteria } from "@shopware-ag/app-server-sdk/helper/criteria";

const app = new Hono();
app.use(logger());

declare module "hono" {
  interface ContextVariableMap {
    app: AppServer;
    shop: ShopInterface;
    context: Context;
  }
}

configureAppServer(app, {
  appName: "Test",
  appSecret: "Test",
  shopRepository: new BunSqliteRepository('shop.db')
});

type Product = {
  id: string;
  name: string;
};

app.post("/app/action-button", async (c) => {
  const ctx = c.get("context") as Context<SimpleShop, ActionButtonRequest>;

  const repository = new EntityRepository<Product>(ctx.httpClient, "product");

  // get the products clicked by action button
  const entitySearchResult = await repository.search(new Criteria(ctx.payload.data.ids));

  console.log(entitySearchResult.total);
  console.log(entitySearchResult.first()?.name)

  await repository.upsert(entitySearchResult.data.map(product => ({ id: product.id, name: 'yippiee' })));

  return createNotificationResponse("success", "Product name updated yeaaa");
});

export default app;
