import { ContextResolver } from "./context-resolver.js";
import { DualSignatureVerifier } from "./dual-signature-verifier.js";
import { Hooks } from "./hooks.js";
import { HttpClientTokenCacheInterface, InMemoryHttpClientTokenCache } from "./http-client.js";
import { Registration } from "./registration.js";
import type { ShopInterface, ShopRepositoryInterface } from "./repository.js";
import { WebCryptoHmacSigner } from "./signer.js";

/**
 * AppServer is the main class, this is where you start your app
 */
export class AppServer<Shop extends ShopInterface = ShopInterface> {
	public registration: Registration<Shop>;
	public contextResolver: ContextResolver<Shop>;
	public signer: WebCryptoHmacSigner;
	public requestVerifier: DualSignatureVerifier<Shop>;
	public hooks: Hooks<Shop>;

	constructor(
		public cfg: Configuration,
		public repository: ShopRepositoryInterface<Shop>,
		public httpClientTokenCache: HttpClientTokenCacheInterface = new InMemoryHttpClientTokenCache()
	) {
		this.registration = new Registration<Shop>(this);
		this.contextResolver = new ContextResolver<Shop>(this, httpClientTokenCache);
		this.signer = new WebCryptoHmacSigner();
		this.requestVerifier = new DualSignatureVerifier<Shop>(this.signer);
		this.hooks = new Hooks<Shop>();
	}
}

export interface Configuration {
	/**
	 * Your app name
	 */
	appName: string;

	/**
	 * Your app secret
	 */
	appSecret: string;

	/**
	 * URL to authorize callback url
	 */
	authorizeCallbackUrl: string;

	/**
	 * When true, registration requires both app and shop signatures during re-registration and confirmation.
	 * Defaults to false.
	 */
	enforceDoubleSignature?: boolean;
}
