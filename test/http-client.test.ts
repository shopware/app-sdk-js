import { describe, expect, spyOn, test } from "bun:test";
import { HttpClient } from "../src/http-client.js";
import { SimpleShop } from "../src/repository.js";

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

	test("get: request failed", async () => {
		const mockFetch = spyOn(global, "fetch").mockImplementationOnce(() =>
			Promise.resolve(
				new Response('{"access_token": "test", "expires_in": 5000}'),
			),
		);

		const client = new HttpClient(new SimpleShop("blaa", "test", "test"));

		mockFetch.mockImplementation(() =>
			Promise.resolve(new Response('{"data": "test"}', { status: 400 })),
		);

		expect(client.get("/test")).rejects.toThrowError(
			"The api request failed with status code: 400 for shop with id: blaa",
		);

		mockFetch.mockRestore();
	});
});
