export class WebCryptoHmacSigner {
	private encoder: TextEncoder;
	private keyCache: Map<string, CryptoKey>;

	constructor() {
		this.encoder = new TextEncoder();
		this.keyCache = new Map<string, CryptoKey>();
	}

	async signResponse(response: Response, secret: string): Promise<void> {
		response.headers.set(
			"shopware-app-signature",
			await this.sign(await response.clone().text(), secret),
		);
	}

	async verifyGetRequest(request: Request, secret: string): Promise<void> {
		const url = new URL(request.url);
		const signature = url.searchParams.get("shopware-shop-signature");

		if (signature === null) {
			throw new Error("Missing shopware-shop-signature query parameter");
		}

		url.searchParams.delete("shopware-shop-signature");

		let body = "";

		for (const searchKey of url.searchParams.keys()) {
			body += `${searchKey}=${decodeURIComponent(url.searchParams.get(searchKey) as string)}&`;
		}

		body = body.slice(0, -1);

		if (body === "") {
			throw new Error("Missing query parameters to verify the GET request");
		}

		if (!(await this.verify(signature, body, secret))) {
			throw new Error("Invalid signature");
		}
	}

	async getKeyForSecret(secret: string): Promise<CryptoKey> {
		if (this.keyCache.has(secret)) {
			return this.keyCache.get(secret) as CryptoKey;
		}

		const secretKeyData = this.encoder.encode(secret);
		const key = await crypto.subtle.importKey(
			"raw",
			secretKeyData,
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign", "verify"],
		);

		this.keyCache.set(secret, key);

		return key;
	}

	async sign(message: string, secret: string): Promise<string> {
		const key = await this.getKeyForSecret(secret);

		const mac = await crypto.subtle.sign(
			"HMAC",
			key as CryptoKey,
			this.encoder.encode(message),
		);

		return this.buf2hex(mac);
	}

	async verify(
		signature: string,
		data: string,
		secret: string,
	): Promise<boolean> {
		const signed = await this.sign(data, secret);

		return signature === signed;
	}

	buf2hex(buf: ArrayBuffer): string {
		return Array.prototype.map
			.call(new Uint8Array(buf), (x) => `00${x.toString(16)}`.slice(-2))
			.join("");
	}
}
