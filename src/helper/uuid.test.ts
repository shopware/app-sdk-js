import { describe, expect, test } from "bun:test";

import { uuid as adminApiUuid } from "./admin-api.js";
import { uuid } from "./uuid.js";

describe("UUID entry point", () => {
	test("exports the existing admin API helper", () => {
		expect(uuid).toBe(adminApiUuid);
	});

	test("generates a UUID without hyphens", () => {
		expect(uuid()).toMatch(/^[0-9a-f]{12}4[0-9a-f]{3}[89ab][0-9a-f]{15}$/);
	});
});
