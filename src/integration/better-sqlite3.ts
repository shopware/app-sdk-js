import { type ShopRepositoryInterface, SimpleShop } from "../repository.js";

import Database from "better-sqlite3";

export class BetterSqlite3Repository
	implements ShopRepositoryInterface<SimpleShop>
{
	db: Database.Database;
	constructor(fileName: string) {
		this.db = new Database(fileName);
		this.db.pragma("journal_mode = WAL");
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
			await this.deleteShop(id);
		}

		this.db
			.prepare("INSERT INTO shop (id, url, secret) VALUES (?, ?, ?)")
			.run(id, url, secret);
	}

	async getShopById(id: string): Promise<SimpleShop | null> {
		const result = this.db
			.prepare("SELECT * FROM shop WHERE id = ?")
			.get(id) as null | {
			id: string;
			active: number;
			url: string;
			secret: string;
			client_id?: string;
			client_secret?: string;
		};

		if (!result) {
			return null;
		}

		const shop = new SimpleShop(result.id, result.url, result.secret);

		if (result.client_id && result.client_secret) {
			shop.setShopCredentials(result.client_id, result.client_secret);
		}

		shop.setShopActive(result.active === 1);

		return shop;
	}
	async updateShop(shop: SimpleShop): Promise<void> {
		this.db
			.prepare(
				"UPDATE shop SET url = ?, secret = ?, client_id = ?, client_secret = ?, active = ? WHERE id = ?",
			)
			.run(
				shop.getShopUrl(),
				shop.getShopSecret(),
				shop.getShopClientId(),
				shop.getShopClientSecret(),
				+shop.getShopActive(),
				shop.getShopId(),
			);
	}
	async deleteShop(id: string): Promise<void> {
		this.db.prepare("DELETE FROM shop where id = ?").run(id);
	}
}
