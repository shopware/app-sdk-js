/// <reference types="@cloudflare/workers-types" />
import { SimpleShop } from "../repository.js";
import type { ShopRepositoryInterface } from "../repository.js";
import type { HttpClientTokenCacheInterface, HttpClientTokenCacheItem } from "../http-client.js";

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
		return JSON.stringify({
			...shop,
			secretsRotatedAt: shop.getSecretsRotatedAt()
				? shop.getSecretsRotatedAt()!.getTime()
				: null,
			// deserializeShop reads these as `verified_with_double_signatures === 1` and
			// `registrationConfirmed === 1`. The spread above only emits the SimpleShop
			// camelCase booleans (`verifiedWithDoubleSignature`, `registrationConfirmed: true`),
			// which the reader never matches — so without these keys neither flag survives a
			// round-trip. Losing the double-signature flag silently disables re-registration
			// enforcement, letting a shop be re-registered without the second signature.
			verified_with_double_signatures: shop.hasVerifiedWithDoubleSignature() ? 1 : 0,
			registrationConfirmed: shop.isRegistrationConfirmed() ? 1 : 0,
		});
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

		if (obj.pendingShopUrl) {
			shop.setPendingShopUrl(obj.pendingShopUrl);
		}

		if (obj.pendingShopSecret) {
			shop.setPendingShopSecret(obj.pendingShopSecret);
		}

		if (obj.previousShopSecret) {
			shop.setPreviousShopSecret(obj.previousShopSecret);
		}

		if (obj.secretsRotatedAt) {
			shop.setSecretsRotatedAt(new Date(Number(obj.secretsRotatedAt)));
		}

		if (data[1] !== null) {
			shop.setShopActive(JSON.parse(data[1]!));
		}

		if (data[2] !== null) {
			const credentials = JSON.parse(data[2]!);
			shop.setShopCredentials(credentials.clientId || "", credentials.clientSecret || "");
		}

		if (obj.verified_with_double_signatures === 1) {
			shop.setVerifiedWithDoubleSignature();
		}

		if (obj.registrationConfirmed === 1) {
			shop.setRegistrationConfirmed();
		}

		return shop;
	}
}

/**
 * Cloudflare KV implementation for HttpClientTokenCacheInterface
 * @module
 */
export class CloudflareHttpClientTokenCache implements HttpClientTokenCacheInterface {
	constructor(private storage: KVNamespace) {
		this.storage = storage;
	}

	/**
	 * Get a token from KV storage for the given shop ID
	 */
	async getToken(shopId: string): Promise<HttpClientTokenCacheItem | null> {
		const tokenData = await this.storage.get(`token_${shopId}`);
		
		if (tokenData === null) {
			return null;
		}

		try {
			const parsedToken = JSON.parse(tokenData);
			// Convert the ISO string back to a Date object
			return {
				token: parsedToken.token,
				expiresIn: new Date(parsedToken.expiresIn)
			};
		} catch (error) {
			return null;
		}
	}

	/**
	 * Store a token in KV storage for the given shop ID
	 */
	async setToken(shopId: string, token: HttpClientTokenCacheItem): Promise<void> {
		// Convert the Date object to an ISO string for storage
		const tokenData = {
			token: token.token,
			expiresIn: token.expiresIn.toISOString()
		};
		
		await this.storage.put(`token_${shopId}`, JSON.stringify(tokenData));
	}

	/**
	 * Remove a token from KV storage for the given shop ID
	 */
	async clearToken(shopId: string): Promise<void> {
		await this.storage.delete(`token_${shopId}`);
	}
}
