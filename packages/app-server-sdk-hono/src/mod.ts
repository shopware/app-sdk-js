import { AppServer } from "@shopware-ag/app-server-sdk";
import type {
	Context,
	ShopInterface,
	ShopRepositoryInterface,
} from "@shopware-ag/app-server-sdk";

import type { Hono, Context as HonoContext } from "hono";

declare module "hono" {
	interface ContextVariableMap {
		app: AppServer;
		shop: ShopInterface;
		context: Context;
	}
}

interface MiddlewareConfig {
	appName: string | ((c: HonoContext) => string);
	appSecret: string | ((c: HonoContext) => string);
	appUrl?: string | null;
	registrationUrl?: string | null;
	registerConfirmationUrl?: string | null;
	appPath?: string | null;
	shopRepository:
		| ShopRepositoryInterface
		| ((c: HonoContext) => ShopRepositoryInterface);
}

/**
 * Configure the Hono server to handle the app registration and context resolution
 */
export function configureAppServer(hono: Hono, cfg: MiddlewareConfig) {
	let app: AppServer | null = null;

	cfg.registrationUrl = cfg.registrationUrl || "/app/register";
	cfg.registerConfirmationUrl =
		cfg.registerConfirmationUrl || "/app/register/confirm";
	cfg.appPath = cfg.appPath || "/app/*";

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
		}

		ctx.set("app", app);

		await next();
	});

	hono.use(cfg.appPath, async (ctx, next) => {
		const app = ctx.get("app") as AppServer;

		// Don't validate signature for registration
		if (
			ctx.req.path === cfg.registrationUrl ||
			ctx.req.path === cfg.registerConfirmationUrl
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

		ctx.set("shop", context.shop);
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
