import type { AppServer } from "./app.js";
import { HttpClient } from "./http-client.js";
import type { ShopInterface } from "./repository.js";

/**
 * ContextResolver is a helper class to create a Context object from a request.
 * The context contains the shop, the payload and an instance of the HttpClient
 */
export class ContextResolver {
	constructor(private app: AppServer) {}

	/**
	 * Create a context from a request body
	 */
	public async fromAPI<Payload = unknown>(
		req: Request,
	): Promise<Context<Payload>> {
		const webHookContent = await req.text();
		const webHookBody = JSON.parse(webHookContent);

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

		return new Context<Payload>(shop, webHookBody, new HttpClient(shop));
	}

	/**
	 * Create a context from a request query parameters
	 * This is usually a module request from the shopware admin
	 */
	public async fromBrowser<Payload = unknown>(
		req: Request,
	): Promise<Context<Payload>> {
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

		return new Context<Payload>(
			shop,
			paramsObject as Payload,
			new HttpClient(shop),
		);
	}
}

/**
 * Context is the parsed data from the request
 */
export class Context<Payload = unknown> {
	constructor(
		public shop: ShopInterface,
		public payload: Payload,
		public httpClient: HttpClient,
	) {}
}
