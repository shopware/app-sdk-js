import { SimpleShop } from "../repository.js";
import type { ShopRepositoryInterface } from "../repository.js";

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
			shopActive: boolean | undefined;
			shopUrl: string;
			shopSecret: string;
			shopClientId: string | null;
			shopClientSecret: string | null;
			pendingShopUrl: string | null;
			pendingShopSecret: string | null;
			previousShopSecret: string | null;
			secretsRotatedAt: number | null;
			verifiedWithDoubleSignature: boolean | undefined;
			registrationConfirmed: boolean | undefined;
		};

		if (data.shopActive === undefined) {
			data.shopActive = true;
		}

		const shop = new SimpleShop(data.shopId, data.shopUrl, data.shopSecret);
		shop.setShopActive(data.shopActive);

		if (data.shopClientId && data.shopClientSecret) {
			shop.setShopCredentials(data.shopClientId, data.shopClientSecret);
		}

		if (data.pendingShopUrl) {
			shop.setPendingShopUrl(data.pendingShopUrl);
		}

		if (data.pendingShopSecret) {
			shop.setPendingShopSecret(data.pendingShopSecret);
		}

		if (data.previousShopSecret) {
			shop.setPreviousShopSecret(data.previousShopSecret);
		}

		if (data.secretsRotatedAt) {
			shop.setSecretsRotatedAt(new Date(Number(data.secretsRotatedAt)));
		}

		if (data.verifiedWithDoubleSignature) {
			shop.setVerifiedWithDoubleSignature();
		}

		if (data.registrationConfirmed) {
			shop.setRegistrationConfirmed();
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
