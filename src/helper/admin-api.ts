import type { HttpClient } from "../http-client.js";
import type { Criteria } from "./criteria.js";
import type { SingleFilter } from "./criteria.js";

export class ApiContext {
	private languageId: string | null;
	inheritance: boolean | null;
	versionId: string | null;
	skipTriggerFlows: boolean | null;
	indexingSkip: string | null;
	indexingBehaviour: string | null;

	constructor(
		languageId: string | null = null,
		inheritance: boolean | null = null,
		versionId: string | null = null,
		skipTriggerFlows: boolean | null = null,
		indexingSkip: string | null = null,
		indexingBehaviour: string | null = null,
	) {
		this.languageId = languageId;
		this.inheritance = inheritance;
		this.versionId = versionId;
		this.skipTriggerFlows = skipTriggerFlows;
		this.indexingSkip = indexingSkip;
		this.indexingBehaviour = indexingBehaviour;
	}

	toHeaders(): Record<string, string> {
		const headers = {
			"sw-language-id": this.languageId,
			"sw-inheritance": this.inheritance === true ? "1" : "0",
			"sw-version-id": this.versionId,
			"sw-skip-trigger-flow": this.skipTriggerFlows === true ? "1" : "0",
			"indexing-skip": this.indexingSkip,
			"indexing-behavior": this.indexingBehaviour,
		};

		for (const key of Object.keys(headers)) {
			// @ts-expect-error
			if (headers[key] === null) {
				// @ts-expect-error
				delete headers[key];
			}
		}

		// @ts-expect-error
		return headers;
	}
}

export class EntityRepository<Entity extends object = object> {
	constructor(
		private client: HttpClient,
		private entityName: string,
	) {
		this.client = client;
		this.entityName = entityName;
	}

	async search<Aggregations = object>(
		criteria: Criteria,
		context: ApiContext = new ApiContext(),
	): Promise<EntitySearchResult<Entity, Aggregations>> {
		const response = await this.client.post<
			EntitySearchResponse<Entity, Aggregations>
		>(
			`/search/${this.entityName.replaceAll("_", "-")}`,
			criteria.toPayload(),
			context.toHeaders(),
		);

		return new EntitySearchResult<Entity, Aggregations>(
			response.body.total,
			response.body.aggregations,
			response.body.data,
		);
	}

	async searchIds(
		criteria: Criteria,
		context: ApiContext = new ApiContext(),
	): Promise<string[]> {
		const response = await this.client.post<{ data: string[] }>(
			`/search-ids/${this.entityName.replaceAll("_", "-")}`,
			criteria.toPayload(),
			context.toHeaders(),
		);

		return response.body.data;
	}

	async aggregate<Aggregations>(
		criteria: Criteria,
		context: ApiContext = new ApiContext(),
	): Promise<EntitySearchResult<object, Aggregations>> {
		criteria.setLimit(1);

		const response = await this.client.post<
			EntitySearchResponse<object, Aggregations>
		>(
			`/search/${this.entityName.replaceAll("_", "-")}`,
			criteria.toPayload(),
			context.toHeaders(),
		);

		return new EntitySearchResult<object, Aggregations>(
			response.body.total,
			response.body.aggregations,
			response.body.data,
		);
	}

	async upsert(
		payload: Entity[],
		context: ApiContext = new ApiContext(),
	): Promise<void> {
		await new SyncService(this.client).sync(
			[
				new SyncOperation(
					"upsert",
					this.entityName.replaceAll("-", "_"),
					"upsert",
					payload,
				),
			],
			context,
		);
	}

	async delete<DeleteType extends object = { id: string }>(
		payload: DeleteType[],
		context: ApiContext = new ApiContext(),
	): Promise<void> {
		await new SyncService(this.client).sync(
			[
				new SyncOperation(
					"delete",
					this.entityName.replaceAll("-", "_"),
					"delete",
					payload,
				),
			],
			context,
		);
	}

	async deleteByFilters(
		filters: SingleFilter[],
		context: ApiContext = new ApiContext(),
	): Promise<void> {
		await new SyncService(this.client).sync(
			[
				new SyncOperation(
					"delete",
					this.entityName.replaceAll("-", "_"),
					"delete",
					[],
					filters,
				),
			],
			context,
		);
	}
}

export class SyncService {
	constructor(private client: HttpClient) {}

	async sync(
		operations: SyncOperation[],
		context: ApiContext = new ApiContext(),
	): Promise<void> {
		await this.client.post<{ notFound: string[]; deleted: string[] }>(
			"/_action/sync",
			operations,
			context.toHeaders(),
		);
	}
}

export class SyncOperation {
	constructor(
		public key: string,
		public entity: string,
		public action: "upsert" | "delete",
		public payload: object[],
		public criteria: SingleFilter[] | null = null,
	) {}
}

type EntitySearchResponse<Entity = unknown, Aggregations = object> = {
	total: number;
	aggregations: Aggregations;
	data: Entity[];
};

export class EntitySearchResult<Entity = unknown, Aggregations = object> {
	constructor(
		public total: number,
		public aggregations: Aggregations,
		public data: Entity[],
	) {
		this.total = total;
		this.aggregations = aggregations;
		this.data = data;
	}

	first(): Entity | null {
		return this.data[0] || null;
	}
}

export const Defaults = {
	systemLanguageId: "2fbb5fe2e29a4d70aa5854ce7ce3e20b",
	liveVersion: "0fa91ce3e96a4bc2be4bd9ce752c3425",
	systemCurrencyId: "b7d2554b0ce847cd82f3ac9bd1c0dfca",
	salesChannelTypeApi: "f183ee5650cf4bdb8a774337575067a6",
	salesChannelTypeSalesChannel: "8a243080f92e4c719546314b577cf82b",
	salesChannelTypeProductComparision: "ed535e5722134ac1aa6524f73e26881b",
};

export function uuid(): string {
	return crypto.randomUUID().replaceAll("-", "");
}
