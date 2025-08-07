import type { ShopInterface } from "./repository.js";
import { Agent } from 'undici-types';

/**
 * HttpClient is a simple wrapper around the fetch API, pre-configured with the shop's URL and access token
 */
export class HttpClient {
    private readonly agent: Agent;

	constructor(
        private shop: ShopInterface,
        private tokenCache: HttpClientTokenCacheInterface = new InMemoryHttpClientTokenCache(),
        private defaultTimeout: number = 0,
    ) {
        this.agent = new Agent({
            keepAliveTimeout: 30_000,
            keepAliveMaxTimeout: 60_000,
            pipelining: 0,
        });
	}

	/**
	 * Permform a GET request
	 */
	async get<ResponseType>(
		url: string,
		headers: Record<string, string> = {},
		options: { timeout?: number } = {},
	): Promise<HttpClientResponse<ResponseType>> {
		return await this.request("GET", url, null, headers, options);
	}

	/**
	 * Permform a POST request
	 */
	async post<ResponseType>(
		url: string,
		json: object | FormData | Blob = {},
		headers: Record<string, string> = {},
		options: { timeout?: number } = {},
	): Promise<HttpClientResponse<ResponseType>> {
		let data: object | FormData | Blob | string = json;

		if (!(json instanceof Blob) && !(json instanceof FormData)) {
			headers["content-type"] = "application/json";
			data = JSON.stringify(json);
		}

		headers.accept = "application/json";

		return await this.request(
			"POST",
			url,
			data as FormData | Blob | string,
			headers,
			options,
		);
	}

	/**
	 * Permform a PUT request
	 */
	async put<ResponseType>(
		url: string,
		json: object = {},
		headers: Record<string, string> = {},
		options: { timeout?: number } = {},
	): Promise<HttpClientResponse<ResponseType>> {
		headers["content-type"] = "application/json";
		headers.accept = "application/json";

		return await this.request("PUT", url, JSON.stringify(json), headers, options);
	}

	/**
	 * Permform a PATCH request
	 */
	async patch<ResponseType>(
		url: string,
		json: object = {},
		headers: Record<string, string> = {},
		options: { timeout?: number } = {},
	): Promise<HttpClientResponse<ResponseType>> {
		headers["content-type"] = "application/json";
		headers.accept = "application/json";

		return await this.request("PATCH", url, JSON.stringify(json), headers, options);
	}

	/**
	 * Permform a DELETE request
	 */
	async delete<ResponseType>(
		url: string,
		json: object = {},
		headers: Record<string, string> = {},
		options: { timeout?: number } = {},
	): Promise<HttpClientResponse<ResponseType>> {
		headers["content-type"] = "application/json";
		headers.accept = "application/json";

		return await this.request("DELETE", url, JSON.stringify(json), headers, options);
	}

	private getUrl(...parts: string[]): string {
		return parts.map(part => part.replace(/^\/+|\/+$/g, "")).join("/");
	}

	private async request<ResponseType>(
		method: string,
		url: string,
		body: string | FormData | Blob | null = "",
		headers: Record<string, string> = {},
		options: { timeout?: number } = {},
	): Promise<HttpClientResponse<ResponseType>> {
		let signal : AbortSignal | null = null;

		let timeout = options.timeout || this.defaultTimeout;

		if (timeout > 0) {
			signal = AbortSignal.timeout(timeout);
		}

		const f = await globalThis.fetch(this.getUrl(this.shop.getShopUrl(), "/api", url), {
			redirect: "manual",
			body,
			headers: Object.assign(
				{
					Authorization: `Bearer ${await this.getToken()}`,
				},
				headers,
			),
			method,
			signal,
            dispatcher: this.agent,
		});

		if (f.status === 301 || f.status === 302) {
			throw new ApiClientRequestFailed(
				this.shop.getShopId(),
				new HttpClientResponse<ShopwareErrorResponse>(
					f.status,
					{
						errors: [
							{
								code: "301",
								status: "301",
								title: "301",
								detail:
									"Got a redirect response from the URL, the URL should point to the Shop without redirect",
							},
						],
					},
					f.headers,
				),
			);
		}

		// Obtain new token
		if (!f.ok && f.status === 401) {
			this.tokenCache.clearToken(this.shop.getShopId());

			return await this.request(method, url, body, headers);
		}
		if (!f.ok) {
			throw new ApiClientRequestFailed(
				this.shop.getShopId(),
				new HttpClientResponse(f.status, await f.json(), f.headers),
			);
		}

		if (f.status === 204) {
			return new HttpClientResponse<ResponseType>(
				f.status,
				{} as ResponseType,
				f.headers,
			);
		}

		return new HttpClientResponse(f.status, await f.json(), f.headers);
	}

	/**
	 * Obtain a valid bearer token
	 */
	async getToken(): Promise<string> {
		const cachedToken = await this.tokenCache.getToken(this.shop.getShopId());
		if (cachedToken === null) {
			const auth = await globalThis.fetch(
				`${this.shop.getShopUrl()}/api/oauth/token`,
				{
					method: "POST",
					redirect: "manual",
					headers: {
						"content-type": "application/json",
					},
					body: JSON.stringify({
						grant_type: "client_credentials",
						client_id: this.shop.getShopClientId(),
						client_secret: this.shop.getShopClientSecret(),
					}),
				},
			);

			if (auth.status === 301 || auth.status === 302) {
				throw new ApiClientRequestFailed(
					this.shop.getShopId(),
					new HttpClientResponse<ShopwareErrorResponse>(
						auth.status,
						{
							errors: [
								{
									code: "301",
									status: "301",
									title: "301",
									detail:
										"Got a redirect response from the URL, the URL should point to the Shop without redirect",
								},
							],
						},
						auth.headers,
					),
				);
			}

			if (!auth.ok) {
				const contentType = auth.headers.get("content-type") || "text/plain";
				let body = "";

				if (contentType.indexOf("application/json") !== -1) {
					body = await auth.json();
				} else {
					body = await auth.text();
				}

				throw new ApiClientAuthenticationFailed(
					this.shop.getShopId(),
					new HttpClientResponse<string>(auth.status, body, auth.headers),
				);
			}

			const authBody = (await auth.json()) as {
				access_token: string;
				expires_in: number;
			};

			const expireDate = new Date();
			expireDate.setSeconds(expireDate.getSeconds() + authBody.expires_in);

			const token: HttpClientTokenCacheItem = {
				token: authBody.access_token,
				expiresIn: expireDate,
			};

			await this.tokenCache.setToken(this.shop.getShopId(), token);

			return token.token;
		}

		if (cachedToken.expiresIn.getTime() < new Date().getTime()) {
			await this.tokenCache.clearToken(this.shop.getShopId());

			return await this.getToken();
		}

		return cachedToken.token;
	}
}

/**
 * HttpClientResponse is the response object of the HttpClient
 */
export class HttpClientResponse<ResponseType> {
	constructor(
		public statusCode: number,
		public body: ResponseType,
		public headers: Headers,
	) {}
}

type ShopwareErrorResponse = {
	errors: {
		code: string;
		status: string;
		title: string;
		detail: string;
	}[];
};

/**
 * ApiClientAuthenticationFailed is thrown when the authentication to the shop's API fails
 */
export class ApiClientAuthenticationFailed extends Error {
	constructor(
		shopId: string,
		public response: HttpClientResponse<string>,
	) {
		super(
			`The api client authentication to shop with id: ${shopId} with response: ${JSON.stringify(response.body)}`,
		);
	}
}

/**
 * ApiClientRequestFailed is thrown when the request to the shop's API fails
 */
export class ApiClientRequestFailed extends Error {
	constructor(
		shopId: string,
		public response: HttpClientResponse<ShopwareErrorResponse>,
	) {
		const message = response.body.errors.map((e) => e.detail).join(", ");

		super(`Request failed with error: ${message} for shop with id: ${shopId}`);
	}
}

export interface HttpClientTokenCacheItem {
	token: string;
	expiresIn: Date;
}

export class InMemoryHttpClientTokenCache implements HttpClientTokenCacheInterface {
	private cache: Record<string, HttpClientTokenCacheItem> = {};

	async getToken(shopId: string): Promise<HttpClientTokenCacheItem | null> {
		return this.cache[shopId] || null;
	}

	async setToken(
		shopId: string,
		token: HttpClientTokenCacheItem,
	): Promise<void> {
		this.cache[shopId] = token;
	}

	async clearToken(shopId: string): Promise<void> {
		delete this.cache[shopId];
	}
}

export interface HttpClientTokenCacheInterface {
	getToken(shopId: string): Promise<HttpClientTokenCacheItem | null>;
	setToken(shopId: string, token: HttpClientTokenCacheItem): Promise<void>;
	clearToken(shopId: string): Promise<void>;
}