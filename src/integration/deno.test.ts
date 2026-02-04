import { describe, expect, test } from "bun:test";
import { SimpleShop } from "../repository.js";
import { DenoKVRepository } from "./deno-kv.js";

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

		await repo.createShop("test", "test", "test");

		let shop = await repo.getShopById("test");
		expect(shop).not.toBeNull();
		shop = shop!;

		expect(shop.getShopId()).toBe("test");
		expect(shop.getShopUrl()).toBe("test");
		expect(shop.getShopSecret()).toBe("test");
		expect(shop.getPendingShopUrl()).toBeNull();
		expect(shop.getPendingShopSecret()).toBeNull();
		expect(shop.getPreviousShopSecret()).toBeNull();
		expect(shop.getSecretsRotatedAt()).toBeNull();

		await repo.deleteShop("test");

		expect(repo.getShopById("test")).resolves.toBeNull();

		await repo.updateShop(new SimpleShop("test", "test", "test"));

		expect(repo.getShopById("test")).resolves.not.toBeNull();
	});

	test("Secret rotation fields", async () => {
		const repo = new DenoKVRepository();

		await repo.createShop("test", "test", "test");

		let shop = await repo.getShopById("test");
		expect(shop).not.toBeNull();
		shop = shop!;


		const date = new Date();

		shop.setPendingShopUrl('https://pending.com');
		shop.setPendingShopSecret('pending-secret');
		shop.setPreviousShopSecret('previous-secret');
		shop.setSecretsRotatedAt(date);

		await repo.updateShop(shop);
		let updatedShop = await repo.getShopById("test");
		expect(updatedShop).not.toBeNull();
		updatedShop = updatedShop!;

		expect(updatedShop.getPendingShopUrl()).toBe('https://pending.com');
		expect(updatedShop.getPendingShopSecret()).toBe('pending-secret');
		expect(updatedShop.getPreviousShopSecret()).toBe('previous-secret');
		expect(updatedShop.getSecretsRotatedAt()?.getTime()).toBe(date.getTime());
	});

	test("Has verified with double signature", async () => {
		const repo = new DenoKVRepository();

		await repo.createShop("test", "test", "test");

		let shop = await repo.getShopById("test");
		expect(shop).not.toBeNull();
		shop = shop!;

		expect(shop.hasVerifiedWithDoubleSignature()).toBeFalse();
		shop.setVerifiedWithDoubleSignature();
		shop.setRegistrationConfirmed();

		await repo.updateShop(shop);
		const updatedShop = await repo.getShopById("test");

		expect(updatedShop).not.toBeNull();

		expect(shop.hasVerifiedWithDoubleSignature()).toBeTrue();
		expect(shop.isRegistrationConfirmed()).toBeTrue();
	});
});
