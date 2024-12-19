import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DeleteCommand,
	DynamoDBDocumentClient,
	GetCommand,
	PutCommand,
	UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { type ShopRepositoryInterface, SimpleShop } from "../repository.js";

export class DynamoDBRepository implements ShopRepositoryInterface<SimpleShop> {
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
				active: false,
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

		if (response.Item.active === undefined) {
			response.Item.active = true;
		}

		shop.setShopActive(response.Item.active);

		if (response.Item.clientId) {
			shop.setShopCredentials(
				response.Item.clientId,
				response.Item.clientSecret,
			);
		}

		return shop;
	}

	async updateShop(shop: SimpleShop): Promise<void> {
		const cmd = new UpdateCommand({
			TableName: this.tableName,
			Key: { id: shop.getShopId() },
			UpdateExpression:
				"SET active = :active, #u = :url, secret = :secret, clientId = :clientId, clientSecret = :clientSecret",
			ExpressionAttributeNames: {
				"#u": "url",
			},
			ExpressionAttributeValues: {
				":active": shop.getShopActive(),
				":url": shop.getShopUrl(),
				":secret": shop.getShopSecret(),
				":clientId": shop.getShopClientId(),
				":clientSecret": shop.getShopClientSecret(),
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
