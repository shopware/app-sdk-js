import { Registration } from "./registration.js";
import { WebCryptoHmacSigner } from "./signer.js";
import type { ShopRepositoryInterface } from "./repository.js";
import { ContextResolver } from "./context-resolver.js";

/**
 * AppServer is the main class, this is where you start your app
 */
export class AppServer {
	public registration: Registration;
	public contextResolver: ContextResolver;
	public signer: WebCryptoHmacSigner;

	constructor(
		public cfg: Configuration,
		public repository: ShopRepositoryInterface,
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
