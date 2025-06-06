import { describe, expect, test } from "bun:test";
import { InMemoryShopRepository, SimpleShop } from "../src/repository.js";

describe("Repository", async () => {
	test("SimpleShop", async () => {
		const shop = new SimpleShop("test", "test", "test");

		expect(shop.getShopId()).toBe("test");
		expect(shop.getShopUrl()).toBe("test");
		expect(shop.getShopSecret()).toBe("test");
		expect(shop.getShopClientId()).toBeNull();
		expect(shop.getShopClientSecret()).toBeNull();
		expect(shop.getShopActive()).toBe(false);

		shop.setShopActive(true);

		expect(shop.getShopActive()).toBe(true);

		shop.setShopCredentials("test", "test");

		expect(shop.getShopClientId()).toBe("test");
		expect(shop.getShopClientSecret()).toBe("test");
	});

	test("InMemoryShopRepository", async () => {
		const shop = new SimpleShop("test", "http://example.com", "secret");

		const repository = new InMemoryShopRepository();

		expect(repository.getShopById("test")).resolves.toBeNull();

		await repository.createShop("test", "http://example.com", "secret");

		const foundShop = await repository.getShopById("test");
		expect(foundShop).toBeInstanceOf(SimpleShop);
		expect(foundShop).toStrictEqual(shop);

		await repository.deleteShop("test");

		expect(repository.getShopById("test")).resolves.toBeNull();

		await repository.updateShop(shop);

		expect(repository.getShopById("test")).resolves.toBe(shop);
	});
});
