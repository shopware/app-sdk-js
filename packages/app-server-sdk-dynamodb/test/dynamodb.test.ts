import { describe, expect, mock, test } from "bun:test";
import { DynamoDBRepository } from "../src/mod.js";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { DeleteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SimpleShop } from "@shopware-ag/app-server-sdk";

describe("DynamoDB", async () => {
	test("getShopById does not exists", async () => {
		mock.module("@aws-sdk/lib-dynamodb", () => {
			return {
				DynamoDBDocumentClient: {
					from() {
						return {
							async send() {
								return {};
							},
						};
					},
				},
			};
		});

		const repo = new DynamoDBRepository(new DynamoDBClient(), "foo");

		expect(repo.getShopById("test")).resolves.toBeNull();
	});

	test("getShopById exists", async () => {
		mock.module("@aws-sdk/lib-dynamodb", () => {
			return {
				DynamoDBDocumentClient: {
					from() {
						return {
							async send() {
								return {
									Item: {
										id: "a",
										url: "b",
										secret: "c",
									},
								};
							},
						};
					},
				},
			};
		});

		const repo = new DynamoDBRepository(new DynamoDBClient(), "foo");

		expect(repo.getShopById("test")).resolves.not.toBeNull();
	});

	test("createShop", async () => {
		let cmd: PutCommand;

		mock.module("@aws-sdk/lib-dynamodb", () => {
			return {
				DynamoDBDocumentClient: {
					from() {
						return {
							async send(inner: PutCommand) {
								cmd = inner;
								return {};
							},
						};
					},
				},
			};
		});

		const repo = new DynamoDBRepository(new DynamoDBClient(), "foo");

		await repo.createShop("a", "b", "c");

		// @ts-expect-error
		expect(cmd).toBeDefined();
		// @ts-expect-error
		expect(cmd.input.Item).toEqual({
			id: "a",
			active: true,
			url: "b",
			secret: "c",
			clientId: null,
			clientSecret: null,
		});
	});

	test("updateShop", async () => {
		let cmd: PutCommand;

		mock.module("@aws-sdk/lib-dynamodb", () => {
			return {
				DynamoDBDocumentClient: {
					from() {
						return {
							async send(inner: PutCommand) {
								cmd = inner;
								return {};
							},
						};
					},
				},
			};
		});

		const repo = new DynamoDBRepository(new DynamoDBClient(), "foo");

		await repo.updateShop(new SimpleShop("a", "b", "c"));

		// @ts-expect-error
		expect(cmd).toBeDefined();
		// @ts-expect-error
		expect(cmd.input.Item).toEqual({
			id: "a",
			active: true,
			url: "b",
			secret: "c",
			clientId: null,
			clientSecret: null,
		});
	});

	test("deleteShop", async () => {
		let cmd: DeleteCommand;

		mock.module("@aws-sdk/lib-dynamodb", () => {
			return {
				DynamoDBDocumentClient: {
					from() {
						return {
							async send(inner: DeleteCommand) {
								cmd = inner;
								return {};
							},
						};
					},
				},
			};
		});

		const repo = new DynamoDBRepository(new DynamoDBClient(), "foo");

		await repo.deleteShop("a");

		// @ts-expect-error
		expect(cmd).toBeDefined();
		// @ts-expect-error
		expect(cmd.input.Key).toEqual({ id: "a" });
	});
});
