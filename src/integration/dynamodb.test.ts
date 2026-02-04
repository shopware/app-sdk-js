import { describe, expect, mock, test } from "bun:test";
import { DynamoDBRepository } from "./dynamodb.js";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type {
	DeleteCommand,
	PutCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { SimpleShop } from "../repository.js";


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
			active: false,
			url: "b",
			secret: "c",
			clientId: null,
			clientSecret: null,
			pendingShopUrl: null,
			pendingShopSecret: null,
			previousShopSecret: null,
			secretsRotatedAt: null,
			verifiedWithDoubleSignature: null,
			registrationConfirmed: false,
		});
	});

	test("updateShop", async () => {
		let cmd: UpdateCommand;

		mock.module("@aws-sdk/lib-dynamodb", () => {
			return {
				DynamoDBDocumentClient: {
					from() {
						return {
							async send(inner: UpdateCommand) {
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
		expect(cmd.input.ExpressionAttributeValues).toEqual({
			":active": false,
			":url": "b",
			":secret": "c",
			":clientId": null,
			":clientSecret": null,
			":pendingShopUrl": null,
			":pendingShopSecret": null,
			":previousShopSecret": null,
			":secretsRotatedAt": null,
			":verifiedWithDoubleSignature": false,
			":registrationConfirmed": false,
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

	test("Secret rotation fields", async () => {
		let cmd: UpdateCommand;

		mock.module("@aws-sdk/lib-dynamodb", () => {
			return {
				DynamoDBDocumentClient: {
					from() {
						return {
							async send(inner: UpdateCommand) {
								cmd = inner;
								return {};
							},
						};
					},
				},
			};
		});

		const repo = new DynamoDBRepository(new DynamoDBClient(), "foo");
		const shop = new SimpleShop("test", "test", "test");
		const date = new Date();

		shop?.setPendingShopUrl('https://pending.com');
		shop?.setPendingShopSecret('pending-secret');
		shop?.setPreviousShopSecret('previous-secret');
		shop?.setSecretsRotatedAt(date);

		await repo.updateShop(shop);

		// @ts-expect-error
		expect(cmd).toBeDefined();
		// @ts-expect-error
		expect(cmd.input.ExpressionAttributeValues).toEqual({
			":active": false,
			":url": "test",
			":secret": "test",
			":clientId": null,
			":clientSecret": null,
			":pendingShopUrl": 'https://pending.com',
			":pendingShopSecret": 'pending-secret',
			":previousShopSecret": 'previous-secret',
			":secretsRotatedAt": date.getTime(),
			":verifiedWithDoubleSignature": false,
			":registrationConfirmed": false,
		});
	});

	test("Has verified with double signature", async () => {
		let cmd: UpdateCommand;

		mock.module("@aws-sdk/lib-dynamodb", () => {
			return {
				DynamoDBDocumentClient: {
					from() {
						return {
							async send(inner: UpdateCommand) {
								cmd = inner;
								return {};
							},
						};
					},
				},
			};
		});

		const repo = new DynamoDBRepository(new DynamoDBClient(), "foo");
		const shop = new SimpleShop("test", "test", "test");
		shop.setVerifiedWithDoubleSignature();

		await repo.updateShop(shop);

		// @ts-expect-error
		expect(cmd).toBeDefined();
		// @ts-expect-error
		expect(cmd.input.ExpressionAttributeValues).toEqual({
			":active": false,
			":url": "test",
			":secret": "test",
			":clientId": null,
			":clientSecret": null,
			":pendingShopUrl": null,
			":pendingShopSecret": null,
			":previousShopSecret": null,
			":secretsRotatedAt": null,
			":verifiedWithDoubleSignature": true,
			":registrationConfirmed": false,
		});
	});
});
