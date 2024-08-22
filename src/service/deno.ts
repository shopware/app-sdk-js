import { SimpleShop } from "../repository.js";
import type { ShopInterface, ShopRepositoryInterface } from "../repository.js";

/**
 * Deno KV integration
 * @module
 */

/**
 * DenoKVRepository is a ShopRepositoryInterface implementation that uses the Deno KV storage to save the shop data
 */
export class DenoKVRepository implements ShopRepositoryInterface<SimpleShop> {
	constructor(private namespace = "shops") {}

	async createShop(id: string, url: string, secret: string): Promise<void> {
		// @ts-ignore
		const kv = await Deno.openKv();

		await kv.set([this.namespace, id], new SimpleShop(id, url, secret));
	}

	async getShopById(id: string): Promise<SimpleShop | null> {
		// @ts-ignore
		const kv = await Deno.openKv();

		const result = await kv.get([this.namespace, id]);

		if (result.key === null) {
			return null;
		}

		const data = result.value as {
			shopId: string;
			shopUrl: string;
			shopSecret: string;
			shopClientId: string | null;
			shopClientSecret: string | null;
		};

		const shop = new SimpleShop(data.shopId, data.shopUrl, data.shopSecret);

		if (data.shopClientId && data.shopClientSecret) {
			shop.setShopCredentials(data.shopClientId, data.shopClientSecret);
		}

		return shop;
	}

	async updateShop(shop: SimpleShop): Promise<void> {
		// @ts-ignore
		const kv = await Deno.openKv();

		await kv.set([this.namespace, shop.getShopId()], shop);
	}

	async deleteShop(id: string): Promise<void> {
		// @ts-ignore
		const kv = await Deno.openKv();

		await kv.delete([this.namespace, id]);
	}
}
