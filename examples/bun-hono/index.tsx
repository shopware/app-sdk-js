import { Hono } from "hono/tiny";
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
import { EntityRepository, SyncOperation, SyncService } from "@shopware-ag/app-server-sdk/helper/admin-api";
import { Criteria } from "@shopware-ag/app-server-sdk/helper/criteria";
import type { FC } from 'hono/jsx'

const app = new Hono();
app.use(logger());

configureAppServer(app, {
  appName: "Test",
  appSecret: "Test",
  shopRepository: new BunSqliteRepository('shop.db'),
  appIframeEnable: true,
  appIframeRedirects: {
    '/app/browser': '/client'
  }
});

declare module "hono" {
  interface ContextVariableMap {
    app: AppServer;
    shop: ShopInterface;
    context: Context;
  }

}

const Layout: FC = (props) => {
  return (
    <html>
      <body>{props.children}</body>
      <script dangerouslySetInnerHTML={{ __html: 'fetch("/client-api/test")'}}></script>
      <script dangerouslySetInnerHTML={{ __html: 'window.parent.postMessage("sw-app-loaded", "*");'}}></script>
    </html>
  )
}

app.get("/client", (c) => {
  return c.html(<Layout>
    <h1>Hello World</h1>
    </Layout>
  );
});


app.get('/client-api/test', (c) => {
  console.log(c.get('shop').getShopId());

  return c.json({ shopId: c.get('shop').getShopId() });
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
