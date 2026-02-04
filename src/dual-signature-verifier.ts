import type { ShopInterface } from "./repository.js";
import { WebCryptoHmacSigner } from "./signer.js";

const SHOPWARE_SHOP_SIGNATURE_HEADER = "shopware-shop-signature";
const SHOPWARE_SHOP_SIGNATURE_PREVIOUS_HEADER = "shopware-shop-signature-previous";
const SHOPWARE_APP_SIGNATURE_HEADER = "shopware-app-signature";
const INFLIGHT_ALLOWANCE_MS = 60_000;

export interface DualSignatureConfiguration {
	appSecret: string;
	enforceDoubleSignature: boolean;
}

export class DualSignatureVerifier<Shop extends ShopInterface = ShopInterface> {
	constructor(
		private readonly signer: WebCryptoHmacSigner,
		private readonly now: () => Date = () => new Date(),
	) {}

	public async authenticateRegistrationRequest(
		req: Request,
		cfg: DualSignatureConfiguration,
		shop: Shop | null,
	): Promise<void> {
		try {
			await this.verifyRegistrationAppSignature(req, cfg.appSecret);
		} catch (error) {
			throw new Error("invalid-app-signature", { cause: error });
		}

		if (shop?.isRegistrationConfirmed() && this.shouldEnforceDoubleSignatureForRegister(cfg, shop, req)) {
			try {
				await this.verifyRegistrationShopSignature(req, shop.getShopSecret());
			} catch (error) {
				throw new Error("invalid-shop-registration-signature", { cause: error });
			}
		}
	}

	public async authenticateRegistrationConfirmation(
		req: Request,
		body: string,
		shop: Shop,
		cfg: DualSignatureConfiguration,
	): Promise<void> {
		const pendingSecret = shop.getPendingShopSecret();

		if (pendingSecret === null) {
			throw new Error("Signature could not be verified");
		}

		await this.verifyPostSignature(req, body, pendingSecret, SHOPWARE_SHOP_SIGNATURE_HEADER);

		if (!shop.isRegistrationConfirmed()) {
			return;
		}

		if (this.shouldEnforceDoubleSignatureForRegisterConfirm(cfg, shop, req)) {
			await this.verifyPostSignature(req, body, shop.getShopSecret(), SHOPWARE_SHOP_SIGNATURE_PREVIOUS_HEADER);
		}
	}

	public async authenticatePostRequest(
		req: Request,
		body: string,
		shop: Shop,
	): Promise<void> {
		try {
			await this.verifyPostSignature(req, body, shop.getShopSecret(), SHOPWARE_SHOP_SIGNATURE_HEADER);
		} catch (error) {
			await this.tryAuthenticateWithPreviousSecret(
				shop,
				error,
				async (secret) => {
					await this.verifyPostSignature(req, body, secret, SHOPWARE_SHOP_SIGNATURE_HEADER);
				},
			);
		}
	}

	public async authenticateGetRequest(req: Request, shop: Shop): Promise<void> {
		try {
			await this.signer.verifyGetRequest(req, shop.getShopSecret());
		} catch (error) {
			await this.tryAuthenticateWithPreviousSecret(
				shop,
				error,
				async (secret) => {
					await this.signer.verifyGetRequest(req, secret);
				},
			);
		}
	}

	private async verifyRegistrationAppSignature(req: Request, secret: string): Promise<void> {
		const signature = req.headers.get(SHOPWARE_APP_SIGNATURE_HEADER);

		if (signature === null) {
			throw new Error("Missing shopware-app-signature header");
		}

		const message = this.getRegistrationSignatureMessage(req);
		const valid = await this.signer.verify(signature, message, secret);

		if (!valid) {
			throw new Error("Invalid app signature");
		}
	}

	private async verifyRegistrationShopSignature(req: Request, secret: string): Promise<void> {
		const signature = req.headers.get(SHOPWARE_SHOP_SIGNATURE_HEADER);

		if (signature === null) {
			throw new Error("Missing shopware-shop-signature header");
		}

		const message = this.getRegistrationSignatureMessage(req);
		const valid = await this.signer.verify(signature, message, secret);

		if (!valid) {
			throw new Error("Invalid shop signature");
		}
	}

	private async verifyPostSignature(
		req: Request,
		body: string,
		secret: string,
		headerName: string,
	): Promise<void> {
		const signature = req.headers.get(headerName);

		if (signature === null) {
			throw new Error(`Missing ${headerName} header`);
		}

		const valid = await this.signer.verify(signature, body, secret);

		if (!valid) {
			throw new Error("Invalid signature");
		}
	}

	private getRegistrationSignatureMessage(req: Request): string {
		const url = new URL(req.url);
		const shopId = url.searchParams.get("shop-id");
		const shopUrl = url.searchParams.get("shop-url");
		const timestamp = url.searchParams.get("timestamp");

		if (!shopId || !shopUrl || !timestamp) {
			throw new Error("Missing required registration parameters");
		}

		return `shop-id=${shopId}&shop-url=${shopUrl}&timestamp=${timestamp}`;
	}

	private async tryAuthenticateWithPreviousSecret(
		shop: Shop,
		error: unknown,
		verify: (secret: string) => Promise<void>,
	): Promise<void> {
		const previousSecret = shop.getPreviousShopSecret();
		const rotatedAt = shop.getSecretsRotatedAt();

		if (previousSecret === null || rotatedAt === null) {
			throw error instanceof Error ? error : new Error("Invalid signature");
		}

		const allowanceEnd = rotatedAt.getTime() + INFLIGHT_ALLOWANCE_MS;

		if (this.now().getTime() >= allowanceEnd) {
			throw error instanceof Error ? error : new Error("Invalid signature");
		}

		await verify(previousSecret);
	}

	/**
	 * @deprecated tag:v6.0.0 - Will be removed. Double signature verification will always be enforced.
	 *
	 * 1. If the shop has previously verified with a double signature, it must always do so
	 * 2. If the shop is sending a double signature, then we should also verify it
	 * 3. If the app is configured to enforce double signature, then we should force it
	 */
	private shouldEnforceDoubleSignature(cfg: DualSignatureConfiguration, shop: Shop, req: Request, header: string): boolean
	{
		return shop.hasVerifiedWithDoubleSignature() || req.headers.has(header) || cfg.enforceDoubleSignature;
	}

	private shouldEnforceDoubleSignatureForRegister(cfg: DualSignatureConfiguration, shop: Shop, req: Request): boolean
	{
		return this.shouldEnforceDoubleSignature(cfg, shop, req, SHOPWARE_SHOP_SIGNATURE_HEADER);
	}

	private shouldEnforceDoubleSignatureForRegisterConfirm(cfg: DualSignatureConfiguration, shop: Shop, req: Request): boolean
	{
		return this.shouldEnforceDoubleSignature(cfg, shop, req, SHOPWARE_SHOP_SIGNATURE_PREVIOUS_HEADER);
	}
}
