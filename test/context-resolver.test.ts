import { describe, expect, jest, test } from "bun:test";
import { AppServer } from "../src/app.js";
import { ContextResolver } from "../src/context-resolver.js";
import { InMemoryShopRepository, SimpleShop } from "../src/repository.js";

describe("Context Resolver", async () => {
	const app = new AppServer(
		{
			appName: "test",
			appSecret: "test",
			authorizeCallbackUrl: "test",
		},
		new InMemoryShopRepository(),
	);

	await app.repository.createShop(new SimpleShop("blaa", "test", "test"));

	const contextResolver = new ContextResolver(app);

	test("fromBrowser: shop does not exist", async () => {
		expect(
			contextResolver.fromBrowser(
				new Request(
					"https://example.com/?shop-id=test&shopware-shop-signature=aaa",
				),
			),
		).rejects.toThrowError("Cannot find shop by id test");
	});

	test("fromBrowser: missing header", async () => {
		expect(
			contextResolver.fromBrowser(
				new Request("https://example.com/?shop-id=blaa"),
			),
		).rejects.toThrowError("Missing shopware-shop-signature query parameter");
	});

	test("fromBrowser: shop exists", async () => {
		app.signer.verifyGetRequest = jest.fn().mockResolvedValue(true);

		const context = await contextResolver.fromBrowser(
			new Request(
				"https://example.com/?shop-id=blaa&shopware-shop-signature=aaa",
			),
		);

		expect(context.payload).toEqual({
			"shop-id": "blaa",
			"shopware-shop-signature": "aaa",
		});
	});

	test("fromSource: missing signature header", async () => {
		expect(
			contextResolver.fromAPI(
				new Request("https://example.com/", {
					body: JSON.stringify({
						source: {
							shopId: "blaa",
						},
					}),
				}),
			),
		).rejects.toThrowError("Missing shopware-shop-signature header");
	});

	test("fromSource: shop does not exists", async () => {
		expect(
			contextResolver.fromAPI(
				new Request("https://example.com/", {
					headers: {
						"shopware-shop-signature": "aaa",
					},
					body: JSON.stringify({
						source: {
							shopId: "test",
						},
					}),
				}),
			),
		).rejects.toThrowError("Cannot find shop by id test");
	});

	test("fromSource: invalid signature", async () => {
		expect(
			contextResolver.fromAPI(
				new Request("https://example.com/", {
					headers: {
						"shopware-shop-signature": "aaa",
					},
					body: JSON.stringify({
						source: {
							shopId: "blaa",
						},
					}),
				}),
			),
		).rejects.toThrowError("Invalid signature");
	});

	test("fromSource: resolved", async () => {
		app.signer.verify = jest.fn().mockResolvedValue(true);

		const ctx = await contextResolver.fromAPI(
			new Request("https://example.com/", {
				headers: {
					"shopware-shop-signature": "aaa",
				},
				body: JSON.stringify({
					source: {
						shopId: "blaa",
					},
				}),
			}),
		);

		expect(ctx.payload).toEqual({
			source: {
				shopId: "blaa",
			},
		});
	});
});
