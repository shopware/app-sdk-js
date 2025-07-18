import type { AppServer } from "./app.js";
import { HttpClient, type HttpClientTokenCacheInterface } from "./http-client.js";
import type { ShopInterface } from "./repository.js";

/**
 * ContextResolver is a helper class to create a Context object from a request.
 * The context contains the shop, the payload and an instance of the HttpClient
 */
export class ContextResolver<Shop extends ShopInterface = ShopInterface> {
	constructor(private app: AppServer<Shop>, private httpClientTokenCache: HttpClientTokenCacheInterface) {}

	/**
	 * Create a context from a request body
	 */
	public async fromAPI<Payload = unknown>(
		req: Request,
	): Promise<Context<Shop, Payload>> {
		const webHookContent = await req.text();
		const webHookBody = JSON.parse(webHookContent);

		if (
			webHookBody.source === undefined ||
			webHookBody.source.shopId === undefined
		) {
			throw new Error("Invalid request");
		}

		const shop = await this.app.repository.getShopById(
			webHookBody.source.shopId,
		);

		if (shop === null) {
			throw new Error(`Cannot find shop by id ${webHookBody.source.shopId}`);
		}

		const signature = req.headers.get("shopware-shop-signature");

		if (signature === null) {
			throw new Error("Missing shopware-shop-signature header");
		}

		if (
			!(await this.app.signer.verify(
				signature,
				webHookContent,
				shop.getShopSecret(),
			))
		) {
			throw new Error("Invalid signature");
		}

		return new Context<Shop, Payload>(
			shop as Shop,
			webHookBody,
			new HttpClient(shop, this.httpClientTokenCache),
		);
	}

	/**
	 * Create a context from a request query parameters
	 * This is usually a module request from the shopware admin
	 */
	public async fromBrowser<Payload = unknown>(
		req: Request,
	): Promise<Context<Shop, Payload>> {
		const url = new URL(req.url);

		const shopId = url.searchParams.get("shop-id");

		if (shopId === null) {
			throw new Error("Missing shop-id query parameter");
		}

		const shop = await this.app.repository.getShopById(shopId);

		if (shop === null) {
			throw new Error(`Cannot find shop by id ${shopId}`);
		}

		await this.app.signer.verifyGetRequest(req, shop.getShopSecret());

		const paramsObject: Record<string, string> = {};

		url.searchParams.forEach((value, key) => {
			paramsObject[key] = value;
		});

		return new Context<Shop, Payload>(
			shop as Shop,
			paramsObject as Payload,
			new HttpClient(shop, this.httpClientTokenCache),
		);
	}
}

/**
 * Context is the parsed data from the request
 */
export class Context<
	Shop extends ShopInterface = ShopInterface,
	Payload = unknown,
> {
	constructor(
		public shop: Shop,
		public payload: Payload,
		public httpClient: HttpClient,
	) {}
}
