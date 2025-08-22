/// <reference types="@cloudflare/workers-types" />
import { SimpleShop } from "../repository.js";
import type { ShopRepositoryInterface } from "../repository.js";

/**
 * Cloudflare KV integration
 * @module
 */
export class CloudflareShopRepository
	implements ShopRepositoryInterface<SimpleShop>
{
	constructor(private storage: KVNamespace) {
		this.storage = storage;
	}

	async createShop(id: string, url: string, secret: string): Promise<void> {
		await Promise.all([
            this.storage.put(id, this.serializeShop(new SimpleShop(id, url, secret))),
            this.storage.put(`${id}_active`, JSON.stringify(false)),
        ])
	}

	async deleteShop(id: string): Promise<void> {
		await Promise.all([
            this.storage.delete(id),
            this.storage.delete(`${id}_active`),
            this.storage.delete(`${id}_credentials`)
        ])
	}

	async getShopById(id: string): Promise<SimpleShop | null> {
		const kvValues = await Promise.all([
            this.storage.get(id),
            this.storage.get(`${id}_active`),
            this.storage.get(`${id}_credentials`)
        ]);

		if (kvValues[0] === null) {
			return null;
		}

		return this.deserializeShop(kvValues);
	}

	async updateShop(shop: SimpleShop): Promise<void> {
		await Promise.all([
            this.storage.put(shop.getShopId(), this.serializeShop(shop)),
            this.storage.put(`${shop.getShopId()}_active`, JSON.stringify(shop.getShopActive())),
            this.storage.put(`${shop.getShopId()}_credentials`, JSON.stringify({ clientId: shop.getShopClientId(), clientSecret: shop.getShopClientSecret() }))
        ])
	}

	protected serializeShop(shop: SimpleShop): string {
		return JSON.stringify(shop);
	}

	protected deserializeShop(data: (string | null)[]): SimpleShop {
		const obj = JSON.parse(data[0]!);

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

		if (data[1] !== null) {
			shop.setShopActive(JSON.parse(data[1]!));
		}

		if (data[2] !== null) {
			const credentials = JSON.parse(data[2]!);
			shop.setShopCredentials(credentials.clientId || "", credentials.clientSecret || "");
		}

		return shop;
	}
}