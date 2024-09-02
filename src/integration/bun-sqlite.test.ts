import { describe, expect, test } from "bun:test";
import { SimpleShop } from "../repository.js";
import { BunSqliteRepository } from "./bun-sqlite.js";

describe("Bun SQLite", async () => {
	test("createShop", async () => {
		const repo = new BunSqliteRepository(":memory:");

		await repo.createShop("test", "test", "test");

		const shop = await repo.getShopById("test");

		expect(shop).not.toBeNull();

		expect(shop?.getShopId()).toBe("test");
		expect(shop?.getShopUrl()).toBe("test");
		expect(shop?.getShopSecret()).toBe("test");

		await repo.deleteShop("test");

		expect(repo.getShopById("test")).resolves.toBeNull();

		await repo.createShop("test", "test", "test");

		expect(repo.getShopById("test")).resolves.not.toBeNull();

		await repo.updateShop(new SimpleShop("test", "foo.com", "test"));

		const updatedShop = await repo.getShopById("test");

		expect(updatedShop?.getShopUrl()).toBe("foo.com");
	});
});
