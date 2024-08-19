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

		shop.setShopCredentials("test", "test");

		expect(shop.getShopClientId()).toBe("test");
		expect(shop.getShopClientSecret()).toBe("test");
	});

	test("InMemoryShopRepository", async () => {
		const shop = new SimpleShop("test", "test", "test");

		const repository = new InMemoryShopRepository();

		expect(repository.createShopStruct("test", "test", "test")).toBeInstanceOf(
			SimpleShop,
		);

		expect(repository.getShopById("test")).resolves.toBeNull();

		await repository.createShop(shop);

		expect(repository.getShopById("test")).resolves.toBe(shop);

		await repository.deleteShop("test");

		expect(repository.getShopById("test")).resolves.toBeNull();

		await repository.updateShop(shop);

		expect(repository.getShopById("test")).resolves.toBe(shop);
	});
});
