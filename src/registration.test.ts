import { beforeEach, describe, expect, jest, test } from "bun:test";
import { AppServer } from "../src/app.js";
import { InMemoryShopRepository, type SimpleShop } from "../src/repository.js";
import { Hooks } from "./hooks.js";
import type { AppUninstallEvent, BeforeRegistrationEvent, ShopAuthorizeEvent } from "./registration.js";

describe("src/registration.ts", async () => {
	let app: AppServer<SimpleShop>;
	let hooks: Hooks;

	beforeEach(() => {
		app = new AppServer(
			{ appName: "test", appSecret: "test", authorizeCallbackUrl: "test", enforceDoubleSignature: false },
			new InMemoryShopRepository(),
		);

		hooks = new Hooks();
		app.hooks = hooks;
	});

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

	test("authorize: missing app signature", async () => {
		const resp = await app.registration.authorize(
			new Request(
				"http://localhost?shop-url=https://my-shop.com&shop-id=test&timestamp=123",
			),
		);

		expect(resp.status).toBe(400);
	});

	test("authorize: confirmed shop requires shop signature when enforced", async () => {
		const enforcedApp = new AppServer(
			{ appName: "test", appSecret: "test", authorizeCallbackUrl: "test", enforceDoubleSignature: true },
			new InMemoryShopRepository(),
		);

		await enforcedApp.repository.createShop("shop-1", "https://my-shop.com", "shop-secret");
		const shop = await enforcedApp.repository.getShopById("shop-1");
		shop?.setRegistrationConfirmed();
		if (shop) {
			await enforcedApp.repository.updateShop(shop);
		}

		const query = "shop-id=shop-1&shop-url=https://my-shop.com&timestamp=1234567890";
		const signature = await enforcedApp.signer.sign(query, enforcedApp.cfg.appSecret);
		const req = new Request(`http://localhost?${query}`, {
			headers: new Headers({ "shopware-app-signature": signature }),
		});
		const resp = await enforcedApp.registration.authorize(req);

		expect(resp.status).toBe(401);
	});

	test("authorize: creates pending secret and url for new shop", async () => {
		const query = "shop-id=123&shop-url=https://my-shop.com/path&timestamp=1234567890";
		const signature = await app.signer.sign(query, app.cfg.appSecret);
		const resp = await app.registration.authorize(
			new Request(`http://localhost?${query}`, {
				headers: new Headers({ "shopware-app-signature": signature }),
			}),
		);

		expect(resp.status).toBe(200);

		const payload = await resp.json();
		const shop = await app.repository.getShopById("123");

		expect(shop?.getShopSecret()).toBe(payload.secret);
		expect(shop?.getPendingShopSecret()).toBe(payload.secret);
		expect(shop?.getPendingShopUrl()).toBe("https://my-shop.com/path");
		expect(shop?.getShopUrl()).toBe("https://my-shop.com/path");
		expect(shop?.isRegistrationConfirmed()).toBeFalse();
	});

	test("authorize: updates pending secret and url for existing shop", async () => {
		await app.repository.createShop("123", "https://old-url.com/path", "old-secret");
		const existingShop = await app.repository.getShopById("123");
		if (existingShop) {
			await app.repository.updateShop(existingShop);
		}

		const query = "shop-id=123&shop-url=https://new-url.com/path&timestamp=1234567890";
		const signature = await app.signer.sign(query, app.cfg.appSecret);
		const resp = await app.registration.authorize(
			new Request(`http://localhost?${query}`, {
				headers: new Headers({ "shopware-app-signature": signature }),
			}),
		);

		expect(resp.status).toBe(200);

		const payload = await resp.json();
		const shop = await app.repository.getShopById("123");

		expect(shop?.getPendingShopSecret()).toBe(payload.secret);
		expect(shop?.getPendingShopUrl()).toBe("https://new-url.com/path");
		expect(shop?.getShopUrl()).toBe("https://old-url.com/path");
	});

	test("authorize: proof uses new shop url", async () => {
		await app.repository.createShop("123", "https://my-shop.com", "secret");

		const query = "shop-id=123&shop-url=https://my-new-shop.com&timestamp=1234567890";
		const signature = await app.signer.sign(query, app.cfg.appSecret);
		const resp = await app.registration.authorize(
			new Request(`http://localhost?${query}`, {
				headers: new Headers({ "shopware-app-signature": signature }),
			}),
		);

		expect(resp.status).toBe(200);

		const payload = await resp.json();
		const expectedProof = await app.signer.sign(
			`123https://my-new-shop.com${app.cfg.appName}`,
			app.cfg.appSecret,
		);

		expect(payload.proof).toBe(expectedProof);
	});

	test("authorize: records double signature verification when enforced", async () => {
		const enforcedApp = new AppServer(
			{ appName: "test", appSecret: "test", authorizeCallbackUrl: "test", enforceDoubleSignature: true },
			new InMemoryShopRepository(),
		);

		const query = "shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890";
		const signature = await enforcedApp.signer.sign(query, enforcedApp.cfg.appSecret);
		const resp = await enforcedApp.registration.authorize(
			new Request(`http://localhost?${query}`, {
				headers: new Headers({ "shopware-app-signature": signature }),
			}),
		);

		expect(resp.status).toBe(200);

		const shop = await enforcedApp.repository.getShopById("123");
		expect(shop?.hasVerifiedWithDoubleSignature()).toBeTrue();
	});

	test("authorize: records double signature verification when header present", async () => {
		const query = "shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890";
		const signature = await app.signer.sign(query, app.cfg.appSecret);
		const resp = await app.registration.authorize(
			new Request(`http://localhost?${query}`, {
				headers: new Headers({
					"shopware-app-signature": signature,
					"shopware-shop-signature": "shopware-shop-signature",
				}),
			}),
		);

		expect(resp.status).toBe(200);

		const shop = await app.repository.getShopById("123");
		expect(shop?.hasVerifiedWithDoubleSignature()).toBeTrue();
	});

	test("authorize: requires shop signature when shop used double verification", async () => {
		await app.repository.createShop("123", "https://my-shop.com", "shop-secret");
		const shop = await app.repository.getShopById("123");
		shop?.setRegistrationConfirmed();
		shop?.setVerifiedWithDoubleSignature();
		if (shop) {
			await app.repository.updateShop(shop);
		}

		const query = "shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890";
		const signature = await app.signer.sign(query, app.cfg.appSecret);
		const resp = await app.registration.authorize(
			new Request(`http://localhost?${query}`, {
				headers: new Headers({ "shopware-app-signature": signature }),
			}),
		);

		expect(resp.status).toBe(401);
	});

	const sanitizeShopUrlTestCases = [
		{
			input: "https://my-shop.com:80",
			expected: "https://my-shop.com:80",
		},
		{
			input: "https://my-shop.com:8080/",
			expected: "https://my-shop.com:8080",
		},
		{
			input: "https://my-shop.com:8080//test/",
			expected: "https://my-shop.com:8080/test",
		},
		{
			input: "https://my-shop.com",
			expected: "https://my-shop.com",
		},
		{
			input: "https://my-shop.com/",
			expected: "https://my-shop.com",
		},
		{
			input: "https://my-shop.com/test/",
			expected: "https://my-shop.com/test",
		},
		{
			input: "https://my-shop.com//test",
			expected: "https://my-shop.com/test",
		},
		{
			input: "https://my-shop.com//test/",
			expected: "https://my-shop.com/test",
		},
		{
			input: "https://my-shop.com///test/",
			expected: "https://my-shop.com/test",
		},
		{
			input: "https://my-shop.com///test/test1//test2",
			expected: "https://my-shop.com/test/test1/test2",
		},
		{
			input: "https://my-shop.com///test/test1//test2/",
			expected: "https://my-shop.com/test/test1/test2",
		},
		{
			input: "https://my-shop.com///test/test1//test2//",
			expected: "https://my-shop.com/test/test1/test2",
		},
	];

	test.each(sanitizeShopUrlTestCases)(
		"authorize: sanitize shop urls ($input => $expected)",
		async ({ input, expected }) => {
			app.signer.verify = jest.fn().mockResolvedValue(true);

			const resp = await app.registration.authorize(
				new Request(
					`http://localhost?shop-url=${input}&shop-id=test&timestamp=test`,
					{ headers: new Headers({ "shopware-app-signature": "test" }) },
				),
			);
			expect(resp.status).toEqual(200);

			const shop = await app.repository.getShopById("test");

			expect(shop?.getShopUrl()).toEqual(expected);
		},
	);

	test("authorize: Rejects if onBeforeRegistration event is canceled", async () => {
		const vetoListener = jest.fn(async (event: BeforeRegistrationEvent) => {
			event.rejectRegistration("I don't like your face");
		});

		app.hooks.on("onBeforeRegistrationEvent", vetoListener);

		const resp = await app.registration.authorize(
			new Request(
				`http://localhost?shop-url=https://my-shop.com&shop-id=test&timestamp=test`,
				{ headers: new Headers({ "shopware-app-signature": "test" }) },
			),
		);

		expect(resp.status).toEqual(400);
		expect(vetoListener).toHaveBeenCalled();
		expect(resp.json()).resolves.toEqual({ error: "I don't like your face" });
	});

	test("authorizeCallback: invalid request", async () => {
		const resp = await app.registration.authorizeCallback(
			new Request("http://localhost", { body: "{}" }),
		);

		expect(resp.status).toBe(400);
		expect(resp.json()).resolves.toEqual({ error: "Invalid Request" });
	});

	test("authorizeCallback: shop does not exist", async () => {
		const body = '{"shopId": "1", "apiKey": "test", "secretKey": "test"}';
		const resp = await app.registration.authorizeCallback(
			new Request("http://localhost", {
				body,
				headers: {
					"shopware-shop-signature":
						"ecd078f3be7571ed7fe503ebd428dd79c653d108920986a0d936de4b1d371ced",
				},
			}),
		);

		expect(resp.status).toBe(401);
		expect(resp.json()).resolves.toEqual({ error: "Invalid shop given" });
	});

	test("authorizeCallback: rejeced", async () => {
		await app.repository.createShop("1", "http://localhost", "test");
		const shop = await app.repository.getShopById("1");
		shop?.setPendingShopSecret("test");
		shop?.setPendingShopUrl("http://localhost");
		if (shop) {
			await app.repository.updateShop(shop);
		}

		app.hooks.on("onAuthorize", async (event: ShopAuthorizeEvent) => {
			event.rejectRegistration("not you!");
		});

		const body = '{"shopId": "1", "apiKey": "test", "secretKey": "test"}';
		const signature = await app.signer.sign(body, "test");
		const resp = await app.registration.authorizeCallback(
			new Request("http://localhost", {
				body,
				headers: {
					"shopware-shop-signature": signature,
				},
			}),
		);

		expect(resp.status).toBe(403);
		expect(resp.json()).resolves.toEqual({ error: "not you!" });
	});

	test("authorizeCallback: success", async () => {
		await app.repository.createShop("1", "http://localhost", "test");
		const shop = await app.repository.getShopById("1");
		shop?.setPendingShopSecret("test");
		shop?.setPendingShopUrl("http://localhost");
		if (shop) {
			await app.repository.updateShop(shop);
		}

		const body = '{"shopId": "1", "apiKey": "test", "secretKey": "test"}';
		const signature = await app.signer.sign(body, "test");
		const resp = await app.registration.authorizeCallback(
			new Request("http://localhost", {
				body,
				headers: {
					"shopware-shop-signature": signature,
				},
			}),
		);

		expect(resp.status).toBe(204);

		const updatedShop = await app.repository.getShopById("1");
		expect(updatedShop?.isRegistrationConfirmed()).toBeTrue();
		expect(updatedShop?.getPendingShopSecret()).toBeNull();
		expect(updatedShop?.getPendingShopUrl()).toBeNull();
		expect(updatedShop?.getPreviousShopSecret()).toBeNull();
		expect(updatedShop?.getSecretsRotatedAt()).toBeNull();
	});

	test("authorizeCallback: fails without pending secret", async () => {
		await app.repository.createShop("1", "http://localhost", "test");

		const body = '{"shopId": "1", "apiKey": "test", "secretKey": "test"}';
		const signature = await app.signer.sign(body, "test");
		const resp = await app.registration.authorizeCallback(
			new Request("http://localhost", {
				body,
				headers: {
					"shopware-shop-signature": signature,
				},
			}),
		);

		expect(resp.status).toBe(401);
	});

	test("authorizeCallback: rotates secrets and url for confirmed shop", async () => {
		const enforcedApp = new AppServer(
			{ appName: "test", appSecret: "test", authorizeCallbackUrl: "test", enforceDoubleSignature: true },
			new InMemoryShopRepository(),
		);

		await enforcedApp.repository.createShop("1", "https://old-url.com", "old-secret");
		const shop = await enforcedApp.repository.getShopById("1");
		shop?.setRegistrationConfirmed();
		shop?.setPendingShopSecret("new-secret");
		shop?.setPendingShopUrl("https://new-url.com/path");
		if (shop) {
			await enforcedApp.repository.updateShop(shop);
		}

		const body = '{"shopId": "1", "apiKey": "test", "secretKey": "test"}';
		const newSignature = await enforcedApp.signer.sign(body, "new-secret");
		const oldSignature = await enforcedApp.signer.sign(body, "old-secret");
		const resp = await enforcedApp.registration.authorizeCallback(
			new Request("http://localhost", {
				body,
				headers: {
					"shopware-shop-signature": newSignature,
					"shopware-shop-signature-previous": oldSignature,
				},
			}),
		);

		expect(resp.status).toBe(204);

		const updatedShop = await enforcedApp.repository.getShopById("1");
		expect(updatedShop?.getShopSecret()).toBe("new-secret");
		expect(updatedShop?.getPreviousShopSecret()).toBe("old-secret");
		expect(updatedShop?.getPendingShopSecret()).toBeNull();
		expect(updatedShop?.getSecretsRotatedAt()).not.toBeNull();
		expect(updatedShop?.getShopUrl()).toBe("https://new-url.com/path");
	});

	test("app activate", async () => {
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

	test("app deactivate", async () => {
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

	test("app uninstall: keep user data", async () => {
		await app.repository.createShop("1", "http://localhost", "test");

		const shop = await app.repository.getShopById("1");

		expect(shop).not.toBeNull();

		app.contextResolver.fromAPI = jest.fn().mockResolvedValue({ shop });

		const resp = await app.registration.delete(
			new Request("http://localhost", { body: '{"source": {"shopId": "1"}}' }),
		);

		expect(resp.status).toBe(204);

		expect(app.repository.getShopById("1")).resolves.toEqual(shop);
	});

	test("app uninstall: remove user data", async () => {
		await app.repository.createShop("1", "http://localhost", "test");

		const shop = await app.repository.getShopById("1");

		expect(shop).not.toBeNull();

		hooks.on("onAppUninstall", async (event: AppUninstallEvent) => {
			event.keepUserData = false;
		});

		app.contextResolver.fromAPI = jest.fn().mockResolvedValue({ shop });

		const resp = await app.registration.delete(
			new Request("http://localhost", { body: '{"source": {"shopId": "1"}}' }),
		);

		expect(resp.status).toBe(204);

		expect(app.repository.getShopById("1")).resolves.toBeNull();
	});

	test("new shop is recorded as having used double signature verification when enforced", async () => {
		app.cfg.enforceDoubleSignature = true;
		app.signer.verify = jest.fn().mockResolvedValue(true);

		const resp = await app.registration.authorize(
			new Request(
				"http://localhost?shop-url=test&shop-id=test&timestamp=test",
				{ headers: new Headers({ "shopware-app-signature": "test" }) },
			),
		);

		expect(resp.status).toBe(200);

		const shop = await app.repository.getShopById("test");

		expect(shop?.hasVerifiedWithDoubleSignature()).toBeTrue();
	});

	test("existing shop is recorded as having used double signature verification when enforced", async () => {
		app.signer.verify = jest.fn().mockResolvedValue(true);

		await app.repository.createShop("test", "http://localhost", "test");
		app.cfg.enforceDoubleSignature = true;

		let shop = await app.repository.getShopById("test");

		expect(shop).not.toBeNull();
		expect(shop?.hasVerifiedWithDoubleSignature()).toBeFalse();

		const resp = await app.registration.authorize(
			new Request(
				"http://localhost?shop-url=test&shop-id=test&timestamp=test",
				{ headers: new Headers({ "shopware-app-signature": "test", "shopware-shop-signature": "test" }) },
			),
		);

		expect(resp.status).toBe(200);

		shop = await app.repository.getShopById("test");

		expect(shop?.hasVerifiedWithDoubleSignature()).toBeTrue();
	});

	test("new shop is not recorded as having used double signature verification when not enforced", async () => {
		app.signer.verify = jest.fn().mockResolvedValue(true);
		app.cfg.enforceDoubleSignature = false;

		const resp = await app.registration.authorize(
			new Request(
				"http://localhost?shop-url=test&shop-id=test&timestamp=test",
				{ headers: new Headers({ "shopware-app-signature": "test" }) },
			),
		);

		expect(resp.status).toBe(200);

		const shop = await app.repository.getShopById("test");

		expect(shop?.hasVerifiedWithDoubleSignature()).toBeFalse();
	});

	test("existing shop is not recorded as having used double signature verification when not enforced", async () => {
		app.signer.verify = jest.fn().mockResolvedValue(true);

		await app.repository.createShop("test", "http://localhost", "test");
		app.cfg.enforceDoubleSignature = false;

		let shop = await app.repository.getShopById("test");

		expect(shop).not.toBeNull();
		expect(shop?.hasVerifiedWithDoubleSignature()).toBeFalse();

		const resp = await app.registration.authorize(
			new Request(
				"http://localhost?shop-url=test&shop-id=test&timestamp=test",
				{ headers: new Headers({ "shopware-app-signature": "test" }) },
			),
		);

		expect(resp.status).toBe(200);

		shop = await app.repository.getShopById("test");

		expect(shop?.hasVerifiedWithDoubleSignature()).toBeFalse();
	});

	test("existing shop is recorded as having used double signature verification when headers present", async () => {
		app.signer.verify = jest.fn().mockResolvedValue(true);

		await app.repository.createShop("test", "http://localhost", "test");
		app.cfg.enforceDoubleSignature = false;

		let shop = await app.repository.getShopById("test");

		expect(shop).not.toBeNull();
		expect(shop?.hasVerifiedWithDoubleSignature()).toBeFalse();

		const resp = await app.registration.authorize(
			new Request(
				"http://localhost?shop-url=test&shop-id=test&timestamp=test",
				{ headers: new Headers({ "shopware-app-signature": "test", "shopware-shop-signature": "test" }) },
			),
		);

		expect(resp.status).toBe(200);

		shop = await app.repository.getShopById("test");

		expect(shop?.hasVerifiedWithDoubleSignature()).toBeTrue();
	});
});
