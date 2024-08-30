import type { AppServer } from "./app.js";

export class Registration {
	constructor(private app: AppServer) {}

	/**
	 * This method checks the request for the handshake with the Shopware Shop.
	 * if it's valid a Shop will be created, and a proof will be responded with a confirmation url.
	 * then the Shop will call the confirmation url, and this should be handled by the authorizeCallback method to finish the handshake.
	 */
	public async authorize(req: Request): Promise<Response> {
		const url = new URL(req.url);

		if (
			!url.searchParams.has("shop-url") ||
			!req.headers.has("shopware-app-signature") ||
			!url.searchParams.has("shop-id") ||
			!url.searchParams.has("timestamp")
		) {
			return new InvalidRequestResponse("Invalid Request", 400);
		}

		const shopId = url.searchParams.get("shop-id") as string;
		const shopUrl = url.searchParams.get("shop-url") as string;
		const timestamp = url.searchParams.get("timestamp") as string;

		const v = await this.app.signer.verify(
			req.headers.get("shopware-app-signature") as string,
			`shop-id=${shopId}&shop-url=${shopUrl}&timestamp=${timestamp}`,
			this.app.cfg.appSecret,
		);

		if (!v) {
			return new InvalidRequestResponse("Cannot validate app signature");
		}

		const shopSecret = randomString();

		await this.app.repository.createShop(shopId, shopUrl, shopSecret);

		return new Response(
			JSON.stringify({
				proof: await this.app.signer.sign(
					shopId + shopUrl + this.app.cfg.appName,
					this.app.cfg.appSecret,
				),
				secret: shopSecret,
				confirmation_url: this.app.cfg.authorizeCallbackUrl,
			}),
			{
				headers: {
					"content-type": "application/json",
				},
			},
		);
	}

	/**
	 * This method is called by the Shopware Shop to confirm the handshake.
	 * It will update the shop with the given oauth2 credentials.
	 */
	public async authorizeCallback(req: Request): Promise<Response> {
		const bodyContent = await req.text();

		const body = JSON.parse(bodyContent);

		if (
			typeof body.shopId !== "string" ||
			typeof body.apiKey !== "string" ||
			typeof body.secretKey !== "string" ||
			!req.headers.has("shopware-shop-signature")
		) {
			return new InvalidRequestResponse("Invalid Request", 400);
		}

		const shop = await this.app.repository.getShopById(body.shopId as string);

		if (shop === null) {
			return new InvalidRequestResponse("Invalid shop given");
		}

		const v = await this.app.signer.verify(
			req.headers.get("shopware-shop-signature") as string,
			bodyContent,
			shop.getShopSecret(),
		);
		if (!v) {
			// Shop has failed the verify. Delete it from our DB
			await this.app.repository.deleteShop(shop.getShopId());

			return new InvalidRequestResponse("Cannot validate app signature");
		}

		shop.setShopCredentials(body.apiKey, body.secretKey);

		await this.app.repository.updateShop(shop);

		return new Response(null, { status: 204 });
	}

	/**
	 * This method should be called by Shopware Shop to set the shop active.
	 *
	 * <webhooks>
	 *   <webhook name="appActivate" url="http://localhost:3000/app/delete" event="app.activated"/>
	 * </webhooks>
	 */
	public async activate(req: Request): Promise<Response> {
		const ctx = await this.app.contextResolver.fromAPI(req);

		ctx.shop.setShopActive(true);

		await this.app.repository.updateShop(ctx.shop);

		return new Response(null, { status: 204 });
	}

	/**
	 * This method should be called by Shopware Shop to set the shop in-active.
	 *
	 * <webhooks>
	 *   <webhook name="appDeactivated" url="http://localhost:3000/app/deactivated" event="app.deactivated"/>
	 * </webhooks>
	 */
	public async deactivate(req: Request): Promise<Response> {
		const ctx = await this.app.contextResolver.fromAPI(req);

		ctx.shop.setShopActive(false);

		await this.app.repository.updateShop(ctx.shop);

		return new Response(null, { status: 204 });
	}

	/**
	 * This method should be called by Shopware Shop to delete the app.
	 *
	 * <webhooks>
	 *   <webhook name="appDelete" url="http://localhost:3000/app/delete" event="app.deleted"/>
	 * </webhooks>
	 */
	public async delete(req: Request): Promise<Response> {
		const ctx = await this.app.contextResolver.fromAPI(req);

		await this.app.repository.deleteShop(ctx.shop.getShopId());

		return new Response(null, { status: 204 });
	}
}

export function randomString(length = 120) {
	let result = "";
	const characters =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const charactersLength = characters.length;
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}

	return result;
}

class InvalidRequestResponse extends Response {
	constructor(message: string, status = 401) {
		super(JSON.stringify({ message }), {
			status,
			headers: {
				"content-type": "application/json",
			},
		});
	}
}
