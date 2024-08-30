//
import { describe, expect, test } from "bun:test";
import { SimpleShop } from "@shopware-ag/app-server-sdk";
import { CloudflareShopRepository } from "../src/mod.js";

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
});

class MockedKVNamespace {
	storage: Map<string, string>;
	constructor() {
		this.storage = new Map();
	}

	get(
		key: string,
		options?: Partial<KVNamespaceGetOptions<undefined>>,
	): Promise<string | null> {
		return Promise.resolve(this.storage.get(key) || null);
	}
	put(
		key: string,
		value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
		options?: KVNamespacePutOptions,
	): Promise<void> {
		this.storage.set(key, value as string);
		return Promise.resolve();
	}
	delete(key: string): Promise<void> {
		this.storage.delete(key);
		return Promise.resolve();
	}
}
