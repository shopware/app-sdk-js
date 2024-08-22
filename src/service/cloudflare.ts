import { SimpleShop } from "../repository.js";
import type { ShopInterface, ShopRepositoryInterface } from "../repository.js";

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
		return shop;
	}
}

/**
 * Cloudflare KV
 */
export declare interface KVNamespace<Key extends string = string> {
	get(
		key: Key,
		options?: Partial<KVNamespaceGetOptions<undefined>>,
	): Promise<string | null>;
	put(
		key: Key,
		value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
		options?: KVNamespacePutOptions,
	): Promise<void>;
	delete(key: Key): Promise<void>;
}

/**
 * Cloudflare KV get options
 */
export declare interface KVNamespaceGetOptions<Type> {
	type: Type;
	cacheTtl?: number;
}

/**
 * Cloudflare KV put options
 */
export declare interface KVNamespacePutOptions {
	expiration?: number;
	expirationTtl?: number;
	metadata?: any | null;
}
