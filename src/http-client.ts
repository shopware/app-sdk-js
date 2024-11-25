import type { ShopInterface } from "./repository.js";

/**
 * HttpClient is a simple wrapper around the fetch API, pre-configured with the shop's URL and access token
 */
export class HttpClient {
	private storage: { expiresIn: Date | null; token: string | null };

	constructor(private shop: ShopInterface) {
		this.storage = {
			token: null,
			expiresIn: null,
		};
	}

	/**
	 * Permform a GET request
	 */
	async get<ResponseType>(
		url: string,
		headers: Record<string, string> = {},
	): Promise<HttpClientResponse<ResponseType>> {
		return await this.request("GET", url, null, headers);
	}

	/**
	 * Permform a POST request
	 */
	async post<ResponseType>(
		url: string,
		json: object | FormData | Blob = {},
		headers: Record<string, string> = {},
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
		);
	}

	/**
	 * Permform a PUT request
	 */
	async put<ResponseType>(
		url: string,
		json: object = {},
		headers: Record<string, string> = {},
	): Promise<HttpClientResponse<ResponseType>> {
		headers["content-type"] = "application/json";
		headers.accept = "application/json";

		return await this.request("PUT", url, JSON.stringify(json), headers);
	}

	/**
	 * Permform a PATCH request
	 */
	async patch<ResponseType>(
		url: string,
		json: object = {},
		headers: Record<string, string> = {},
	): Promise<HttpClientResponse<ResponseType>> {
		headers["content-type"] = "application/json";
		headers.accept = "application/json";

		return await this.request("PATCH", url, JSON.stringify(json), headers);
	}

	/**
	 * Permform a DELETE request
	 */
	async delete<ResponseType>(
		url: string,
		json: object = {},
		headers: Record<string, string> = {},
	): Promise<HttpClientResponse<ResponseType>> {
		headers["content-type"] = "application/json";
		headers.accept = "application/json";

		return await this.request("DELETE", url, JSON.stringify(json), headers);
	}

	private async request<ResponseType>(
		method: string,
		url: string,
		body: string | FormData | Blob | null = "",
		headers: Record<string, string> = {},
	): Promise<HttpClientResponse<ResponseType>> {
		const f = await globalThis.fetch(`${this.shop.getShopUrl()}/api${url}`, {
			redirect: "manual",
			body,
			headers: Object.assign(
				{
					Authorization: `Bearer ${await this.getToken()}`,
				},
				headers,
			),
			method,
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
			this.storage.expiresIn = null;

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
		if (this.storage.expiresIn === null) {
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

			const expireDate = new Date();
			const authBody = (await auth.json()) as {
				access_token: string;
				expires_in: number;
			};
			this.storage.token = authBody.access_token;
			expireDate.setSeconds(expireDate.getSeconds() + authBody.expires_in);
			this.storage.expiresIn = expireDate;

			return this.storage.token as string;
		}

		if (this.storage.expiresIn.getTime() < new Date().getTime()) {
			// Expired

			this.storage.expiresIn = null;

			return await this.getToken();
		}

		return this.storage.token as string;
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
