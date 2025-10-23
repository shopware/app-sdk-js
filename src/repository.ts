/**
 * ShopInterface defines the object that given back from the ShopRepository, it should methods to get the shop data and set them
 */
export interface ShopInterface {
	getShopId(): string;
	getShopUrl(): string;
	setShopUrl(url: string): void;
	getShopSecret(): string;
	setShopSecret(secret: string): void;
	getPreviousShopSecret(): string | null;
	setPreviousShopSecret(secret: string | null): void;
	getPendingShopSecret(): string | null;
	setPendingShopSecret(secret: string | null): void;
	getPendingShopUrl(): string | null;
	setPendingShopUrl(url: string | null): void;
	getSecretsRotatedAt(): Date | null;
	setSecretsRotatedAt(rotatedAt: Date | null): void;
	getShopClientId(): string | null;
	getShopClientSecret(): string | null;
	getShopActive(): boolean;
	setShopCredentials(clientId: string, clientSecret: string): void;
	setShopActive(active: boolean): void;
	/**
	 * Indicates whether at least one registration confirmation has been completed.
	 */
	isRegistrationConfirmed(): boolean;
	setRegistrationConfirmed(): void;

    /**
     * @deprecated tag:v6.0.0 - Will be removed. Double signature verification will always be enforced.
     */
    setVerifiedWithDoubleSignature(): void;

    /**
     * @deprecated tag:v6.0.0 - Will be removed. Double signature verification will always be enforced.
     */
    hasVerifiedWithDoubleSignature(): boolean;
}

/**
 * ShopRepositoryInterface is the storage interface for the shops, you should implement this to save the shop data to your database
 * For testing cases the InMemoryShopRepository can be used
 */
export interface ShopRepositoryInterface<
	Shop extends ShopInterface = ShopInterface,
> {
	createShop(id: string, url: string, secret: string): Promise<void>;

	getShopById(id: string): Promise<Shop | null>;

	updateShop(shop: Shop): Promise<void>;

	deleteShop(id: string): Promise<void>;
}

/**
 * SimpleShop is a simple implementation of the ShopInterface, it stores the shop data in memory
 */
export class SimpleShop implements ShopInterface {
	private shopId: string;
	private shopUrl: string;
	private shopSecret: string;
	private previousShopSecret: string | null;
	private pendingShopSecret: string | null;
	private pendingShopUrl: string | null;
	private secretsRotatedAt: Date | null;
	private shopClientId: string | null;
	private shopClientSecret: string | null;
	private shopActive = false;
	private registrationConfirmed: boolean;
    /**
     * @deprecated tag:v6.0.0 - Will be removed. Double signature verification will always be enforced.
     */
	private verifiedWithDoubleSignature: boolean;

	constructor(
		shopId: string,
		shopUrl: string,
		shopSecret: string,
		registrationConfirmed = false,
	) {
		this.shopId = shopId;
		this.shopUrl = shopUrl;
		this.shopSecret = shopSecret;
		this.previousShopSecret = null;
		this.pendingShopSecret = null;
		this.pendingShopUrl = null;
		this.secretsRotatedAt = null;
		this.shopClientId = null;
		this.shopClientSecret = null;
        this.verifiedWithDoubleSignature = false;
		this.registrationConfirmed = registrationConfirmed;
	}

	getShopActive(): boolean {
		return this.shopActive;
	}
	setShopActive(active: boolean): void {
		this.shopActive = active;
	}
	getShopId(): string {
		return this.shopId;
	}
	getShopUrl(): string {
		return this.shopUrl;
	}
	setShopUrl(url: string): void {
		this.shopUrl = url;
	}
	getShopSecret(): string {
		return this.shopSecret;
	}
	setShopSecret(secret: string): void {
		this.shopSecret = secret;
	}
	getPreviousShopSecret(): string | null {
		return this.previousShopSecret;
	}
	setPreviousShopSecret(secret: string | null): void {
		this.previousShopSecret = secret;
	}
	getPendingShopSecret(): string | null {
		return this.pendingShopSecret;
	}
	setPendingShopSecret(secret: string | null): void {
		this.pendingShopSecret = secret;
	}
	getPendingShopUrl(): string | null {
		return this.pendingShopUrl;
	}
	setPendingShopUrl(url: string | null): void {
		this.pendingShopUrl = url;
	}
	getSecretsRotatedAt(): Date | null {
		return this.secretsRotatedAt;
	}
	setSecretsRotatedAt(rotatedAt: Date | null): void {
		this.secretsRotatedAt = rotatedAt;
	}
	getShopClientId(): string | null {
		return this.shopClientId;
	}
	getShopClientSecret(): string | null {
		return this.shopClientSecret;
	}
	setShopCredentials(clientId: string, clientSecret: string): void {
		this.shopClientId = clientId;
		this.shopClientSecret = clientSecret;
	}
	isRegistrationConfirmed(): boolean {
		return this.registrationConfirmed;
	}
	setRegistrationConfirmed(): void {
		this.registrationConfirmed = true;
	}
    /**
     * @deprecated tag:v6.0.0 - Will be removed. Double signature verification will always be enforced.
     */
    setVerifiedWithDoubleSignature(): void {
        this.verifiedWithDoubleSignature = true;
    }
    /**
     * @deprecated tag:v6.0.0 - Will be removed. Double signature verification will always be enforced.
     */
    hasVerifiedWithDoubleSignature(): boolean {
        return this.verifiedWithDoubleSignature;
    }
}

/**
 * InMemoryShopRepository is a simple implementation of the ShopRepositoryInterface, it stores the shop data in memory
 */
export class InMemoryShopRepository
	implements ShopRepositoryInterface<SimpleShop>
{
	private storage: Map<string, SimpleShop>;

	constructor() {
		this.storage = new Map<string, SimpleShop>();
	}

	async createShop(id: string, url: string, secret: string) {
		this.storage.set(id, new SimpleShop(id, url, secret));
	}

	async getShopById(id: string): Promise<SimpleShop | null> {
		const shop = this.storage.get(id);

		if (shop === undefined) {
			return null;
		}

		return shop;
	}

	async updateShop(shop: SimpleShop) {
		this.storage.set(shop.getShopId(), shop);
	}

	async deleteShop(id: string) {
		this.storage.delete(id);
	}
}
