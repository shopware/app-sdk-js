import { ContextResolver } from "./context-resolver.js";
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
	public hooks: Hooks<Shop>;

	constructor(
		public cfg: Configuration,
		public repository: ShopRepositoryInterface<Shop>,
		public httpClientTokenCache: HttpClientTokenCacheInterface = new InMemoryHttpClientTokenCache()
	) {
		this.registration = new Registration<Shop>(this);
		this.contextResolver = new ContextResolver<Shop>(this, httpClientTokenCache);
		this.signer = new WebCryptoHmacSigner();
		this.hooks = new Hooks<Shop>();
	}
}

interface Configuration {
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
}
