import {
  ShopInterface,
  ShopRepositoryInterface,
  SimpleShop,
} from "@shopware-ag/app-server";

import { Database } from "bun:sqlite";

export class BunSQliteRepository implements ShopRepositoryInterface {
  db: Database;
  constructor() {
    this.db = new Database("shop.db");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shop (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        secret TEXT NOT NULL,
        client_id TEXT NULL,
        client_secret TEXT NULL
      );
    `);
  }

  createShopStruct(
    shopId: string,
    shopUrl: string,
    shopSecret: string,
  ): ShopInterface {
    return new SimpleShop(shopId, shopUrl, shopSecret);
  }
  async createShop(shop: ShopInterface): Promise<void> {
    if ((await this.getShopById(shop.getShopId())) !== null) {
      return await this.updateShop(shop);
    }

    this.db.exec(
      `INSERT INTO shop (id, url, secret, client_id, client_secret) VALUES (?, ?, ?, ?, ?)`,
      [
        shop.getShopId(),
        shop.getShopUrl(),
        shop.getShopSecret(),
        shop.getShopClientId(),
        shop.getShopClientSecret(),
      ],
    );
  }
  async getShopById(id: string): Promise<ShopInterface | null> {
    const query = this.db.query<
      {
        id: string;
        url: string;
        secret: string;
        client_id?: string;
        client_secret?: string;
      },
      string
    >(`SELECT * FROM shop WHERE id = ?`);
    const result = query.get(id);

    if (!result) {
      return null;
    }

    const shop = new SimpleShop(result.id, result.url, result.secret);

    if (result.client_id && result.client_secret) {
      shop.setShopCredentials(result.client_id, result.client_secret);
    }

    return shop;
  }
  async updateShop(shop: ShopInterface): Promise<void> {
    this.db.exec(
      `UPDATE shop SET url = ?, secret = ?, client_id = ?, client_secret = ? WHERE id = ?`,
      [
        shop.getShopUrl(),
        shop.getShopSecret(),
        shop.getShopClientId(),
        shop.getShopClientSecret(),
        shop.getShopId(),
      ],
    );
  }
  async deleteShop(id: string): Promise<void> {
    this.db.exec("DELETE FROM shop where id = ?", [id]);
  }
}
