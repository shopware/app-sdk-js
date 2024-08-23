/**
 * ShopInterface defines the object that given back from the ShopRepository, it should methods to get the shop data and set them
 */
export interface ShopInterface {
	getShopId(): string;
	getShopUrl(): string;
	getShopSecret(): string;
	getShopClientId(): string | null;
	getShopClientSecret(): string | null;
	setShopCredentials(clientId: string, clientSecret: string): void;
}

/**
 * ShopRepositoryInterface is the storage interface for the shops, you should implement this to save the shop data to your database
 * For testing cases the InMemoryShopRepository can be used
 */
export interface ShopRepositoryInterface<Shop = ShopInterface> {
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
	private shopClientId: string | null;
	private shopClientSecret: string | null;

	yes() {}

	constructor(shopId: string, shopUrl: string, shopSecret: string) {
		this.shopId = shopId;
		this.shopUrl = shopUrl;
		this.shopSecret = shopSecret;
		this.shopClientId = null;
		this.shopClientSecret = null;
	}

	getShopId(): string {
		return this.shopId;
	}
	getShopUrl(): string {
		return this.shopUrl;
	}
	getShopSecret(): string {
		return this.shopSecret;
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

	async createShop(id: string, secret: string, url: string) {
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
