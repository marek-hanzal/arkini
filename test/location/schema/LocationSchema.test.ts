import { describe, expect, it } from "vitest";

import { LocationSchema } from "~/engine/location/schema/LocationSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

describe("LocationSchema", () => {
	it("accepts concrete grid, line-input, consumed-job, and reserved locations", () => {
		expect(
			LocationSchema.safeParse({
				scope: LocationScopeEnumSchema.enum.Board,
				space: 0,
				position: {
					x: 2,
					y: 3,
				},
			}).success,
		).toBe(true);
		expect(
			LocationSchema.safeParse({
				scope: LocationScopeEnumSchema.enum.Input,
				ownerItemId: "runtime:owner",
				lineId: "line:owner:work",
				inputIndex: 0,
			}).success,
		).toBe(true);
		expect(
			LocationSchema.safeParse({
				scope: LocationScopeEnumSchema.enum.Job,
				jobId: "job:owner:work",
			}).success,
		).toBe(true);
		expect(
			LocationSchema.safeParse({
				scope: LocationScopeEnumSchema.enum.Reserved,
				jobId: "job:owner:work",
			}).success,
		).toBe(true);
	});

	it("requires the canonical delivery travel countdown", () => {
		expect(
			LocationSchema.safeParse({
				scope: LocationScopeEnumSchema.enum.Delivery,
				phase: "outbound",
				generation: 0,
				origin: {
					scope: LocationScopeEnumSchema.enum.Board,
					space: 0,
					position: {
						x: 1,
						y: 0,
					},
				},
				target: {
					kind: "line-input",
					ownerItemId: "runtime:owner",
					lineId: "line:owner:work",
					input: [
						{
							inputIndex: 0,
							quantity: 1,
						},
					],
				},
			}).success,
		).toBe(false);
	});

	it("rejects abstract or incomplete locations", () => {
		expect(
			LocationSchema.safeParse({
				scope: LocationScopeEnumSchema.enum.Board,
				position: {
					x: 2,
					y: 3,
				},
			}).success,
		).toBe(false);
		expect(
			LocationSchema.safeParse({
				scope: "any",
				position: {
					x: 2,
					y: 3,
				},
			}).success,
		).toBe(false);
		expect(
			LocationSchema.safeParse({
				scope: LocationScopeEnumSchema.enum.Input,
				ownerItemId: "runtime:owner",
				lineId: "line:owner:work",
			}).success,
		).toBe(false);
		expect(
			LocationSchema.safeParse({
				scope: LocationScopeEnumSchema.enum.Input,
				ownerItemId: "runtime:owner",
				lineId: "line:owner:work",
				inputIndex: 0,
				returnLocation: {
					scope: LocationScopeEnumSchema.enum.Board,
					space: 0,
					position: {
						x: 1,
						y: 1,
					},
				},
			}).success,
		).toBe(false);
		expect(
			LocationSchema.safeParse({
				scope: LocationScopeEnumSchema.enum.Job,
				jobId: "job:owner:work",
				mode: "reserve",
			}).success,
		).toBe(false);
	});
});
