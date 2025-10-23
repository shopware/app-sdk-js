import type { AppServer } from "./app.js";
import type { ShopInterface } from "./repository.js";

export class Registration<Shop extends ShopInterface = ShopInterface> {
	constructor(private app: AppServer<Shop>) {}

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
		const sanitizedShopUrl = shopUrl
			.replace(/([^:])(\/\/+)/g, "$1/")
			.replace(/\/+$/, "");

		const beforeRegistrationEvent = new BeforeRegistrationEvent(req, shopId, shopUrl);
		this.app.hooks.publish('onBeforeRegistrationEvent', beforeRegistrationEvent);

		if (beforeRegistrationEvent.reason) {
			return new InvalidRequestResponse(beforeRegistrationEvent.reason, 400);
		}

		const shop = await this.app.repository.getShopById(shopId);

		try {
			await this.app.requestVerifier.authenticateRegistrationRequest(req, {
					appSecret: this.app.cfg.appSecret,
					enforceDoubleSignature: this.app.cfg.enforceDoubleSignature ?? false,
				},
				shop,
			);
		} catch {
			return new InvalidRequestResponse("Cannot validate app signature");
		}

		const shopSecret = randomString();

		if (shop === null) {
			await this.app.repository.createShop(shopId, sanitizedShopUrl, shopSecret);
			const shop = (await this.app.repository.getShopById(shopId))!;
			shop.setPendingShopSecret(shopSecret);
			shop.setPendingShopUrl(sanitizedShopUrl);
			this.setVerifiedWithDoubleSignature(shop, req);
			await this.app.repository.updateShop(shop);
		} else {
			shop.setPendingShopSecret(shopSecret);
			shop.setPendingShopUrl(sanitizedShopUrl);
			this.setVerifiedWithDoubleSignature(shop, req);
			await this.app.repository.updateShop(shop);
		}

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

		try {
			await this.app.requestVerifier.authenticateRegistrationConfirmation(
				req,
				bodyContent,
				shop,
				{
					appSecret: this.app.cfg.appSecret,
					enforceDoubleSignature: this.app.cfg.enforceDoubleSignature ?? false,
				},
			);
		} catch {
			return new InvalidRequestResponse("Cannot validate app signature");
		}

		const pendingSecret = shop.getPendingShopSecret();
		const pendingUrl = shop.getPendingShopUrl();
		if (pendingSecret === null || pendingUrl === null) {
			return new InvalidRequestResponse("Invalid Request", 400);
		}

		const previousSecret = shop.getShopSecret();
		if (pendingSecret !== previousSecret) {
			shop.setPreviousShopSecret(previousSecret);
			shop.setShopSecret(pendingSecret);
			shop.setSecretsRotatedAt(new Date());
		}

		shop.setPendingShopSecret(null);
		shop.setShopUrl(pendingUrl);
		shop.setPendingShopUrl(null);

		shop.setShopCredentials(body.apiKey, body.secretKey);

		const event = new ShopAuthorizeEvent(req, shop);
		await this.app.hooks.publish("onAuthorize", event);

		if (event.reason) {
			await this.app.repository.deleteShop(shop.getShopId());

			return new InvalidRequestResponse(event.reason, 403);
		}

		shop.setRegistrationConfirmed();

		await this.app.repository.updateShop(shop);

		return new Response(null, { status: 204 });
	}

	/**
	 * This method should be called by Shopware Shop to set the shop active.
	 *
	 * <webhooks>
	 *   <webhook name="appActivate" url="http://localhost:3000/app/activate" event="app.activated"/>
	 * </webhooks>
	 */
	public async activate(req: Request): Promise<Response> {
		const ctx = await this.app.contextResolver.fromAPI(req);

		const event = new AppActivateEvent(req, ctx.shop);
		await this.app.hooks.publish("onAppActivate", event);

		ctx.shop.setShopActive(true);

		await this.app.repository.updateShop(ctx.shop);

		return new Response(null, { status: 204 });
	}

	/**
	 * This method should be called by Shopware when the app was installed.
	 *
	 * <webhooks>
	 *   <webhook name="appInstall" url="http://localhost:3000/app/install" event="app.installed"/>
	 * </webhooks>
	 */
	public async install(req: Request): Promise<Response> {
		const ctx = await this.app.contextResolver.fromAPI<{
			data: { payload: { appVersion: string } };
		}>(req);

		const event = new AppInstallEvent(
			req,
			ctx.shop,
			ctx.payload?.data?.payload?.appVersion ?? null,
		);
		await this.app.hooks.publish("onAppInstall", event);

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

		const event = new AppDeactivateEvent(req, ctx.shop);
		await this.app.hooks.publish("onAppDeactivate", event);

		ctx.shop.setShopActive(false);

		await this.app.repository.updateShop(ctx.shop);

		return new Response(null, { status: 204 });
	}

	/**
	 * This method should be called by Shopware when the app was updated.
	 *
	 * <webhooks>
	 *   <webhook name="appUpdated" url="http://localhost:3000/app/update" event="app.updated"/>
	 * </webhooks>
	 */
	public async update(req: Request): Promise<Response> {
		const ctx = await this.app.contextResolver.fromAPI<{
			data: { payload: { appVersion: string } };
		}>(req);

		const event = new AppUpdateEvent(
			req,
			ctx.shop,
			ctx.payload?.data?.payload?.appVersion ?? null,
		);
		await this.app.hooks.publish("onAppUpdate", event);

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
		const ctx = await this.app.contextResolver.fromAPI<{
			data: { payload: { keepUserData?: boolean } };
		}>(req);

		const event = new AppUninstallEvent(
			req,
			ctx.shop,
			ctx.payload?.data?.payload?.keepUserData ?? null,
		);
		await this.app.hooks.publish("onAppUninstall", event);

		if (event.keepUserData === false) {
			await this.app.repository.deleteShop(ctx.shop.getShopId());
		}

		return new Response(null, { status: 204 });
	}

	/**
	 * @deprecated tag:v6.0.0 - Will be removed. Double signature verification will always be enforced.
	 */
	private setVerifiedWithDoubleSignature(shop: Shop, req: Request): void
	{
		if (this.app.cfg.enforceDoubleSignature || req.headers.has('shopware-shop-signature')) {
			shop.setVerifiedWithDoubleSignature();
		}
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
	constructor(error: string, status = 401) {
		super(JSON.stringify({ error }), {
			status,
			headers: {
				"content-type": "application/json",
			},
		});
	}
}

export class ShopAuthorizeEvent<Shop extends ShopInterface = ShopInterface> {
	private reject: string | null = null;

	constructor(
		public request: Request,
		public shop: Shop,
	) {}

	public rejectRegistration(reason: string) {
		this.reject = reason;
	}

	public get reason() {
		return this.reject;
	}
}

export class AppInstallEvent<Shop extends ShopInterface = ShopInterface> {
	constructor(
		public request: Request,
		public shop: Shop,
		public appVersion: string | null = null,
	) {}
}

export class AppActivateEvent<Shop extends ShopInterface = ShopInterface> {
	constructor(
		public request: Request,
		public shop: Shop,
	) {}
}

export class AppDeactivateEvent<Shop extends ShopInterface = ShopInterface> {
	constructor(
		public request: Request,
		public shop: Shop,
	) {}
}

export class AppUpdateEvent<Shop extends ShopInterface = ShopInterface> {
	constructor(
		public request: Request,
		public shop: Shop,
		public appVersion: string | null = null,
	) {}
}

export class AppUninstallEvent<Shop extends ShopInterface = ShopInterface> {
	constructor(
		public request: Request,
		public shop: Shop,
		public keepUserData: boolean | null = null,
	) {}
}

export class BeforeRegistrationEvent<Shop extends ShopInterface = ShopInterface> {
	private cancellationReason: string | null = null;
	
	constructor(
		public request: Request,
		public shopId: string,
		public shopUrl: string,
	) {}

	public rejectRegistration(reason: string) {
		this.cancellationReason = reason;
	}

	public get reason() {
		return this.cancellationReason;
	}
}
