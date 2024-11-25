import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { AppServer } from "../app.js";
import type { Context } from "../context-resolver.js";
import type { ShopInterface, ShopRepositoryInterface } from "../repository.js";

import type { Hono, Context as HonoContext } from "hono";

declare module "hono" {
	interface ContextVariableMap {
		// @ts-ignore
		app: AppServer<ShopInterface>;
		shop: ShopInterface;
		// @ts-ignore
		context: Context<ShopInterface, unknown>;
	}
}

interface MiddlewareConfig {
	/**
	 * The name of the app
	 */
	appName: string | ((c: HonoContext) => string);
	/**
	 * The secret of the app. When the app is published in the Shopware Store, the Shopware Store provides this value.
	 */
	appSecret: string | ((c: HonoContext) => string);

	/**
	 * The URL of the app. This is the base URL of the app. This will automatically determined by default
	 */
	appUrl?: string | null;

	/**
	 * The relative url of the app registration endpoint
	 *
	 * @default "/app/register"
	 */
	registrationUrl?: string | null;

	/**
	 * The relative url of the app registration confirmation endpoint
	 *
	 * @default "/app/register/confirm"
	 */
	registerConfirmationUrl?: string | null;

	/**
	 * The relative url of the app installation lifecycle endpoint
	 *
	 * @default "/app/install"
	 */
	appInstallUrl?: string | null;

	/**
	 * The relative url of the app activation lifecycle endpoint
	 *
	 * @default "/app/activate"
	 */
	appActivateUrl?: string | null;

	/**
	 * The relative url of the app update lifecycle endpoint
	 *
	 * @default "/app/update"
	 */
	appUpdateUrl?: string | null;

	/**
	 * The relative url of the app deactivation lifecycle endpoint
	 *
	 * @default "/app/deactivate"
	 */
	appDeactivateUrl?: string | null;

	/**
	 * The relative url of the app deletion lifecycle endpoint
	 *
	 * @default "/app/delete"
	 */
	appDeleteUrl?: string | null;

	/**
	 * The relative url of the app scope. All requests matching this will be the signature automatically validated and the response will be signed
	 *
	 * @default "/app/*"
	 */
	appPath?: string | null;

	/**
	 * Enable the app iframe integration. This will automatically set a cookie to identifiy the shopware shop and validate the request from a client side application. See appIframeRedirects
	 */
	appIframeEnable?: boolean;

	/**
	 * The relative url of the app iframe scope. All requests matching this will require that the request has an cookie set with the shopware shop. This cookie will be automatically set by
	 *
	 * @default "/client-api/*"
	 */
	appIframePath?: string | null;

	/**
	 * A mapping of the app iframe paths to the actual paths. This route will set a cookie automatically before the redirect to the actual path. In that way the client side application can send requests to /app-iframe/* with the cookie set and the server will automatically validate the request and knows which shop the request is for.
	 *
	 * @default {
	 *  "/app/module": "https://my-static-client-side-app.com"
	 * }
	 */
	appIframeRedirects?: Record<string, string>;

	/**
	 * The repository to fetch and store the shop data
	 */
	shopRepository:
		| ShopRepositoryInterface
		| ((c: HonoContext) => ShopRepositoryInterface);

	/**
	 * A callback to setup the app server. It will be called after the app server is created and before the first request is handled
	 */
	setup?: (app: AppServer) => void;
}

/**
 * Configure the Hono server to handle the app registration and context resolution
 */
export function configureAppServer(hono: Hono, cfg: MiddlewareConfig) {
	let app: AppServer | null = null;

	cfg.registrationUrl = cfg.registrationUrl || "/app/register";
	cfg.registerConfirmationUrl =
		cfg.registerConfirmationUrl || "/app/register/confirm";
	cfg.appActivateUrl = cfg.appActivateUrl || "/app/activate";
	cfg.appDeactivateUrl = cfg.appDeactivateUrl || "/app/deactivate";
	cfg.appDeleteUrl = cfg.appDeleteUrl || "/app/delete";
	cfg.appPath = cfg.appPath || "/app/*";

	cfg.appIframePath = cfg.appIframePath || "/client-api/*";

	hono.use("*", async (ctx, next) => {
		if (app === null) {
			const appUrl = cfg.appUrl || buildBaseUrl(ctx.req.url);

			if (typeof cfg.shopRepository === "function") {
				cfg.shopRepository = cfg.shopRepository(ctx);
			}

			if (typeof cfg.appName === "function") {
				cfg.appName = cfg.appName(ctx);
			}

			if (typeof cfg.appSecret === "function") {
				cfg.appSecret = cfg.appSecret(ctx);
			}

			app = new AppServer(
				{
					appName: cfg.appName,
					appSecret: cfg.appSecret,
					authorizeCallbackUrl: appUrl + cfg.registerConfirmationUrl,
				},
				cfg.shopRepository,
			);

			if (cfg.setup) {
				cfg.setup(app);
			}
		}

		// @ts-ignore
		ctx.set("app", app);

		await next();
	});

	hono.use(cfg.appPath, async (ctx, next) => {
		// @ts-ignore
		const app = ctx.get("app") as AppServer;

		// Don't validate signature for registration
		if (
			ctx.req.path === cfg.registrationUrl ||
			ctx.req.path === cfg.registerConfirmationUrl ||
			ctx.req.path === cfg.appActivateUrl ||
			ctx.req.path === cfg.appDeactivateUrl ||
			ctx.req.path === cfg.appDeleteUrl
		) {
			await next();
			return;
		}

		let context: Context<ShopInterface, unknown>;
		try {
			context =
				ctx.req.method === "GET"
					? await app.contextResolver.fromBrowser(ctx.req.raw)
					: await app.contextResolver.fromAPI(ctx.req.raw);
		} catch (_e) {
			return jsonResponse({ message: "Invalid request" }, 400);
		}

		// @ts-ignore
		ctx.set("shop", context.shop);
		// @ts-ignore
		ctx.set("context", context);

		await next();

		const cloned = ctx.res.clone();

		await ctx
			.get("app")
			.signer.signResponse(cloned, ctx.get("shop").getShopSecret());

		ctx.header(
			"shopware-app-signature",
			cloned.headers.get("shopware-app-signature") as string,
		);
	});

	hono.get(cfg.registrationUrl, async (ctx) => {
		const app = ctx.get("app");

		return await app.registration.authorize(ctx.req.raw);
	});

	hono.post(cfg.registerConfirmationUrl, async (ctx) => {
		const app = ctx.get("app");

		return await app.registration.authorizeCallback(ctx.req.raw);
	});

	hono.post(cfg.appInstallUrl, async (ctx) => {
		const app = ctx.get("app");

		return await app.registration.install(ctx.req.raw);
	});

	hono.post(cfg.appActivateUrl, async (ctx) => {
		const app = ctx.get("app");

		return await app.registration.activate(ctx.req.raw);
	});

	hono.post(cfg.appUpdateUrl, async (ctx) => {
		const app = ctx.get("app");

		return await app.registration.update(ctx.req.raw);
	});

	hono.post(cfg.appDeactivateUrl, async (ctx) => {
		const app = ctx.get("app");

		return await app.registration.deactivate(ctx.req.raw);
	});

	hono.post(cfg.appDeleteUrl, async (ctx) => {
		const app = ctx.get("app");

		return await app.registration.delete(ctx.req.raw);
	});

	if (cfg.appIframeEnable) {
		hono.use(cfg.appIframePath, async (ctx, next) => {
			const shopId = await getSignedCookie(
				ctx,
				ctx.get("app").cfg.appSecret,
				"shop",
			);

			if (!shopId) {
				return ctx.json({ message: "Shop not found" }, { status: 400 });
			}

			const shop = await ctx.get("app").repository.getShopById(shopId);

			if (!shop) {
				return ctx.json({ message: "Shop not found" }, { status: 400 });
			}

			ctx.set("shop", shop);

			await next();
		});

		for (let [path, redirect] of Object.entries(cfg.appIframeRedirects || {})) {
			hono.get(path, async (ctx) => {
				const url = new URL(ctx.req.url);

				if (redirect.startsWith("/")) {
					url.pathname = redirect;
					redirect = url.toString();
				} else {
					const newUrl = new URL(redirect);

					for (const [key, value] of url.searchParams) {
						newUrl.searchParams.set(key, value);
					}

					redirect = newUrl.toString();
				}

				await setSignedCookie(
					ctx,
					"shop",
					ctx.get("shop").getShopId(),
					ctx.get("app").cfg.appSecret,
				);

				return ctx.redirect(redirect);
			});
		}
	}
}

function jsonResponse(body: object, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

function buildBaseUrl(url: string): string {
	const u = new URL(url);

	return `${u.protocol}//${u.host}`;
}
