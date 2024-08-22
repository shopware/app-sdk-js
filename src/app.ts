import { ContextResolver } from "./context-resolver.js";
import { Registration } from "./registration.js";
import type { ShopInterface, ShopRepositoryInterface } from "./repository.js";
import { WebCryptoHmacSigner } from "./signer.js";

/**
 * AppServer is the main class, this is where you start your app
 */
export class AppServer<Shop extends ShopInterface = ShopInterface> {
	public registration: Registration;
	public contextResolver: ContextResolver<Shop>;
	public signer: WebCryptoHmacSigner;

	constructor(
		public cfg: Configuration,
		public repository: ShopRepositoryInterface<Shop>,
	) {
		this.registration = new Registration(this);
		this.contextResolver = new ContextResolver(this);
		this.signer = new WebCryptoHmacSigner();
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
