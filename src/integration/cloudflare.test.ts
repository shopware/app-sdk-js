//
import { describe, expect, test } from "bun:test";
import { CloudflareShopRepository, CloudflareHttpClientTokenCache } from "../../src/integration/cloudflare-kv.js";
import { SimpleShop } from "../../src/repository.js";
import type { HttpClientTokenCacheItem } from "../../src/http-client.js";

describe("Cloudflare", async () => {
	test("createShop", async () => {
		const repo = new CloudflareShopRepository(
			new MockedKVNamespace() as unknown as KVNamespace,
		);

		await repo.createShop("test", "test", "test");

		const shop = await repo.getShopById("test");

		expect(shop).not.toBeNull();

		expect(shop?.getShopId()).toBe("test");
		expect(shop?.getShopUrl()).toBe("test");
		expect(shop?.getShopSecret()).toBe("test");

		await repo.deleteShop("test");

		expect(repo.getShopById("test")).resolves.toBeNull();

		await repo.updateShop(new SimpleShop("test", "test", "test"));

		expect(repo.getShopById("test")).resolves.not.toBeNull();
	});

	test("createShop sets shop as inactive by default", async () => {
		const repo = new CloudflareShopRepository(
			new MockedKVNamespace() as unknown as KVNamespace,
		);

		await repo.createShop("inactive-test", "https://example.com", "secret123");

		const shop = await repo.getShopById("inactive-test");

		expect(shop).not.toBeNull();
		expect(shop?.getShopActive()).toBe(false);
	});

	test("updateShop with credentials and active state", async () => {
		const kv = new MockedKVNamespace() as unknown as KVNamespace;
		const repo = new CloudflareShopRepository(kv);

		await repo.createShop("update-test", "https://test.com", "secret");

		const shop = new SimpleShop("update-test", "https://updated.com", "updated-secret");
		shop.setShopCredentials("client123", "secret456");
		shop.setShopActive(true);

		await repo.updateShop(shop);

		const retrieved = await repo.getShopById("update-test");

		expect(retrieved).not.toBeNull();
		expect(retrieved?.getShopUrl()).toBe("https://updated.com");
		expect(retrieved?.getShopSecret()).toBe("updated-secret");
		expect(retrieved?.getShopClientId()).toBe("client123");
		expect(retrieved?.getShopClientSecret()).toBe("secret456");
		expect(retrieved?.getShopActive()).toBe(true);
	});

	test("getShopById returns null for non-existent shop", async () => {
		const repo = new CloudflareShopRepository(
			new MockedKVNamespace() as unknown as KVNamespace,
		);

		const shop = await repo.getShopById("non-existent");

		expect(shop).toBeNull();
	});

	test("deleteShop removes all associated keys", async () => {
		const kv = new MockedKVNamespace();
		const repo = new CloudflareShopRepository(kv as unknown as KVNamespace);

		const shop = new SimpleShop("delete-test", "https://test.com", "secret");
		shop.setShopCredentials("client123", "secret456");
		shop.setShopActive(true);

		await repo.updateShop(shop);

		// Verify shop exists with all keys
		expect(await kv.get("delete-test")).not.toBeNull();
		expect(await kv.get("delete-test_active")).not.toBeNull();
		expect(await kv.get("delete-test_credentials")).not.toBeNull();

		await repo.deleteShop("delete-test");

		// Verify all keys are deleted
		expect(await kv.get("delete-test")).toBeNull();
		expect(await kv.get("delete-test_active")).toBeNull();
		expect(await kv.get("delete-test_credentials")).toBeNull();
	});

	test("shop deserialization handles missing credentials", async () => {
		const kv = new MockedKVNamespace();
		const repo = new CloudflareShopRepository(kv as unknown as KVNamespace);

		await repo.createShop("no-creds-test", "https://test.com", "secret");

		const shop = await repo.getShopById("no-creds-test");

		expect(shop).not.toBeNull();
		expect(shop?.getShopClientId()).toBe("");
		expect(shop?.getShopClientSecret()).toBe("");
	});

	test("shop deserialization handles missing active state", async () => {
		const kv = new MockedKVNamespace();
		const repo = new CloudflareShopRepository(kv as unknown as KVNamespace);

		// Manually set shop data without active state
		const shop = new SimpleShop("no-active-test", "https://test.com", "secret");
		await kv.put("no-active-test", JSON.stringify(shop));

		const retrieved = await repo.getShopById("no-active-test");

		expect(retrieved).not.toBeNull();
		expect(retrieved?.getShopActive()).toBe(false); // SimpleShop defaults to false
	});

	test("separate key storage for credentials overrides main shop data", async () => {
		const kv = new MockedKVNamespace();
		const repo = new CloudflareShopRepository(kv as unknown as KVNamespace);

		// Create shop with initial credentials
		const shop = new SimpleShop("override-test", "https://test.com", "secret");
		shop.setShopCredentials("old-client", "old-secret");
		
		await kv.put("override-test", JSON.stringify(shop));
		
		// Set different credentials in separate key
		await kv.put("override-test_credentials", JSON.stringify({
			clientId: "new-client",
			clientSecret: "new-secret"
		}));

		const retrieved = await repo.getShopById("override-test");

		expect(retrieved).not.toBeNull();
		expect(retrieved?.getShopClientId()).toBe("new-client");
		expect(retrieved?.getShopClientSecret()).toBe("new-secret");
	});

	test("separate key storage for active state overrides main shop data", async () => {
		const kv = new MockedKVNamespace();
		const repo = new CloudflareShopRepository(kv as unknown as KVNamespace);

		// Create shop with active = true in main data
		const shop = new SimpleShop("active-override-test", "https://test.com", "secret");
		shop.setShopActive(true);
		
		await kv.put("active-override-test", JSON.stringify(shop));
		
		// Set different active state in separate key
		await kv.put("active-override-test_active", JSON.stringify(false));

		const retrieved = await repo.getShopById("active-override-test");

		expect(retrieved).not.toBeNull();
		expect(retrieved?.getShopActive()).toBe(false);
	});

	describe("CloudflareHttpClientTokenCache", async () => {
		test("setToken stores token correctly", async () => {
			const kv = new MockedKVNamespace();
			const tokenCache = new CloudflareHttpClientTokenCache(kv as unknown as KVNamespace);

			const expiresIn = new Date(Date.now() + 3600 * 1000); // 1 hour from now
			const tokenItem: HttpClientTokenCacheItem = {
				token: "test-token-123",
				expiresIn: expiresIn
			};

			await tokenCache.setToken("test-shop", tokenItem);

			const storedData = await kv.get("token_test-shop");
			expect(storedData).not.toBeNull();

			const parsedData = JSON.parse(storedData!);
			expect(parsedData.token).toBe("test-token-123");
			expect(parsedData.expiresIn).toBe(expiresIn.toISOString());
		});

		test("getToken retrieves token correctly", async () => {
			const kv = new MockedKVNamespace();
			const tokenCache = new CloudflareHttpClientTokenCache(kv as unknown as KVNamespace);

			const expiresIn = new Date(Date.now() + 3600 * 1000);
			const tokenData = {
				token: "test-token-456",
				expiresIn: expiresIn.toISOString()
			};

			await kv.put("token_test-shop", JSON.stringify(tokenData));

			const retrievedToken = await tokenCache.getToken("test-shop");
			expect(retrievedToken).not.toBeNull();
			expect(retrievedToken?.token).toBe("test-token-456");
			expect(retrievedToken?.expiresIn.getTime()).toBe(expiresIn.getTime());
		});

		test("getToken returns null for non-existent token", async () => {
			const kv = new MockedKVNamespace();
			const tokenCache = new CloudflareHttpClientTokenCache(kv as unknown as KVNamespace);

			const retrievedToken = await tokenCache.getToken("non-existent-shop");
			expect(retrievedToken).toBeNull();
		});

		test("getToken handles parsing errors gracefully", async () => {
			const kv = new MockedKVNamespace();
			const tokenCache = new CloudflareHttpClientTokenCache(kv as unknown as KVNamespace);

			// Store invalid JSON data
			await kv.put("token_bad-shop", "invalid-json-data");

			const retrievedToken = await tokenCache.getToken("bad-shop");
			expect(retrievedToken).toBeNull();
		});

		test("clearToken removes token from storage", async () => {
			const kv = new MockedKVNamespace();
			const tokenCache = new CloudflareHttpClientTokenCache(kv as unknown as KVNamespace);

			const expiresIn = new Date(Date.now() + 3600 * 1000);
			const tokenData = {
				token: "test-token-789",
				expiresIn: expiresIn.toISOString()
			};

			await kv.put("token_remove-test", JSON.stringify(tokenData));

			// Verify token exists before clearing
			expect(await kv.get("token_remove-test")).not.toBeNull();

			await tokenCache.clearToken("remove-test");

			// Verify token is removed
			expect(await kv.get("token_remove-test")).toBeNull();
		});

		test("token key format uses correct prefix", async () => {
			const kv = new MockedKVNamespace();
			const tokenCache = new CloudflareHttpClientTokenCache(kv as unknown as KVNamespace);

			const expiresIn = new Date(Date.now() + 3600 * 1000);
			const tokenItem: HttpClientTokenCacheItem = {
				token: "test-token",
				expiresIn: expiresIn
			};

			await tokenCache.setToken("shop123", tokenItem);

			// Check that the key uses the correct format
			const storedData = await kv.get("token_shop123");
			expect(storedData).not.toBeNull();

			const keys = Array.from(kv.storage.keys());
			expect(keys).toContain("token_shop123");
		});
	});
});

class MockedKVNamespace {
	storage: Map<string, string>;
	constructor() {
		this.storage = new Map();
	}

	get(
		key: string,
		_options?: Partial<KVNamespaceGetOptions<undefined>>,
	): Promise<string | null> {
		return Promise.resolve(this.storage.get(key) || null);
	}
	put(
		key: string,
		value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
		_options?: KVNamespacePutOptions,
	): Promise<void> {
		this.storage.set(key, value as string);
		return Promise.resolve();
	}
	delete(key: string): Promise<void> {
		this.storage.delete(key);
		return Promise.resolve();
	}
}
