import { beforeAll, describe, expect, jest, test } from "bun:test";
import { Hooks } from "./hooks.js";
import { ShopAuthorizeEvent } from "./registration.js";
import { SimpleShop } from "./repository.js";

describe("Hooks", () => {
	let hooks: Hooks;

	beforeAll(() => {
		hooks = new Hooks();
	});

	test("should register an event listener", () => {
		const mockCallback = jest.fn();
		hooks.on("onAuthorize", mockCallback);

		expect(hooks.hasListeners("onAuthorize")).toBe(true);
	});

	test("should call the registered event listener on publish", async () => {
		const mockCallback = jest.fn().mockResolvedValue(new Response());
		hooks.on("onAuthorize", mockCallback);

		const mockEvent = new ShopAuthorizeEvent(
			new Request("https://example.com"),
			new SimpleShop("shop1", "http://localhost", "test"),
		);
		await hooks.publish("onAuthorize", mockEvent);

		expect(mockCallback).toHaveBeenCalledWith(mockEvent);
	});

	test("should handle multiple listeners for the same event", async () => {
		const mockCallback1 = jest.fn().mockResolvedValue(new Response());
		const mockCallback2 = jest.fn().mockResolvedValue(new Response());
		hooks.on("onAuthorize", mockCallback1);
		hooks.on("onAuthorize", mockCallback2);

		const mockEvent = new ShopAuthorizeEvent(
			new Request("https://example.com"),
			new SimpleShop("shop1", "http://localhost", "test"),
		);
		await hooks.publish("onAuthorize", mockEvent);

		expect(mockCallback1).toHaveBeenCalledWith(mockEvent);
		expect(mockCallback2).toHaveBeenCalledWith(mockEvent);
	});

	test("should not fail if no listeners are registered for an event", async () => {
		const mockEvent = new ShopAuthorizeEvent(
			new Request("https://example.com"),
			new SimpleShop("shop1", "http://localhost", "test"),
		);
		expect(hooks.publish("onAuthorize", mockEvent)).resolves.toBeUndefined();
	});

	test("should await promises returned by listeners", async () => {
		const mockCallback = jest.fn().mockResolvedValue(new Response());
		hooks.on("onAuthorize", mockCallback);

		const mockEvent = new ShopAuthorizeEvent(
			new Request("https://example.com"),
			new SimpleShop("shop1", "http://localhost", "test"),
		);
		const publishPromise = hooks.publish("onAuthorize", mockEvent);

		expect(hooks.publish("onAuthorize", mockEvent)).resolves.toBeUndefined();
		expect(mockCallback).toHaveBeenCalledWith(mockEvent);
	});
});
