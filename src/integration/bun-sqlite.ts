import { type ShopRepositoryInterface, SimpleShop } from "../repository.js";

import { Database } from "bun:sqlite";

export class BunSqliteRepository
	implements ShopRepositoryInterface<SimpleShop>
{
	db: Database;
	constructor(fileName: string) {
		this.db = new Database(fileName);
		this.db.exec("PRAGMA journal_mode = WAL;");
		this.db.exec(`
		CREATE TABLE IF NOT EXISTS shop (
		  id TEXT PRIMARY KEY,
		  active BOOLEAN DEFAULT 1,
		  url TEXT NOT NULL,
		  secret TEXT NOT NULL,
		  client_id TEXT NULL,
		  client_secret TEXT NULL,
		  pending_shop_url TEXT NULL,
		  pending_shop_secret TEXT NULL,
		  previous_shop_secret TEXT NULL,
		  secrets_rotated_at INTEGER NULL,
		  verified_with_double_signatures BOOLEAN DEFAULT 0,
		  registration_confirmed BOOLEAN DEFAULT 0
		);
	  `);
	}

	async createShop(id: string, url: string, secret: string): Promise<void> {
		const shop = await this.getShopById(id);

		if (shop) {
			await this.deleteShop(id);
		}

		this.db.exec("INSERT INTO shop (id, url, secret) VALUES (?, ?, ?)", [
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
				pending_shop_url?: string;
				pending_shop_secret?: string;
				previous_shop_secret?: string;
				secrets_rotated_at?: Date;
				verified_with_double_signatures?: number;
				registration_confirmed?: number;
			},
			string
		>("SELECT * FROM shop WHERE id = ?");
		const result = query.get(id);

		if (!result) {
			return null;
		}

		const shop = new SimpleShop(result.id, result.url, result.secret);

		if (result.client_id && result.client_secret) {
			shop.setShopCredentials(result.client_id, result.client_secret);
		}

		shop.setShopActive(result.active);

		if (result.pending_shop_url) {
			shop.setPendingShopUrl(result.pending_shop_url);
		}

		if (result.pending_shop_secret) {
			shop.setPendingShopSecret(result.pending_shop_secret);
		}

		if (result.previous_shop_secret) {
			shop.setPreviousShopSecret(result.previous_shop_secret);
		}

		if (result.secrets_rotated_at) {
			shop.setSecretsRotatedAt(new Date(Number(result.secrets_rotated_at)));
		}

		if (result.verified_with_double_signatures === 1) {
			shop.setVerifiedWithDoubleSignature();
		}

		if (result.registration_confirmed === 1) {
			shop.setRegistrationConfirmed();
		}

		return shop;
	}
	async updateShop(shop: SimpleShop): Promise<void> {
		this.db.exec(
			"UPDATE shop SET url = ?, secret = ?, client_id = ?, client_secret = ?, active = ?, pending_shop_url = ?, pending_shop_secret = ?, previous_shop_secret = ?, secrets_rotated_at = ?, verified_with_double_signatures = ?, registration_confirmed = ? WHERE id = ?",
			[
				shop.getShopUrl(),
				shop.getShopSecret(),
				shop.getShopClientId(),
				shop.getShopClientSecret(),
				shop.getShopActive(),
				shop.getPendingShopUrl(),
				shop.getPendingShopSecret(),
				shop.getPreviousShopSecret(),
				shop.getSecretsRotatedAt()?.getTime() ?? null,
				shop.hasVerifiedWithDoubleSignature(),
				shop.isRegistrationConfirmed(),
				shop.getShopId(),
			],
		);
	}
	async deleteShop(id: string): Promise<void> {
		this.db.exec("DELETE FROM shop where id = ?", [id]);
	}
}
