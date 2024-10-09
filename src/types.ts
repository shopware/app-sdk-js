export type BrowserAppModuleRequest = {
	"shop-id": string;
	"shop-url": string;
	timestamp: string;
	"sw-version": string;
	"sw-context-language": string;
	"sw-user-language": string;
};

export type Source = {
	url: string;
	shopId: string;
	appVersion: string;
};

export type Meta = {
	timestamp: number;
	reference: string;
	language: string;
};

export type ActionButtonRequest = {
	source: Source;
	data: {
		ids: string[];
		entity: string;
		action: string;
	};
	meta: Meta;
};

export type EntityWrittenRequest<PrimaryKey = string> = {
	data: {
		event: string;
		payload: {
			entity: string;
			operation: string;
			primaryKey: PrimaryKey;
			updatedFields: string[];
			versionId: string;
		}[];
	};
};
