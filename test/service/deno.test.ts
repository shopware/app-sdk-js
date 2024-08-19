import { describe, expect, test } from "bun:test";
import { DenoKVRepository } from "../../src/service/deno.js";

describe("Deno", async () => {
	const kv = {
		storage: new Map(),
		set(key: string[], value: string) {
			this.storage.set(key.join(""), value);
		},

		get(key: string[]) {
			if (!this.storage.has(key.join(""))) {
				return {
					key: null,
					value: null,
				};
			}

			return Promise.resolve({
				key: key.join(""),
				value: this.storage.get(key.join("")),
			});
		},

		delete(key: string[]) {
			this.storage.delete(key.join(""));
		},
	};

	// @ts-ignore
	globalThis.Deno = {
		openKv() {
			return Promise.resolve(kv);
		},
	};

	test("test repository", async () => {
		const repo = new DenoKVRepository();

		await repo.createShop(repo.createShopStruct("test", "test", "test"));

		const shop = await repo.getShopById("test");

		expect(shop).not.toBeNull();

		expect(shop?.getShopId()).toBe("test");
		expect(shop?.getShopUrl()).toBe("test");
		expect(shop?.getShopSecret()).toBe("test");

		await repo.deleteShop("test");

		expect(repo.getShopById("test")).resolves.toBeNull();

		await repo.updateShop(repo.createShopStruct("test", "test", "test"));

		expect(repo.getShopById("test")).resolves.not.toBeNull();
	});
});
