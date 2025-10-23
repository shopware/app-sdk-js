import { describe, expect, test } from "bun:test";
import { SimpleShop } from "../repository.js";
import { BetterSqlite3Repository } from "./better-sqlite3.js";

describe("Better Sqlite3", async () => {
	test.skip("createShop", async () => {
		const repo = new BetterSqlite3Repository(":memory:");

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
		expect(shop.hasVerifiedWithDoubleSignature()).toBeFalse();
		expect(shop.isRegistrationConfirmed()).toBeFalse();

		await repo.deleteShop("test");

		expect(repo.getShopById("test")).resolves.toBeNull();

		await repo.createShop("test", "test", "test");

		expect(repo.getShopById("test")).resolves.not.toBeNull();

		await repo.updateShop(new SimpleShop("test", "foo.com", "test"));

		const updatedShop = await repo.getShopById("test");

		expect(updatedShop?.getShopUrl()).toBe("foo.com");
	});

	test.skip("Secret rotation fields", async () => {

		const repo = new BetterSqlite3Repository(":memory:");

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
		const updatedShop = await repo.getShopById("test");

		expect(updatedShop).not.toBeNull();

		expect(updatedShop?.getPendingShopUrl()).toBe('https://pending.com');
		expect(updatedShop?.getPendingShopSecret()).toBe('pending-secret');
		expect(updatedShop?.getPreviousShopSecret()).toBe('previous-secret');
		expect(updatedShop?.getSecretsRotatedAt()?.getTime()).toBe(date.getTime());
	});

	test.skip("Has verified with double signature", async () => {

		const repo = new BetterSqlite3Repository(":memory:");

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
