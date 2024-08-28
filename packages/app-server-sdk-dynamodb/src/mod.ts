import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DeleteCommand,
	DynamoDBDocumentClient,
	GetCommand,
	PutCommand,
} from "@aws-sdk/lib-dynamodb";
import {
	type ShopRepositoryInterface,
	SimpleShop,
} from "@shopware-ag/app-server-sdk";

export default class DynamoDBRepository
	implements ShopRepositoryInterface<SimpleShop>
{
	docClient: DynamoDBDocumentClient;
	tableName: string;

	constructor(client: DynamoDBClient, tableName: string) {
		this.tableName = tableName;
		this.docClient = DynamoDBDocumentClient.from(client);
	}

	async createShop(id: string, url: string, secret: string): Promise<void> {
		const cmd = new PutCommand({
			TableName: this.tableName,
			Item: {
				id: id,
				active: true,
				url: url,
				secret: secret,
				clientId: null,
				clientSecret: null,
			},
		});

		await this.docClient.send(cmd);
	}

	async getShopById(id: string): Promise<SimpleShop | null> {
		const cmd = new GetCommand({
			TableName: this.tableName,
			Key: {
				id: id,
			},
		});

		const response = await this.docClient.send(cmd);

		if (!response.Item) {
			return null;
		}

		const shop = new SimpleShop(
			response.Item.id,
			response.Item.url,
			response.Item.secret,
		);

		if (response.Item.clientId) {
			shop.setShopCredentials(
				response.Item.clientId,
				response.Item.clientSecret,
			);
		}

		return shop;
	}

	async updateShop(shop: SimpleShop): Promise<void> {
		const cmd = new PutCommand({
			TableName: this.tableName,
			Item: {
				id: shop.getShopId(),
				active: true,
				url: shop.getShopUrl(),
				secret: shop.getShopSecret(),
				clientId: shop.getShopClientId(),
				clientSecret: shop.getShopClientSecret(),
			},
		});

		await this.docClient.send(cmd);
	}

	async deleteShop(id: string): Promise<void> {
		const cmd = new DeleteCommand({
			TableName: this.tableName,
			Key: {
				id: id,
			},
		});

		await this.docClient.send(cmd);
	}
}
