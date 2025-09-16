export enum TotalCountMode {
	/* No total count will be selected. Should be used if no pagination required (fastest) */
	NO_TOTAL_COUNT = 0,
	/* Exact total count will be selected. Should be used if an exact pagination is required (slow) */
	EXACT_TOTAL_COUNT = 1,
	/* Fetches limit * 5 + 1. Should be used if pagination can work with "next page exists" (fast) */
	PAGINATION_TOTAL_COUNT = 2,
}

interface Filters {
	contains: {
		type: "contains";
		field: string;
		value: string;
	};
	prefix: {
		type: "prefix";
		field: string;
		value: string;
	};
	suffix: {
		type: "suffix";
		field: string;
		value: string;
	};
	equalsAny: {
		type: "equalsAny";
		field: string;
		value: (string | number | boolean | null)[];
	};
	equals: {
		type: "equals";
		field: string;
		value: string | number | boolean | null;
	};
	range: {
		type: "range";
		field: string;
		parameters: {
			lte?: string | number;
			lt?: string | number;
			gte?: string | number;
			gt?: string | number;
		};
	};
	not: {
		type: "not";
		operator: "and" | "AND" | "or" | "OR";
		queries: SingleFilter[];
	};
	multi: {
		type: "multi";
		operator: "and" | "AND" | "or" | "OR";
		queries: SingleFilter[];
	};
}

interface Aggregations {
	histogram: {
		type: "histogram";
		name: string;
		field: string;
		interval: string | null;
		format: string | null;
		aggregation: Aggregation | null;
		timeZone: string | null;
	};
	terms: {
		type: "terms";
		name: string;
		field: string;
		limit?: number | null;
		sort?: Sorting | null;
		aggregation?: Aggregation | null;
	};
	sum: {
		type: "sum";
		name: string;
		field: string;
	};
	stats: {
		type: "stats";
		name: string;
		field: string;
	};
	min: {
		type: "min";
		name: string;
		field: string;
	};
	max: {
		type: "max";
		name: string;
		field: string;
	};
	count: {
		type: "count";
		name: string;
		field: string;
	};
	avg: {
		type: "avg";
		name: string;
		field: string;
	};
	entity: {
		type: "entity";
		name: string;
		field: string;
		definition: string;
	};
	filter: {
		type: "filter";
		name: string;
		filter: SingleFilter[];
		aggregation: Aggregation;
	};
}

type ValueOf<T> = T[keyof T];
export type SingleFilter = ValueOf<Filters>;
type Aggregation = ValueOf<Aggregations>;

interface Include {
	[entityName: string]: string[];
}
interface Association {
	association: string;
	criteria: Criteria;
}
interface Query {
	score: number;
	query: SingleFilter;
	scoreField?: string;
}
interface Sorting {
	field: string;
	order: "ASC" | "DESC";
	naturalSorting: boolean;
	type?: string;
}
export interface RequestParams {
	ids?: string[];
	page?: number;
	limit?: number;
	term?: string;
	query?: Query[];
	filter?: SingleFilter[];
	"post-filter"?: SingleFilter[];
	sort?: Sorting[];
	aggregations?: Aggregation[];
	grouping?: string[];
	fields?: string[];
	associations?: {
		[association: string]: RequestParams;
	};
	includes?: Include;
	"total-count-mode"?: TotalCountMode;
}

// Type utilities for enhanced type safety with nested paths
type DeepNonNullable<T> = T extends object
	? {
			[P in keyof T]: DeepNonNullable<NonNullable<T[P]>>;
		}
	: NonNullable<T>;

type MakeRequired<T, K extends keyof T> = Omit<T, K> & {
	[P in K]-?: DeepNonNullable<T[P]>;
};

// Type for handling nested paths
type NestedMakeRequired<
	T,
	Path extends string,
> = Path extends `${infer First}.${infer Rest}`
	? First extends keyof T
		? Omit<T, First> & {
				[K in First]-?: NestedMakeRequired<NonNullable<T[First]>, Rest>;
			}
		: T
	: Path extends keyof T
		? MakeRequired<T, Path>
		: T;

type PropertyType<T, K extends keyof T> = NonNullable<T[K]>;

// Get nested property type
type NestedPropertyType<
	T,
	Path extends string,
> = Path extends `${infer First}.${infer Rest}`
	? First extends keyof T
		? NestedPropertyType<NonNullable<T[First]>, Rest>
		: never
	: Path extends keyof T
		? NonNullable<T[Path]>
		: never;

export type Autoloadable<T> = T;

export class Criteria<T = object> {
	title: string | null;

	page: number | null;

	limit: number | null;

	term: string | null;

	filters: SingleFilter[];

	ids: string[];

	queries: Query[];

	associations: Association[];

	postFilter: SingleFilter[];

	sortings: Sorting[];

	aggregations: Aggregation[];

	grouping: string[];

	fields: string[];

	totalCountMode: TotalCountMode | null;

	includes: Include | null;

	constructor(ids: string[] = []) {
		this.page = null;
		this.limit = null;
		this.term = null;
		this.title = null;
		this.filters = [];
		this.includes = null;
		this.ids = ids;
		this.queries = [];
		this.associations = [];
		this.postFilter = [];
		this.sortings = [];
		this.aggregations = [];
		this.grouping = [];
		this.fields = [];
		this.totalCountMode = null;
	}

	/**
	 * Parses the current criteria and generates an object which can be provided to the api
	 */
	toPayload(): RequestParams {
		const params: RequestParams = {};

		if (this.ids.length > 0) {
			params.ids = this.ids;
		}
		if (this.page !== null) {
			params.page = this.page;
		}
		if (this.limit !== null) {
			params.limit = this.limit;
		}
		if (this.term !== null) {
			params.term = this.term;
		}
		if (this.queries.length > 0) {
			params.query = this.queries;
		}
		if (this.filters.length > 0) {
			params.filter = this.filters;
		}
		if (this.postFilter.length > 0) {
			params["post-filter"] = this.postFilter;
		}
		if (this.sortings.length > 0) {
			params.sort = this.sortings;
		}
		if (this.aggregations.length > 0) {
			params.aggregations = this.aggregations;
		}
		if (this.grouping.length > 0) {
			params.grouping = this.grouping;
		}
		if (this.fields.length > 0) {
			params.fields = this.fields;
		}
		if (this.associations.length > 0) {
			params.associations = {};

			for (const item of this.associations) {
				if (!params.associations) {
					continue;
				}
				params.associations[item.association] = item.criteria.toPayload();
			}
		}
		if (this.includes !== null) {
			params.includes = this.includes;
		}

		if (this.totalCountMode !== null) {
			params["total-count-mode"] = this.totalCountMode;
		}

		return params;
	}

	/**
	 * Allows to provide a title for the criteria. This title will be shown in the `repository.search` request url so it can be used for debugging in network's tab
	 */
	setTitle(title: string): this {
		this.title = title;
		return this;
	}

	getTitle(): string | null {
		return this.title;
	}
	/**
	 * Allows to provide a list of ids which are used as a filter
	 */
	setIds(ids: string[]): this {
		this.ids = ids;
		return this;
	}

	/**
	 * Allows to configure the total value of a search result.
	 * 0 - no total count will be selected. Should be used if no pagination required (fastest)
	 * 1 - exact total count will be selected. Should be used if an exact pagination is required (slow)
	 * 2 - fetches limit * 5 + 1. Should be used if pagination can work with "next page exists" (fast)
	 */
	setTotalCountMode(mode: TotalCountMode): this {
		if (typeof mode !== "number") {
			this.totalCountMode = null;
		}

		this.totalCountMode = mode < 0 || mode > 2 ? null : mode;
		return this;
	}

	setPage(page: number): this {
		this.page = page;
		return this;
	}

	setLimit(limit: number): this {
		this.limit = limit;
		return this;
	}

	setTerm(term: string): this {
		this.term = term;
		return this;
	}

	addFilter(filter: SingleFilter): this {
		this.filters.push(filter);

		return this;
	}

	addIncludes(include: Include): this {
		for (const [entityName, includeValues] of Object.entries(include)) {
			if (this.includes === null) {
				this.includes = {};
			}
			if (!this.includes[entityName]) {
				this.includes[entityName] = [];
			}

			this.includes[entityName].push(...includeValues);
		}

		return this;
	}

	/**
	 * Adds the provided filter as post filter.
	 * Post filter will be considered for the documents query but not for the aggregations.
	 */
	addPostFilter(filter: SingleFilter): this {
		this.postFilter.push(filter);
		return this;
	}

	/**
	 * Allows to add different sortings for the criteria, to sort the entity result.
	 */
	addSorting(sorting: Sorting): this {
		this.sortings.push(sorting);
		return this;
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Query\ScoreQuery.
	 * These queries are used to search for documents and score them with a ranking
	 */
	addQuery(
		filter: SingleFilter,
		score: number,
		scoreField: string | null = null,
	): this {
		const query: Query = { score: score, query: filter };

		if (scoreField) {
			query.scoreField = scoreField;
		}

		this.queries.push(query);

		return this;
	}

	/**
	 * Allows grouping the result by a specific field
	 */
	addGrouping(field: string): this {
		this.grouping.push(field);

		return this;
	}

	/**
	 * Allows loading partial fields for the result.
	 */
	addFields(...field: string[]): this {
		this.fields.push(...field);

		return this;
	}

	/**
	 * @param {Object} aggregation
	 */
	addAggregation(aggregation: Aggregation): this {
		this.aggregations.push(aggregation);
		return this;
	}

	/**
	 * Ensures that a criterion is created for each segment of the passed path.
	 * Existing Criteria objects are not overwritten.
	 * Returns the own instance
	 *
	 * When used with a type parameter T, provides type-safe access to ensure fields are
	 * defined when accessing results from a Repository search.
	 */
	// For direct field association
	addAssociation<K extends keyof T & string>(
		field: K,
	): Criteria<MakeRequired<T, K>>;

	// For nested path association
	addAssociation<P extends string & `${string}.${string}`>(
		path: P,
	): Criteria<NestedMakeRequired<T, P>>;

	// Implementation with traditional behavior
	addAssociation(path: string): this {
		this.getAssociation(path);
		return this;
	}

	/**
	 * Ensures that a criterion is created for each segment of the passed path.
	 * Returns the criteria instance of the last path segment
	 */
	// For direct field association
	getAssociation<K extends keyof T & string>(
		field: K,
	): Criteria<PropertyType<T, K>>;

	// For nested path association
	getAssociation<P extends string>(path: P): Criteria<T>;

	// Implementation with traditional behavior
	getAssociation(path: string): Criteria {
		const parts = path.split(".");

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let criteria = this;

		for (const part of parts) {
			if (!criteria.hasAssociation(part)) {
				criteria.associations.push({
					association: part,
					criteria: new Criteria(),
				});
			}

			// @ts-expect-error - another this instance
			criteria = criteria.getAssociationCriteria(part);
		}

		return criteria;
	}

	private getAssociationCriteria(part: string): Criteria {
		let criteria = null;

		for (const association of this.associations) {
			if (association.association === part) {
				criteria = association.criteria;
			}
		}

		if (!criteria) {
			criteria = new Criteria();
			this.associations.push({
				association: part,
				criteria,
			});
		}

		return criteria;
	}

	getLimit(): number {
		return this.limit ?? 0;
	}

	getPage(): number {
		return this.page ?? 0;
	}

	hasAssociation(property: string): boolean {
		return this.associations.some((assocation) => {
			return assocation.association === property;
		});
	}

	/**
	 * Resets the sorting parameter
	 */
	resetSorting(): void {
		this.sortings = [];
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Aggregation\Metric\AvgAggregation
	 * Allows to calculate the avg value for the provided field
	 */
	static avg(name: string, field: string): Aggregations["avg"] {
		return { type: "avg", name, field };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Aggregation\Metric\CountAggregation
	 * Allows to calculate the count value for the provided field
	 */
	static count(name: string, field: string): Aggregations["count"] {
		return { type: "count", name, field };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Aggregation\Metric\MaxAggregation
	 * Allows to calculate the max value for the provided field
	 */
	static max(name: string, field: string): Aggregations["max"] {
		return { type: "max", name, field };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Aggregation\Metric\MinAggregation
	 * Allows to calculate the min value for the provided field
	 */
	static min(name: string, field: string): Aggregations["min"] {
		return { type: "min", name, field };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Aggregation\Metric\StatsAggregation
	 * Allows to calculate the sum, max, min, avg, count values for the provided field
	 */
	static stats(name: string, field: string): Aggregations["stats"] {
		return { type: "stats", name, field };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Aggregation\Metric\SumAggregation
	 * Allows to calculate the sum value for the provided field
	 */
	static sum(name: string, field: string): Aggregations["sum"] {
		return { type: "sum", name, field };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Aggregation\Bucket\TermsAggregation
	 * Allows to fetch term buckets for the provided field
	 */
	static terms(
		name: string,
		field: string,
		limit: number | null = null,
		sort: Sorting | null = null,
		aggregation: Aggregation | null = null,
	): Aggregations["terms"] {
		return { type: "terms", name, field, limit, sort, aggregation };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Aggregation\Metric\EntityAggregation
	 * Allows to filter an aggregation result
	 */
	static entityAggregation(
		name: string,
		field: string,
		definition: string,
	): Aggregations["entity"] {
		return { type: "entity", name, field, definition };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Aggregation\Bucket\FilterAggregation
	 * Allows to filter an aggregation result
	 */
	static filter(
		name: string,
		filter: SingleFilter[],
		aggregation: Aggregation,
	): Aggregations["filter"] {
		return { type: "filter", name, filter, aggregation };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Aggregation\Bucket\DateHistogramAggregation
	 * Allows to fetch date buckets for the provided date interval
	 */
	static histogram(
		name: string,
		field: string,
		interval: string | null = null,
		format: string | null = null,
		aggregation: Aggregation | null = null,
		timeZone: string | null = null,
	): Aggregations["histogram"] {
		return {
			type: "histogram",
			name,
			field,
			interval,
			format,
			aggregation,
			timeZone,
		};
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Sorting\FieldSorting.
	 * Allows to sort the documents by the provided field
	 */
	static sort(
		field: string,
		order: Sorting["order"] = "ASC",
		naturalSorting = false,
	): Sorting {
		return { field, order, naturalSorting };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Sorting\FieldSorting.
	 * Allows to sort the documents by the provided field naturally
	 */
	static naturalSorting(
		field: string,
		order: Sorting["order"] = "ASC",
	): Sorting {
		return { field, order, naturalSorting: true };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Sorting\CountSorting.
	 * Allows to sort the documents by counting associations via the provided field
	 *
	 * Sql representation: `ORDER BY COUNT({field}) {order}`
	 */
	static countSorting(field: string, order: Sorting["order"] = "ASC"): Sorting {
		return { field, order, naturalSorting: false, type: "count" };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Filter\ContainsFilter.
	 * This allows to filter documents where the value are contained in the provided field.
	 *
	 * Sql representation: `{field} LIKE %{value}%`
	 */
	static contains(field: string, value: string): Filters["contains"] {
		return { type: "contains", field, value };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Filter\PrefixFilter.
	 * This allows to filter documents where the value marks the beginning of the provided field.
	 *
	 * Sql representation: `{field} LIKE {value}%`
	 */
	static prefix(field: string, value: string): Filters["prefix"] {
		return { type: "prefix", field, value };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Filter\SuffixFilter.
	 * This allows to filter documents where the value marks the end of the provided field.
	 *
	 * Sql representation: `{field} LIKE %{value}`
	 */
	static suffix(field: string, value: string): Filters["suffix"] {
		return { type: "suffix", field, value };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Filter\EqualsAnyFilter.
	 * This allows to filter documents where the field matches one of the provided values
	 *
	 * Sql representation: `{field} IN ({value}, {value})`
	 */
	static equalsAny(
		field: string,
		value: (string | number | boolean | null)[],
	): Filters["equalsAny"] {
		return { type: "equalsAny", field, value: value };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Filter\RangeFilter.
	 * This allows to filter documents where the field matches a defined range
	 *
	 * Sql representation: `{field} >= {value}`, `{field} <= {value}`, ...
	 */
	static range(
		field: string,
		range: Filters["range"]["parameters"],
	): Filters["range"] {
		return { type: "range", field, parameters: range };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Filter\EqualsFilter.
	 * This allows to filter documents where the field matches a defined range
	 *
	 * Sql representation: `{field} = {value}`
	 */
	static equals(
		field: string,
		value: string | number | boolean | null,
	): Filters["equals"] {
		return { type: "equals", field, value };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Filter\NotFilter.
	 * This allows to filter documents which not matches for the provided filters
	 * All above listed queries can be provided (equals, equalsAny, range, contains)
	 *
	 * Sql representation: `NOT({query} {operator} {query} {operator} {query})`
	 *
	 * @param {string} operator - and/or
	 * @param {array} queries
	 *
	 * @returns {Object}
	 */
	static not(
		operator: Filters["not"]["operator"],
		queries: SingleFilter[] = [],
	): Filters["not"] {
		return { type: "not", operator: operator, queries: queries };
	}

	/**
	 * @see \Shopware\Core\Framework\DataAbstractionLayer\Search\Filter\NotFilter.
	 * This allows to filter documents which matches for the provided filters
	 * All above listed queries can be provided (equals, equalsAny, range, contains)
	 *
	 * Sql representation: `({query} {operator} {query} {operator} {query})`
	 *
	 * @param {string} operator - and/or
	 * @param {array} queries
	 *
	 * @returns {Object}
	 */
	static multi(
		operator: Filters["multi"]["operator"],
		queries: SingleFilter[] = [],
	): Filters["multi"] {
		return { type: "multi", operator, queries };
	}
}
