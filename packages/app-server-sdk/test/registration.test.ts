import { describe, expect, jest, test } from "bun:test";
import { AppServer } from "../src/app.js";
import { InMemoryShopRepository, SimpleShop } from "../src/repository.js";

describe("Registration", async () => {
	const app = new AppServer(
		{ appName: "test", appSecret: "test", authorizeCallbackUrl: "test" },
		new InMemoryShopRepository(),
	);

	test("authorize: invalid request", async () => {
		const resp = await app.registration.authorize(
			new Request("http://localhost"),
		);

		expect(resp.status).toBe(400);
	});

	test("authorize: invalid signature", async () => {
		const resp = await app.registration.authorize(
			new Request(
				"http://localhost?shop-url=test&shop-id=test&timestamp=test",
				{ headers: new Headers({ "shopware-app-signature": "test" }) },
			),
		);

		expect(resp.status).toBe(401);
	});

	test("authorize: valid request", async () => {
		app.signer.verify = jest.fn().mockResolvedValue(true);

		const resp = await app.registration.authorize(
			new Request(
				"http://localhost?shop-url=test&shop-id=test&timestamp=test",
				{ headers: new Headers({ "shopware-app-signature": "test" }) },
			),
		);

		expect(resp.status).toBe(200);
	});

	test("authorizeCallback: invalid request", async () => {
		const resp = await app.registration.authorizeCallback(
			new Request("http://localhost", { body: "{}" }),
		);

		expect(resp.status).toBe(400);
	});

	test("authorizeCallback: shop does not exist", async () => {
		const resp = await app.registration.authorizeCallback(
			new Request("http://localhost", {
				body: '{"shopId": "test", "apiKey": "test", "secretKey": "test"}',
			}),
		);

		expect(resp.status).toBe(400);
	});

	test("activateShop", async () => {
		await app.repository.createShop("1", "http://localhost", "test");

		const shop = await app.repository.getShopById("1");

		shop?.setShopActive(false);

		app.contextResolver.fromAPI = jest.fn().mockResolvedValue({ shop });

		const resp = await app.registration.activate(
			new Request("http://localhost", { body: '{"source": {"shopId": "1"}}' }),
		);

		expect(resp.status).toBe(204);

		expect(shop?.getShopActive()).toBe(true);
	});

	test("deactivateShop", async () => {
		await app.repository.createShop("1", "http://localhost", "test");

		const shop = await app.repository.getShopById("1");

		shop?.setShopActive(true);

		app.contextResolver.fromAPI = jest.fn().mockResolvedValue({ shop });

		const resp = await app.registration.deactivate(
			new Request("http://localhost", { body: '{"source": {"shopId": "1"}}' }),
		);

		expect(resp.status).toBe(204);

		expect(shop?.getShopActive()).toBe(false);
	});

	test("deletedShop", async () => {
		await app.repository.createShop("1", "http://localhost", "test");

		const shop = await app.repository.getShopById("1");

		expect(shop).not.toBeNull();

		app.contextResolver.fromAPI = jest.fn().mockResolvedValue({ shop });

		const resp = await app.registration.delete(
			new Request("http://localhost", { body: '{"source": {"shopId": "1"}}' }),
		);

		expect(resp.status).toBe(204);

		expect(app.repository.getShopById("1")).resolves.toBeNull();
	});
});
