import { describe, expect, test } from "bun:test";
import { Criteria, TotalCountMode } from "./criteria.js";

describe("Test Criteria class", () => {
	test("should default to page===1 & limit===0", () => {
		const criteria = new Criteria();

		expect(criteria.getLimit()).toBe(0);
		expect(criteria.getPage()).toBe(0);
	});

	test("should able to add a title", () => {
		const criteria = new Criteria();

		expect(criteria.getTitle()).toBe(null);
		criteria.setTitle("foo");
		expect(criteria.getTitle()).toBe("foo");
	});

	test("add assosication", () => {
		const criteria = new Criteria();

		criteria.addAssociation("foo");

		const obj = criteria.toPayload();

		expect(obj.associations).toEqual({ foo: {} });
	});

	test("add nested assosication", () => {
		const criteria = new Criteria();

		criteria.addAssociation("foo.bar");

		const obj = criteria.toPayload();

		expect(obj.associations).toEqual({ foo: { associations: { bar: {} } } });
	});

	test("get association", () => {
		const criteria = new Criteria();

		const inner = criteria.getAssociation("foo");

		expect(criteria.hasAssociation("foo")).toBe(true);

		inner.setLimit(10);

		const obj = criteria.toPayload();

		expect(obj.associations).toEqual({ foo: { limit: 10 } });
	});

	test("add filter", () => {
		const criteria = new Criteria();

		criteria.addFilter(Criteria.equals("foo", "bar"));

		const obj = criteria.toPayload();

		expect(obj.filter).toEqual([
			{ type: "equals", field: "foo", value: "bar" },
		]);

		expect(Criteria.avg("foo", "field")).toEqual({
			name: "foo",
			type: "avg",
			field: "field",
		});
		expect(Criteria.count("foo", "field")).toEqual({
			name: "foo",
			type: "count",
			field: "field",
		});
		expect(Criteria.equals("foo", "field")).toEqual({
			value: "field",
			type: "equals",
			field: "foo",
		});
		expect(Criteria.range("foo", { lt: "1" })).toEqual({
			type: "range",
			field: "foo",
			parameters: { lt: "1" },
		});
		expect(Criteria.range("foo", { gt: "1" })).toEqual({
			type: "range",
			field: "foo",
			parameters: { gt: "1" },
		});
		expect(Criteria.range("foo", { lte: "1" })).toEqual({
			type: "range",
			field: "foo",
			parameters: { lte: "1" },
		});
		expect(Criteria.range("foo", { gte: "1" })).toEqual({
			type: "range",
			field: "foo",
			parameters: { gte: "1" },
		});

		expect(Criteria.max("foo", "field")).toEqual({
			name: "foo",
			type: "max",
			field: "field",
		});
		expect(Criteria.min("foo", "field")).toEqual({
			name: "foo",
			type: "min",
			field: "field",
		});
	});

	test("add sort", () => {
		const criteria = new Criteria();

		criteria.addSorting(Criteria.sort("foo", "ASC"));

		const obj = criteria.toPayload();

		expect(obj.sort).toEqual([
			{ field: "foo", naturalSorting: false, order: "ASC" },
		]);

		criteria.resetSorting();

		expect(criteria.toPayload().sort).toBeUndefined();
	});

	test("add includes", () => {
		const criteria = new Criteria();

		criteria.addIncludes({ foo: ["blaa"] });

		const obj = criteria.toPayload();

		expect(obj.includes).toEqual({ foo: ["blaa"] });
	});

	test("add ids", () => {
		const criteria = new Criteria();

		criteria.setIds(["foo"]);

		const obj = criteria.toPayload();

		expect(obj.ids).toEqual(["foo"]);
	});

	test("set count mode", () => {
		const criteria = new Criteria();

		criteria.setTotalCountMode(TotalCountMode.NO_TOTAL_COUNT);

		const obj = criteria.toPayload();

		expect(obj["total-count-mode"]).toBe(TotalCountMode.NO_TOTAL_COUNT);
	});

	test("set page, limit", () => {
		const criteria = new Criteria();

		criteria.setPage(1);
		criteria.setLimit(10);

		const obj = criteria.toPayload();

		expect(obj.page).toBe(1);
		expect(obj.limit).toBe(10);
	});

	test("set term", () => {
		const criteria = new Criteria();

		criteria.setTerm("foo");

		const obj = criteria.toPayload();

		expect(obj.term).toBe("foo");
	});

	test("add post filter", () => {
		const criteria = new Criteria();

		criteria.addPostFilter(Criteria.equals("foo", "bar"));

		const obj = criteria.toPayload();

		expect(obj["post-filter"]).toEqual([
			{ type: "equals", field: "foo", value: "bar" },
		]);
	});

	test("add query", () => {
		const criteria = new Criteria();

		criteria.addQuery(Criteria.equals("foo", "bar"), 100);

		const obj = criteria.toPayload();

		expect(obj.query).toEqual([
			{ score: 100, query: { type: "equals", field: "foo", value: "bar" } },
		]);
	});

	test("add query with score field", () => {
		const criteria = new Criteria();

		criteria.addQuery(Criteria.equals("foo", "bar"), 100, "test");

		const obj = criteria.toPayload();

		expect(obj.query).toEqual([
			{
				score: 100,
				query: { type: "equals", field: "foo", value: "bar" },
				scoreField: "test",
			},
		]);
	});

	test("add grouping field", () => {
		const criteria = new Criteria();

		criteria.addGrouping("foo");

		const obj = criteria.toPayload();

		expect(obj.grouping).toEqual(["foo"]);
	});

	test("add fields", () => {
		const criteria = new Criteria();

		criteria.addFields("foo");

		const obj = criteria.toPayload();

		expect(obj.fields).toEqual(["foo"]);
	});

	test("add aggregations", () => {
		const criteria = new Criteria();

		criteria.addAggregation(Criteria.avg("foo", "bar"));

		const obj = criteria.toPayload();

		expect(obj.aggregations).toEqual([
			{ name: "foo", type: "avg", field: "bar" },
		]);
	});

	test("aggregations", () => {
		expect(Criteria.stats("test", "test")).toEqual({
			name: "test",
			type: "stats",
			field: "test",
		});
		expect(Criteria.avg("test", "test")).toEqual({
			name: "test",
			type: "avg",
			field: "test",
		});
		expect(Criteria.max("test", "test")).toEqual({
			name: "test",
			type: "max",
			field: "test",
		});
		expect(Criteria.min("test", "test")).toEqual({
			name: "test",
			type: "min",
			field: "test",
		});
		expect(Criteria.count("test", "test")).toEqual({
			name: "test",
			type: "count",
			field: "test",
		});
		expect(Criteria.sum("test", "test")).toEqual({
			name: "test",
			type: "sum",
			field: "test",
		});
		expect(Criteria.terms("test", "test")).toEqual({
			name: "test",
			type: "terms",
			field: "test",
			limit: null,
			sort: null,
			aggregation: null,
		});
		expect(Criteria.entityAggregation("test", "test", "product")).toEqual({
			name: "test",
			type: "entity",
			field: "test",
			definition: "product",
		});
		expect(
			Criteria.filter(
				"test",
				[Criteria.equals("test", "test")],
				Criteria.sum("test", "test"),
			),
		).toEqual({
			name: "test",
			type: "filter",
			filter: [{ type: "equals", field: "test", value: "test" }],
			aggregation: { name: "test", type: "sum", field: "test" },
		});
		expect(Criteria.histogram("test", "test")).toEqual({
			name: "test",
			type: "histogram",
			field: "test",
			aggregation: null,
			format: null,
			interval: null,
			timeZone: null,
		});
	});

	test("filters", () => {
		expect(Criteria.contains("test", "test")).toEqual({
			type: "contains",
			field: "test",
			value: "test",
		});
		expect(Criteria.equals("test", "test")).toEqual({
			type: "equals",
			field: "test",
			value: "test",
		});
		expect(Criteria.equalsAny("test", ["test"])).toEqual({
			type: "equalsAny",
			field: "test",
			value: ["test"],
		});
		expect(Criteria.prefix("test", "test")).toEqual({
			type: "prefix",
			field: "test",
			value: "test",
		});
		expect(Criteria.range("test", { gt: "test" })).toEqual({
			type: "range",
			field: "test",
			parameters: { gt: "test" },
		});
		expect(Criteria.suffix("test", "test")).toEqual({
			type: "suffix",
			field: "test",
			value: "test",
		});
		expect(Criteria.not("and", [Criteria.equals("test", "test")])).toEqual({
			type: "not",
			operator: "and",
			queries: [{ type: "equals", field: "test", value: "test" }],
		});
		expect(Criteria.multi("and", [Criteria.equals("test", "test")])).toEqual({
			type: "multi",
			operator: "and",
			queries: [{ type: "equals", field: "test", value: "test" }],
		});
	});

	test("get criteria gives same instance", () => {
		const criteria = new Criteria();

		const inner = criteria.getAssociation("foo");

		expect(inner).toBe(criteria.getAssociation("foo"));
	});

	test("natural sorting", () => {
		const criteria = new Criteria();

		criteria.addSorting(Criteria.naturalSorting("foo", "ASC"));

		const obj = criteria.toPayload();

		expect(obj.sort).toEqual([
			{ field: "foo", naturalSorting: true, order: "ASC" },
		]);
	});

	test("count sorting", () => {
		const criteria = new Criteria();

		criteria.addSorting(Criteria.countSorting("foo", "ASC"));

		const obj = criteria.toPayload();

		expect(obj.sort).toEqual([
			{ field: "foo", naturalSorting: false, order: "ASC", type: "count" },
		]);
	});
});
