import { describe, expect, mock, spyOn, test } from "bun:test";
import { HttpClient, InMemoryHttpClientTokenCache } from "../src/http-client.js";
import { SimpleShop } from "../src/repository.js";

describe("InMemoryHttpClientTokenCache", () => {
  test("it stores, retrieves, and clears tokens", async () => {
    const cache = new InMemoryHttpClientTokenCache();
    const shopId = "test-shop";
    const token = {
      token: "test-token",
      expiresIn: new Date(Date.now() + 3600 * 1000),
    };

    // Test setToken and getToken
    await cache.setToken(shopId, token);
    let cachedToken = await cache.getToken(shopId);
    expect(cachedToken).toEqual(token);

    // Test clearToken
    await cache.clearToken(shopId);
    cachedToken = await cache.getToken(shopId);
    expect(cachedToken).toBeNull();
  });
});

describe("HTTP Client", async () => {
	test("getToken", async () => {
		const mockFetch = spyOn(global, "fetch").mockImplementation(() =>
			Promise.resolve(
				new Response('{"access_token": "test", "expires_in": 3600}'),
			),
		);

		const client = new HttpClient(new SimpleShop("blaa", "test", "test"));
		expect(client.getToken()).resolves.toBe("test");

		// We fetched already once the token, so the second time we should get it from the storage
		await client.getToken();

		expect(mockFetch.mock.calls).toBeArrayOfSize(1);

		mockFetch.mockRestore();
	});

	test("getToken: failed request", async () => {
		const mockFetch = spyOn(global, "fetch").mockImplementation(() =>
			Promise.resolve(
				new Response('{"error": "invalid_grant"}', { status: 400 }),
			),
		);

		const client = new HttpClient(new SimpleShop("blaa", "test", "test"));
		expect(client.getToken()).rejects.toThrowError(
			"The api client authentication to shop with id: blaa",
		);

		mockFetch.mockRestore();
	});

	test("getToken: expired refetch", async () => {
		const mockFetch = spyOn(global, "fetch").mockImplementation(() =>
			Promise.resolve(
				new Response('{"access_token": "test", "expires_in": -500}'),
			),
		);

		const client = new HttpClient(new SimpleShop("blaa", "test", "test"));
		expect(client.getToken()).resolves.toBe("test");

		expect(mockFetch.mock.calls).toBeArrayOfSize(1);

		expect(client.getToken()).resolves.toBe("test");

		expect(mockFetch.mock.calls).toBeArrayOfSize(2);

		mockFetch.mockRestore();
	});

	test("get, post, put, patch, delete", async () => {
		const mockFetch = spyOn(global, "fetch").mockImplementationOnce(() =>
			Promise.resolve(
				new Response('{"access_token": "test", "expires_in": 5000}'),
			),
		);

		const client = new HttpClient(new SimpleShop("blaa", "test", "test"));

		mockFetch.mockImplementation(() =>
			Promise.resolve(new Response('{"data": "test"}')),
		);

		expect(client.get("/test")).resolves.toEqual({
			body: { data: "test" },
			headers: new Headers(),
			statusCode: 200,
		});
		expect(client.post("/test", { data: "test" })).resolves.toEqual({
			body: { data: "test" },
			headers: new Headers(),
			statusCode: 200,
		});
		expect(client.put("/test", { data: "test" })).resolves.toEqual({
			body: { data: "test" },
			headers: new Headers(),
			statusCode: 200,
		});
		expect(client.patch("/test", { data: "test" })).resolves.toEqual({
			body: { data: "test" },
			headers: new Headers(),
			statusCode: 200,
		});
		expect(client.delete("/test")).resolves.toEqual({
			body: { data: "test" },
			headers: new Headers(),
			statusCode: 200,
		});

		expect(mockFetch.mock.calls).toBeArrayOfSize(6);

		mockFetch.mockRestore();
	});

	test("post: send a body data form data", async () => {
		const mockFetch = spyOn(global, "fetch").mockImplementation(() =>
			Promise.resolve(
				new Response('{"access_token": "test", "expires_in": 5000}'),
			),
		);

		const client = new HttpClient(new SimpleShop("blaa", "test", "test"));

		const form = new FormData();
		form.append("test", "test");

		await client.post("/test", form);

		expect(mockFetch.mock.calls).toBeArrayOfSize(2);

		expect(mockFetch.mock.lastCall?.[0]).toBe("test/api/test");
		expect(mockFetch.mock.lastCall?.[1]).toEqual({
			body: form,
			redirect: "manual",
			headers: {
				Authorization: "Bearer test",
				accept: "application/json",
			},
			method: "POST",
			signal: null,
		});

		mockFetch.mockRestore();
	});

	test("post: regular object", async () => {
		const mockFetch = spyOn(global, "fetch").mockImplementation(() =>
			Promise.resolve(
				new Response('{"access_token": "test", "expires_in": 5000}'),
			),
		);

		const client = new HttpClient(new SimpleShop("blaa", "test", "test"));

		const form = { test: "test" };

		await client.post("/test", form);

		expect(mockFetch.mock.calls).toBeArrayOfSize(2);

		expect(mockFetch.mock.lastCall?.[0]).toBe("test/api/test");
		expect(mockFetch.mock.lastCall?.[1]).toEqual({
			body: JSON.stringify(form),
			redirect: "manual",
			headers: {
				Authorization: "Bearer test",
				accept: "application/json",
				"content-type": "application/json",
			},
			method: "POST",
			signal: null,
		});

		mockFetch.mockRestore();
	});

	test("get: request failed", async () => {
		const mockFetch = spyOn(global, "fetch").mockImplementationOnce(() =>
			Promise.resolve(
				new Response('{"access_token": "test", "expires_in": 5000}'),
			),
		);

		const client = new HttpClient(new SimpleShop("blaa", "test", "test"));

		mockFetch.mockImplementation(() =>
			Promise.resolve(
				new Response('{"errors": [{"detail": "test"}]}', { status: 400 }),
			),
		);

		expect(client.get("/test")).rejects.toThrowError(
			"Request failed with error: test for shop with id: bla",
		);

		mockFetch.mockRestore();
	});

	test("test authentification gets redirect", async () => {
		const mockFetch = spyOn(global, "fetch").mockImplementationOnce(() =>
			Promise.resolve(new Response("", { status: 301 })),
		);

		const client = new HttpClient(new SimpleShop("blaa", "test", "test"));

		expect(client.get("/test")).rejects.toThrowError(
			"Request failed with error: Got a redirect response from the URL, the URL should point to the Shop without redirect for shop with id: blaa",
		);

		mockFetch.mockRestore();
	});

	test("gets redirect on a api route", async () => {
		const mockFetch = spyOn(global, "fetch").mockImplementation(
			(input, init) => {
				if (input === "test/api/oauth/token") {
					return Promise.resolve(
						new Response('{"access_token": "test", "expires_in": 5000}'),
					);
				}

				return Promise.resolve(new Response("", { status: 301 }));
			},
		);

		const client = new HttpClient(new SimpleShop("blaa", "test", "test"));

		expect(client.post("/test", {})).rejects.toThrowError(
			"Request failed with error: Got a redirect response from the URL, the URL should point to the Shop without redirect for shop with id: blaa",
		);

		mockFetch.mockRestore();
	});

	test("timeout: successful request with timeout option", async () => {
		const mockFetch = spyOn(global, "fetch").mockImplementation(() =>
			Promise.resolve(
				new Response('{"access_token": "test", "expires_in": 5000}'),
			),
		);

		const client = new HttpClient(new SimpleShop("blaa", "test", "test"));

		mockFetch.mockImplementation(() =>
			Promise.resolve(new Response('{"data": "test"}')),
		);

		const result = await client.get("/test", {}, { timeout: 5000 });

		expect(result).toEqual({
			body: { data: "test" },
			headers: new Headers(),
			statusCode: 200,
		});

		// Verify that the signal was passed to fetch
		expect(mockFetch.mock.lastCall?.[1]?.signal).toBeDefined();

		mockFetch.mockRestore();
	});

	test("timeout: request times out and throws error", async () => {
		const mockFetch = spyOn(global, "fetch").mockImplementationOnce(() =>
			Promise.resolve(
				new Response('{"access_token": "test", "expires_in": 5000}'),
			),
		);

		const client = new HttpClient(new SimpleShop("blaa", "test", "test"));

		// Mock fetch to simulate timeout
		mockFetch.mockImplementation(() => {
			const abortError = new Error("The operation was aborted");
			abortError.name = "AbortError";
			return Promise.reject(abortError);
		});

		expect(client.get("/test", {}, { timeout: 1 })).rejects.toThrow("The operation was aborted");

		mockFetch.mockRestore();
	});
});
