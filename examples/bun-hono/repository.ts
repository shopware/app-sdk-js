import {
  ShopInterface,
  ShopRepositoryInterface,
  SimpleShop,
} from "@shopware-ag/app-server-sdk";

import { Database } from "bun:sqlite";

export class BunSqliteRepository
  implements ShopRepositoryInterface<SimpleShop>
{
  db: Database;
  constructor() {
    this.db = new Database("shop.db");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS shop (
        id TEXT PRIMARY KEY,
        active BOOLEAN DEFAULT 1,
        url TEXT NOT NULL,
        secret TEXT NOT NULL,
        client_id TEXT NULL,
        client_secret TEXT NULL
      );
    `);
  }

  async createShop(id: string, url: string, secret: string): Promise<void> {
    const shop = await this.getShopById(id);

    if (shop) {
      return await this.updateShop(shop);
    }

    this.db.exec(`INSERT INTO shop (id, url, secret) VALUES (?, ?, ?)`, [
      id,
      url,
      secret,
    ]);
  }

  async getShopById(id: string): Promise<SimpleShop | null> {
    const query = this.db.query<
      {
        id: string;
        active: boolean;
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

    shop.setShopActive(result.active);

    return shop;
  }
  async updateShop(shop: SimpleShop): Promise<void> {
    this.db.exec(
      `UPDATE shop SET url = ?, secret = ?, client_id = ?, client_secret = ?, active = ? WHERE id = ?`,
      [
        shop.getShopUrl(),
        shop.getShopSecret(),
        shop.getShopClientId(),
        shop.getShopClientSecret(),
        shop.getShopActive(),
        shop.getShopId(),
      ],
    );
  }
  async deleteShop(id: string): Promise<void> {
    this.db.exec("DELETE FROM shop where id = ?", [id]);
  }
}
