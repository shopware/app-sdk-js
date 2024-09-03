import { describe, expect, test } from "bun:test";
import Criteria, { setDefaultValues } from "./criteria.js";

describe("Test Criteria class", () => {
	test("should default to page===1 & limit===0", () => {
		const criteria = new Criteria();

		expect(criteria.getLimit()).toBe(0);
		expect(criteria.getPage()).toBe(1);
	});

	test("should respect altered default values", () => {
		setDefaultValues({ limit: 42 });
		const criteria = new Criteria();

		expect(criteria.getLimit()).toBe(42);
		expect(criteria.getPage()).toBe(1);
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

	test("add group", () => {
		const criteria = new Criteria();

		criteria.addGroupField("foo");

		const obj = criteria.toPayload();

		expect(obj.groupFields).toEqual(["foo"]);
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
});
