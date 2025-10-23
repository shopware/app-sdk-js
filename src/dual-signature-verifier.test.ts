import {describe, expect, jest, test} from "bun:test";
import { WebCryptoHmacSigner } from "../src/signer.js";
import {SimpleShop} from "./repository.js";
import {DualSignatureVerifier} from "./dual-signature-verifier.js";

describe("Dual Signature Verifier", () => {
	const signer = new WebCryptoHmacSigner();

	test("authenticate post request with current secret", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "current-secret")
		const body = "body";

		const req = new Request("https://my-app.com/webhook", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": await signer.sign(body, shop.getShopSecret())
			}),
		});

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticatePostRequest(req, body, shop));
	});

	test("authenticate post request falls back to previous secret", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "new-secret")
		shop.setPreviousShopSecret("old-secret");
		shop.setSecretsRotatedAt(new Date());
		const body = "body";

		const req = new Request("https://my-app.com/webhook", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": await signer.sign(body, "old-secret")
			}),
		});

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticatePostRequest(req, body, shop));
	});

	test("authenticate post request throws when shop signature invalid and no previous secret", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "current-secret")
		const body = "body";

		const req = new Request("https://my-app.com/webhook", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": "invalid-signature",
			}),
		});

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticatePostRequest(req, body, shop)).rejects.toThrow("Invalid signature");
	});

	test("authenticate post request throws when using previous secret after rotation window", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "new-secret")
		shop.setPreviousShopSecret("old-secret")
		shop.setSecretsRotatedAt(new Date(Date.now() - 10 * 60 * 1000)); // rotated 10 minutes ago
		const body = "body";

		const req = new Request("https://my-app.com/webhook", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": await signer.sign(body, "old-secret"),
			}),
		});

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticatePostRequest(req, body, shop)).rejects.toThrow("Invalid signature");
	});

	test("authenticate post request throws with both invalid signatures", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "current-secret")
		shop.setPreviousShopSecret("old-secret")
		shop.setSecretsRotatedAt(new Date());
		const body = "body";

		const req = new Request("https://my-app.com/webhook", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": "completely-invalid-signature",
			}),
		});

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticatePostRequest(req, body, shop)).rejects.toThrow("Invalid signature");
	});

	test("authenticate post request throws if signature header is missing", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "current-secret")
		const body = "body";

		const req = new Request("https://my-app.com/webhook", {
			method: "POST",
			body,
			headers: new Headers({}),
		});

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticatePostRequest(req, body, shop)).rejects.toThrow("Missing shopware-shop-signature header");
	});

	test("authenticate post request fallback requires previous secret", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "current-secret")
		shop.setSecretsRotatedAt(new Date()); // has timestamp but no previous secret

		const body = "body";
		const req = new Request("https://my-app.com/webhook", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": "invalid-signature",
			}),
		});

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticatePostRequest(req, body, shop)).rejects.toThrow("Invalid signature");
	});

	test("authenticate post request fallback requires rotation timestamp", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "current-secret")
		shop.setPreviousShopSecret("old-secret"); // Has previous secret but no timestamp

		const body = "body";
		const req = new Request("https://my-app.com/webhook", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": "invalid-signature",
			}),
		});

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticatePostRequest(req, body, shop)).rejects.toThrow("Invalid signature");
	});

	test("authenticate post request throws at exact rotation boundary", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "new-secret")
		const now = Date.now();

		// exactly 60 seconds ago
		shop.setPreviousShopSecret("old-secret")
		shop.setSecretsRotatedAt(new Date(now - 60_000));

		const body = "body";
		const shopSignature = await signer.sign(body, "old-secret");
		const req = new Request("https://my-app.com/webhook", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": shopSignature,
			}),
		});

		const verifier = new DualSignatureVerifier(signer, () => new Date(now));
		await expect(verifier.authenticatePostRequest(req, body, shop)).rejects.toThrow();
	});

	test("authenticate get request with current secret", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "current-secret")
		const query = "test=1";
		const signature = await signer.sign(query, shop.getShopSecret());
		const url = `https://my-app.com/webhook?${query}&shopware-shop-signature=${signature}`;
		const req = new Request(url, { method: "GET" });

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateGetRequest(req, shop));
	});

	test("authenticate get request falls back to previous secret", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "new-secret")
		shop.setPreviousShopSecret("old-secret")
		shop.setSecretsRotatedAt(new Date());
		const query = "test=1";
		const signature = await signer.sign(query, shop.getPreviousShopSecret() as string);
		const url = `https://my-app.com/webhook?${query}&shopware-shop-signature=${signature}`;
		const req = new Request(url, { method: "GET" });

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateGetRequest(req, shop));
	});

	test("authenticate get request throws when shop signature invalid and no previous secret", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "current-secret")

		const query = "test=1";
		const url = `https://my-app.com/webhook?${query}&shopware-shop-signature=invalid-signature`;
		const req = new Request(url, { method: "GET" });

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateGetRequest(req, shop)).rejects.toThrow("Invalid signature");
	});

	test("authenticate get request throws when using previous secret after rotation window", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "new-secret")
		shop.setPreviousShopSecret("old-secret")
		shop.setSecretsRotatedAt(new Date(Date.now() - 10 * 60 * 1000)); // rotated 10 minutes ago
		const query = "test=1";
		const signature = await signer.sign(query, shop.getPreviousShopSecret() as string);
		const url = `https://my-app.com/webhook?${query}&shopware-shop-signature=${signature}`;
		const req = new Request(url, { method: "GET" });

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateGetRequest(req, shop)).rejects.toThrow("Invalid signature");
	});

	test("authenticate get request throws with both invalid signatures", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "current-secret")
		shop.setPreviousShopSecret("old-secret")
		shop.setSecretsRotatedAt(new Date());

		const query = "test=1";
		const url = `https://my-app.com/webhook?${query}&shopware-shop-signature=completely-invalid-signature`;
		const req = new Request(url, { method: "GET" });

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateGetRequest(req, shop)).rejects.toThrow("Invalid signature");
	});

	test("authenticate get request throws if signature header is missing", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "current-secret")

		const query = "test=1";
		const url = `https://my-app.com/webhook?${query}`;
		const req = new Request(url, { method: "GET" });

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateGetRequest(req, shop)).rejects.toThrow("Missing shopware-shop-signature query parameter");
	});

	test("authenticate get request fallback requires previous secret", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "current-secret")
		shop.setSecretsRotatedAt(new Date()); // has timestamp but no previous secret

		const query = "test=1";
		const url = `https://my-app.com/webhook?${query}&shopware-shop-signature=invalid-signature`;
		const req = new Request(url, { method: "GET" });

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateGetRequest(req, shop)).rejects.toThrow("Invalid signature");
	});

	test("authenticate get request fallback requires rotation timestamp", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "current-secret")
		shop.setPreviousShopSecret("old-secret"); // Has previous secret but no timestamp

		const query = "test=1";
		const url = `https://my-app.com/webhook?${query}&shopware-shop-signature=invalid-signature`;
		const req = new Request(url, { method: "GET" });

		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateGetRequest(req, shop)).rejects.toThrow("Invalid signature");
	});

	test("authenticate get request throws at exact rotation boundary", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "new-secret")
		const now = Date.now();

		// exactly 60 seconds ago
		shop.setPreviousShopSecret("old-secret")
		shop.setSecretsRotatedAt(new Date(now - 60_000));


		const query = "test=1";
		const shopSignature = await signer.sign(query, "old-secret");
		const url = `https://my-app.com/webhook?${query}&shopware-shop-signature=${shopSignature}`;
		const req = new Request(url, { method: "GET" });

		const verifier = new DualSignatureVerifier(signer, () => new Date(now));
		await expect(verifier.authenticateGetRequest(req, shop)).rejects.toThrow();
	});

	test("authenticate registration confirmation with new shop is successful", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "new-secret")
		shop.setPendingShopSecret("new-secret");

		const body = '{"shopId":"shop-1","apiKey":"key","secretKey":"secret"}';
		const shopSignature = await signer.sign(body, "new-secret");
		const req = new Request("https://my-app.com/confirm", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": shopSignature,
			}),
		});

		const cfg = { appSecret: "app-secret", enforceDoubleSignature: true };
		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateRegistrationConfirmation(req, body, shop, cfg));
	});

	test("authenticate registration confirmation throws if primary signature header is missing", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "new-secret")
		shop.setPendingShopSecret("new-secret");

		const body = '{"shopId":"shop-1","apiKey":"key","secretKey":"secret"}';
		const req = new Request("https://my-app.com/confirm", {
			method: "POST",
			body,
			headers: new Headers({}),
		});

		const cfg = { appSecret: "app-secret", enforceDoubleSignature: true };
		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateRegistrationConfirmation(req, body, shop, cfg)).rejects.toThrow("Missing shopware-shop-signature header");
	});

	test("authenticate registration confirmation with existing shop with both signatures is successful", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "old-secret")
		shop.setPendingShopSecret("new-secret");
		shop.setRegistrationConfirmed();
		const body = '{"shopId":"shop-1","apiKey":"key","secretKey":"secret"}';
		const newSignature = await signer.sign(body, "new-secret");
		const oldSignature = await signer.sign(body, "old-secret");

		const req = new Request("https://my-app.com/confirm", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": newSignature,
				"shopware-shop-signature-previous": oldSignature,
			}),
		});

		const cfg = { appSecret: "app-secret", enforceDoubleSignature: true };
		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateRegistrationConfirmation(req, body, shop, cfg));
	});

	test("authenticate registration confirmation with existing shop throws if previous header missing", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "old-secret")
		shop.setPendingShopSecret("new-secret");
		shop.setRegistrationConfirmed();
		const body = '{"shopId":"shop-1","apiKey":"key","secretKey":"secret"}';
		const newSignature = await signer.sign(body, "new-secret");

		const req = new Request("https://my-app.com/confirm", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": newSignature,
			}),
		});

		const cfg = { appSecret: "app-secret", enforceDoubleSignature: true };
		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateRegistrationConfirmation(req, body, shop, cfg)).rejects.toThrow();
	});

	test("authenticate registration confirmation with existing shop throws if previous signature invalid", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "old-secret")
		shop.setPendingShopSecret("new-secret");
		shop.setRegistrationConfirmed();
		const body = '{"shopId":"shop-1","apiKey":"key","secretKey":"secret"}';
		const newSignature = await signer.sign(body, "new-secret");

		const req = new Request("https://my-app.com/confirm", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": newSignature,
				"shopware-shop-signature-previous": "invalid-signature",
			}),
		});

		const cfg = { appSecret: "app-secret", enforceDoubleSignature: true };
		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateRegistrationConfirmation(req, body, shop, cfg)).rejects.toThrow("Invalid signature");
	});

	test("authenticate registration confirmation throws if previous signature invalid when not enforced", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "old-secret")
		shop.setPendingShopSecret("new-secret");
		shop.setRegistrationConfirmed();
		const body = '{"shopId":"shop-1","apiKey":"key","secretKey":"secret"}';
		const newSignature = await signer.sign(body, "new-secret");

		const req = new Request("https://my-app.com/confirm", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": newSignature,
				"shopware-shop-signature-previous": "invalid-signature",
			}),
		});

		const cfg = { appSecret: "app-secret", enforceDoubleSignature: false };
		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateRegistrationConfirmation(req, body, shop, cfg)).rejects.toThrow("Invalid signature");
	});

	test("authenticate registration confirmation with existing shop throws if pending signature invalid", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "old-secret")
		shop.setPendingShopSecret("new-secret");
		shop.setRegistrationConfirmed();
		const body = '{"shopId":"shop-1","apiKey":"key","secretKey":"secret"}';
		const oldSignature = await signer.sign(body, "old-secret");

		const req = new Request("https://my-app.com/confirm", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": "invalid-signature",
				"shopware-shop-signature-previous": oldSignature,
			}),
		});

		const cfg = { appSecret: "app-secret", enforceDoubleSignature: true };
		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateRegistrationConfirmation(req, body, shop, cfg)).rejects.toThrow("Invalid signature");
	});

	test("authenticate registration request with new shop is successful", async () => {
		const query = "shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890";
		const appSecret = "app-secret";
		const appSignature = await signer.sign(query, appSecret);
		const req = new Request(`https://my-app.com/register?${query}`, {
			method: "GET",
			headers: new Headers({
				"shopware-app-signature": appSignature,
			}),
		});

		const cfg = { appSecret, enforceDoubleSignature: true };
		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateRegistrationRequest(req, cfg, null));
	});

	test("authenticate registration request skips shop signature when registration not confirmed", async () => {
		const query = "shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890";
		const appSecret = "app-secret";
		const appSignature = await signer.sign(query, appSecret);
		const req = new Request(`https://my-app.com/register?${query}`, {
			method: "GET",
			headers: new Headers({
				"shopware-app-signature": appSignature,
			}),
		});

		const shop = new SimpleShop("123", "https://my-shop.com", "shop-secret");
		shop.setVerifiedWithDoubleSignature();

		const cfg = { appSecret, enforceDoubleSignature: true };
		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateRegistrationRequest(req, cfg, shop));
	});

	test("authenticate registration request with existing shop with both signatures is successful", async () => {
		const query = "shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890";
		const appSecret = "app-secret";
		const shopSecret = "shop-secret";
		const appSignature = await signer.sign(query, appSecret);
		const shopSignature = await signer.sign(query, shopSecret);

		const req = new Request(`https://my-app.com/register?${query}`, {
			method: "GET",
			headers: new Headers({
				"shopware-app-signature": appSignature,
				"shopware-shop-signature": shopSignature,
			}),
		});

		const shop = new SimpleShop("123", "https://my-shop.com", shopSecret);
		shop.setRegistrationConfirmed();
		const cfg = { appSecret, enforceDoubleSignature: true };
		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateRegistrationRequest(req, cfg, shop));
	});

	test("authenticate registration request with existing shop without double signature enforcement", async () => {
		const query = "shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890";
		const appSecret = "app-secret";
		const signature = await signer.sign(query, appSecret);

		const req = new Request(`https://my-app.com/register?${query}`, {
			method: "GET",
			headers: new Headers({
				"shopware-app-signature": signature,
			}),
		});

		const shop = new SimpleShop("123", "https://my-shop.com", "shop-secret")
		shop.setRegistrationConfirmed();
		const cfg = { appSecret, enforceDoubleSignature: false };
		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateRegistrationRequest(req, cfg, shop));
	});

	test("authenticate registration request throws if shop signature invalid when header provided and not enforced", async () => {
		const query = "shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890";
		const appSecret = "app-secret";
		const appSignature = await signer.sign(query, appSecret);

		const req = new Request(`https://my-app.com/register?${query}`, {
			method: "GET",
			headers: new Headers({
				"shopware-app-signature": appSignature,
				"shopware-shop-signature": "invalid-signature",
			}),
		});

		const shop = new SimpleShop("123", "https://my-shop.com", "shop-secret")
		shop.setRegistrationConfirmed();
		const cfg = { appSecret, enforceDoubleSignature: false };
		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateRegistrationRequest(req, cfg, shop)).rejects.toThrow("invalid-shop-registration-signature");
	});

	test("authenticate registration request with existing shop throws if shop signature missing", async () => {
		const query = "shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890";
		const appSecret = "app-secret";
		const signature = await signer.sign(query, appSecret);

		const req = new Request(`https://my-app.com/register?${query}`, {
			method: "GET",
			headers: new Headers({
				"shopware-app-signature": signature,
			}),
		});

		const shop = new SimpleShop("123", "https://my-shop.com", "shop-secret")
		shop.setRegistrationConfirmed();
		const cfg = { appSecret, enforceDoubleSignature: true };
		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateRegistrationRequest(req, cfg, shop)).rejects.toThrow();
	});

	test("authenticate registration request with existing shop throws if shop signature invalid", async () => {
		const query = "shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890";
		const appSecret = "app-secret";
		const signature = await signer.sign(query, appSecret);

		const req = new Request(`https://my-app.com/register?${query}`, {
			method: "GET",
			headers: new Headers({
				"shopware-app-signature": signature,
				"shopware-shop-signature": "invalid-signature",
			}),
		});

		const shop = new SimpleShop("123", "https://my-shop.com", "shop-secret")
		shop.setRegistrationConfirmed();
		const cfg = { appSecret, enforceDoubleSignature: true };
		const verifier = new DualSignatureVerifier(signer);
		await expect(verifier.authenticateRegistrationRequest(req, cfg, shop)).rejects.toThrow();
	});

	test("authenticate registration request forces old shop that used double verification to use double verification", async () => {
		const query = "shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890";
		const appSecret = "app-secret";
		const shopSecret = "shop-secret";
		const appSignature = await signer.sign(query, appSecret);
		const shopSignature = await signer.sign(query, shopSecret);

		const req = new Request(`https://my-app.com/register?${query}`, {
			method: "GET",
			headers: new Headers({
				"shopware-app-signature": appSignature,
				"shopware-shop-signature": shopSignature,
			}),
		});

		const shop = new SimpleShop("123", "https://my-shop.com", "shop-secret");
		shop.setVerifiedWithDoubleSignature();
		shop.setRegistrationConfirmed();

		const cfg = { appSecret, enforceDoubleSignature: false };

		const verifyMock = jest.fn().mockResolvedValue(true);
		const signerMock = {verify: verifyMock} as unknown as WebCryptoHmacSigner;

		const verifier = new DualSignatureVerifier(signerMock);
		await verifier.authenticateRegistrationRequest(req, cfg, shop);

		const data = `shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890`;
		expect(verifyMock.mock.calls[0]).toEqual([appSignature, data, appSecret]);
		expect(verifyMock.mock.calls[1]).toEqual([shopSignature, data, shopSecret]);
	});

	test("authenticate registration request uses double verification when headers provided", async () => {
		const query = "shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890";
		const appSecret = "app-secret";
		const shopSecret = "shop-secret";
		const appSignature = await signer.sign(query, appSecret);
		const shopSignature = await signer.sign(query, shopSecret);

		const req = new Request(`https://my-app.com/register?${query}`, {
			method: "GET",
			headers: new Headers({
				"shopware-app-signature": appSignature,
				"shopware-shop-signature": shopSignature,
			}),
		});

		const shop = new SimpleShop("123", "https://my-shop.com", "shop-secret");
		shop.setRegistrationConfirmed();
		const cfg = { appSecret, enforceDoubleSignature: false };

		const verifyMock = jest.fn().mockResolvedValue(true);
		const signerMock = {verify: verifyMock} as unknown as WebCryptoHmacSigner;

		const verifier = new DualSignatureVerifier(signerMock);
		await verifier.authenticateRegistrationRequest(req, cfg, shop);

		const data = `shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890`;
		expect(verifyMock.mock.calls[0]).toEqual([appSignature, data, appSecret]);
		expect(verifyMock.mock.calls[1]).toEqual([shopSignature, data, shopSecret]);
	});

	test("authenticate registration request throws when a shop that used double verification attempts to re-register without double verification", async () => {
		const query = "shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890";
		const appSecret = "app-secret";
		const appSignature = await signer.sign(query, appSecret);

		const req = new Request(`https://my-app.com/register?${query}`, {
			method: "GET",
			headers: new Headers({
				"shopware-app-signature": appSignature,
			}),
		});

		const shop = new SimpleShop("123", "https://my-shop.com", "shop-secret");
		shop.setVerifiedWithDoubleSignature();
		shop.setRegistrationConfirmed();
		const cfg = { appSecret, enforceDoubleSignature: false };

		const verifyMock = jest.fn().mockResolvedValue(true);
		const signerMock = {verify: verifyMock} as unknown as WebCryptoHmacSigner;

		const verifier = new DualSignatureVerifier(signerMock);

		await expect(verifier.authenticateRegistrationRequest(req, cfg, shop)).rejects.toThrow("invalid-shop-registration-signature");

		const data = `shop-id=123&shop-url=https://my-shop.com&timestamp=1234567890`;
		expect(verifyMock.mock.calls[0]).toEqual([appSignature, data, appSecret]);
	});

	test("authenticate registration confirmation forces old shop that used double verification to use double verification", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "old-secret");
		shop.setPendingShopSecret("new-secret");
		shop.setVerifiedWithDoubleSignature();
		shop.setRegistrationConfirmed();

		const body = '{"shopId":"shop-1","apiKey":"key","secretKey":"secret"}';
		const newSignature = await signer.sign(body, "new-secret");
		const oldSignature = await signer.sign(body, "old-secret");

		const req = new Request("https://my-app.com/confirm", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": newSignature,
				"shopware-shop-signature-previous": oldSignature,
			}),
		});

		const cfg = { appSecret: "app-secret", enforceDoubleSignature: false };

		const verifyMock = jest.fn().mockResolvedValue(true);
		const signerMock = {verify: verifyMock} as unknown as WebCryptoHmacSigner;
		const verifier = new DualSignatureVerifier(signerMock);

		await verifier.authenticateRegistrationConfirmation(req, body, shop, cfg);

		expect(verifyMock.mock.calls[0]).toEqual([newSignature, body, "new-secret"]);
		expect(verifyMock.mock.calls[1]).toEqual([oldSignature, body, "old-secret"]);
	});


	test("authenticate registration confirmation uses double verification when headers provided", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "old-secret");
		shop.setPendingShopSecret("new-secret");
		shop.setRegistrationConfirmed();

		const body = '{"shopId":"shop-1","apiKey":"key","secretKey":"secret"}';
		const newSignature = await signer.sign(body, "new-secret");
		const oldSignature = await signer.sign(body, "old-secret");

		const req = new Request("https://my-app.com/confirm", {
			method: "POST",
			body,
			headers: new Headers({
				"shopware-shop-signature": newSignature,
				"shopware-shop-signature-previous": oldSignature,
			}),
		});

		const cfg = { appSecret: "app-secret", enforceDoubleSignature: false };

		const verifyMock = jest.fn().mockResolvedValue(true);
		const signerMock = {verify: verifyMock} as unknown as WebCryptoHmacSigner;
		const verifier = new DualSignatureVerifier(signerMock);

		await verifier.authenticateRegistrationConfirmation(req, body, shop, cfg);

		expect(verifyMock.mock.calls[0]).toEqual([newSignature, body, "new-secret"]);
		expect(verifyMock.mock.calls[1]).toEqual([oldSignature, body, "old-secret"]);
	});

	test("authenticate registration confirmation throws when a shop that used double verification attempts to re-register without double verification", async () => {
		const shop = new SimpleShop("shop-1", "https://example.com", "shop-secret")
		shop.setPendingShopSecret("new-secret");
		shop.setVerifiedWithDoubleSignature();
		shop.setRegistrationConfirmed();

		const body = '{"shopId":"shop-1","apiKey":"key","secretKey":"secret"}';
		const req = new Request("https://my-app.com/confirm", {
			method: "POST",
			headers: {
				"shopware-shop-signature": await signer.sign(body, "new-secret"),
				"content-type": "application/json",
			},
			body,
		});

		const cfg = { appSecret: "app-secret", enforceDoubleSignature: false };
		const verifier = new DualSignatureVerifier(signer);

		await expect(verifier.authenticateRegistrationConfirmation(req, body, shop, cfg)).rejects.toThrow();
	});
});
