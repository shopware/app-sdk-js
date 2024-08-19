import { describe, expect, jest, test } from "bun:test";
import {
	convertRequest,
	convertResponse,
	rawRequestMiddleware,
} from "../../src/framework/express.js";

describe("Express", async () => {
	test("convert request", async () => {
		const resp = convertRequest({
			protocol: "http",
			method: "GET",
			get(key: string) {
				return "localhost";
			},
			setEncoding(encoding: string) {},
			on(event: string, callback: Function) {},
			originalUrl: "/test",
			headers: {
				"content-type": "application/json",
			},
			rawBody: "test",
		});

		expect(resp.method).toBe("GET");
		expect(resp.headers.get("content-type")).toBe("application/json");
		expect(resp.url).toBe("http://localhost/test");
	});

	test("convert response", async () => {
		const expressResponse = {
			status: jest.fn(),
			header: jest.fn(),
			send: jest.fn(),
		};

		const response = new Response("test", {
			headers: {
				"content-type": "application/json",
			},
		});

		await convertResponse(response, expressResponse);

		expect(expressResponse.status).toHaveBeenCalledWith(200);
		expect(expressResponse.header).toHaveBeenCalledWith(
			"content-type",
			"application/json",
		);
		expect(expressResponse.send).toHaveBeenCalledWith("test");
	});

	test("middleware json", async () => {
		let dataCallback: Function = () => {};
		let endCallback: Function = () => {};

		const expressRequest = {
			protocol: "http",
			method: "GET",
			get(key: string) {
				return "localhost";
			},
			setEncoding(encoding: string) {},
			on(event: string, callback: Function) {
				if (event === "data") {
					dataCallback = callback;
				} else {
					endCallback = callback;
				}
			},
			originalUrl: "/test",
			headers: {
				"content-type": "application/json",
			},
			rawBody: "",
		};

		const expressResponse = {
			status: jest.fn(),
			header: jest.fn(),
			send: jest.fn(),
		};

		rawRequestMiddleware(expressRequest, expressResponse, () => {});

		dataCallback("test");
		endCallback();

		expect(expressRequest.rawBody).toBe("test");
	});

	test("middleware text", async () => {
		let called = 0;

		const expressRequest = {
			protocol: "http",
			method: "GET",
			get(key: string) {
				return "localhost";
			},
			setEncoding(encoding: string) {},
			on(event: string, callback: () => void) {
				called++;
			},
			originalUrl: "/test",
			headers: {
				"content-type": "text/plain",
			},
			rawBody: "",
		};

		const expressResponse = {
			status: jest.fn(),
			header: jest.fn(),
			send: jest.fn(),
		};

		rawRequestMiddleware(expressRequest, expressResponse, () => {});
		expect(expressRequest.rawBody).toBe("");
		expect(called).toBe(0);
	});
});
