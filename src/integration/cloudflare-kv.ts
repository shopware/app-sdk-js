import { SimpleShop } from "../repository.js";
import type { ShopRepositoryInterface } from "../repository.js";

/**
 * Cloudflare KV integration
 * @module
 */

/**
 * Cloudflare KV implementation of the ShopRepositoryInterface
 */
export class CloudflareShopRepository
	implements ShopRepositoryInterface<SimpleShop>
{
	constructor(private storage: KVNamespace) {
		this.storage = storage;
	}

	async createShop(id: string, url: string, secret: string): Promise<void> {
		await this.storage.put(
			id,
			this.serializeShop(new SimpleShop(id, url, secret)),
		);
	}

	async deleteShop(id: string): Promise<void> {
		await this.storage.delete(id);
	}

	async getShopById(id: string): Promise<SimpleShop | null> {
		const kvObj = await this.storage.get(id);

		if (kvObj === null) {
			return null;
		}

		return this.deserializeShop(kvObj);
	}

	async updateShop(shop: SimpleShop): Promise<void> {
		await this.storage.put(shop.getShopId(), this.serializeShop(shop));
	}

	protected serializeShop(shop: SimpleShop): string {
		return JSON.stringify(shop);
	}

	protected deserializeShop(data: string): SimpleShop {
		const obj = JSON.parse(data);

		const shop = new SimpleShop(
			obj.shopId || "",
			obj.shopUrl || "",
			obj.shopSecret || "",
		);

		shop.setShopCredentials(obj.shopClientId || "", obj.shopClientSecret || "");

		if (obj.shopActive === undefined) {
			obj.shopActive = true;
		}

		shop.setShopActive(obj.shopActive);

		return shop;
	}
}
