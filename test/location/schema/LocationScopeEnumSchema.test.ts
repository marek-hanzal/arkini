import { describe, expect, it } from "vitest";

import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

describe("LocationScopeEnumSchema", () => {
	it("owns only concrete runtime-item location scopes", () => {
		expect(LocationScopeEnumSchema.options).toEqual([
			LocationScopeEnumSchema.enum.Board,
			LocationScopeEnumSchema.enum.Inventory,
			LocationScopeEnumSchema.enum.Toolbar,
			LocationScopeEnumSchema.enum.Input,
			LocationScopeEnumSchema.enum.Job,
			LocationScopeEnumSchema.enum.Reserved,
		]);
		expect(LocationScopeEnumSchema.safeParse("any").success).toBe(false);
	});
});
