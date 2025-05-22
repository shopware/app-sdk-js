import { describe, expect, test } from "bun:test";

import type { HttpClient } from "../http-client.js";
import {
	ApiContext,
	EntityRepository,
	SyncOperation,
	SyncService,
	uuid,
} from "./admin-api.js";
import { type Autoloadable, Criteria } from "./criteria.js";

describe("Test UUID helper", () => {
	test("should generate a valid UUID", () => {
		expect(uuid()).toMatch(
			/^[0-9a-f]{8}[0-9a-f]{4}4[0-9a-f]{3}[89ab][0-9a-f]{3}[0-9a-f]{12}$/,
		);
	});
});

describe("ApiContext", () => {
	test("headers are correctly encoded", () => {
		expect(new ApiContext().toHeaders()).toEqual({
			"sw-inheritance": "0",
			"sw-skip-trigger-flow": "0",
		});
	});
});

describe("EntityRepository", () => {
	test("search", async () => {
		const client = {
			post(url: string, data: unknown, headers: Record<string, string>) {
				expect(url).toBe("/search/product");
				return Promise.resolve({ body: { total: 1, data: [] } });
			},
		} as unknown as HttpClient;

		const repository = new EntityRepository(client, "product");

		const res = await repository.search(new Criteria());

		expect(res.total).toBe(1);
		expect(res.data).toEqual([]);
		expect(res.first()).toBeNull();
	});

	test("search typed", async () => {
		const client = {
			post(url: string, data: unknown, headers: Record<string, string>) {
				expect(url).toBe("/search/product");
				return Promise.resolve({
					body: {
						total: 1,
						data: [{ nested: { path: { id: "123" } }, tax: { rate: 5 } }],
					},
				});
			},
		} as unknown as HttpClient;

		type Product = {
			id: string;
			name: string;
			tax?: Autoloadable<{ rate: number }>;
			nested?: Autoloadable<{
				path?: Autoloadable<{
					id: string;
				}>;
			}>;
		};

		const repository = new EntityRepository<Product>(client, "product");
		const criteria = new Criteria<Product>()
			.addAssociation("tax")
			.addAssociation("nested.path");

		const res = await repository.search(criteria);

		const first = res.first();
		expect(first).toBeDefined();
		if (!first) {
			throw new Error("First element is null");
		}

		first.tax.rate;
		first.nested.path;
	});

	test("searchIds", async () => {
		const client = {
			post(url: string, data: unknown, headers: Record<string, string>) {
				expect(url).toBe("/search-ids/product");
				return Promise.resolve({ body: { data: [] } });
			},
		} as unknown as HttpClient;

		const repository = new EntityRepository(client, "product");

		const res = await repository.searchIds(new Criteria());

		expect(res).toEqual([]);
	});

	test("aggregate", async () => {
		const client = {
			post(url: string, data: unknown, headers: Record<string, string>) {
				expect(url).toBe("/search/product-foo");
				return Promise.resolve({ body: { total: 1, data: [] } });
			},
		} as unknown as HttpClient;

		const repository = new EntityRepository(client, "product_foo");

		const res = await repository.aggregate(new Criteria());

		expect(res.total).toBe(1);
		expect(res.data).toEqual([]);
	});

	test("upsert", async () => {
		const client = {
			post(
				url: string,
				data: SyncOperation[],
				headers: Record<string, string>,
			) {
				expect(url).toBe("/_action/sync");

				expect(data).toHaveLength(1);
				expect(data[0]?.action).toBe("upsert");
				expect(JSON.stringify(data[0]?.payload)).toBe(
					JSON.stringify([{ name: "test" }]),
				);

				return Promise.resolve({ body: {} });
			},
		} as unknown as HttpClient;

		const repository = new EntityRepository(client, "product");

		await repository.upsert([{ name: "test" }]);
	});

	test("delete", async () => {
		const client = {
			post(
				url: string,
				data: SyncOperation[],
				headers: Record<string, string>,
			) {
				expect(url).toBe("/_action/sync");

				expect(data).toHaveLength(1);
				expect(data[0]?.action).toBe("delete");
				expect(JSON.stringify(data[0]?.payload)).toBe(
					JSON.stringify([{ id: "111" }]),
				);

				return Promise.resolve({ body: {} });
			},
		} as unknown as HttpClient;

		const repository = new EntityRepository(client, "product");

		await repository.delete([{ id: "111" }]);
	});

	test("deleteByFilters", async () => {
		const client = {
			post(
				url: string,
				data: SyncOperation[],
				headers: Record<string, string>,
			) {
				expect(url).toBe("/_action/sync");

				expect(data).toHaveLength(1);
				expect(data[0]?.action).toBe("delete");
				expect(data[0]?.criteria).toEqual([
					{ field: "name", type: "equals", value: "test" },
				]);

				return Promise.resolve({ body: {} });
			},
		} as unknown as HttpClient;

		const repository = new EntityRepository(client, "product");

		await repository.deleteByFilters([Criteria.equals("name", "test")]);
	});
});

describe("SyncService", () => {
	test("sync", async () => {
		const httpClient = {
			post(url: string, data: unknown, headers: Record<string, string>) {
				expect(url).toBe("/_action/sync");
				expect(JSON.stringify(data)).toBe(
					'[{"key":"test","entity":"product","action":"upsert","payload":[],"criteria":null}]',
				);
				return Promise.resolve({ body: {} });
			},
		} as unknown as HttpClient;

		const service = new SyncService(httpClient);

		await service.sync([new SyncOperation("test", "product", "upsert", [])]);
	});
});
