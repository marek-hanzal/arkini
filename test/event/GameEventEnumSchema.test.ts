import { describe, expect, it } from "vitest";

import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";

describe("GameEventEnumSchema", () => {
	it("owns the complete committed event vocabulary", () => {
		expect(GameEventEnumSchema.options).toEqual([
			GameEventEnumSchema.enum.CurrentSpaceChanged,
			GameEventEnumSchema.enum.JobStarted,
			GameEventEnumSchema.enum.JobCompleted,
			GameEventEnumSchema.enum.ItemMerged,
			GameEventEnumSchema.enum.ItemExpired,
			GameEventEnumSchema.enum.ItemSpawned,
			GameEventEnumSchema.enum.ItemPlaced,
			GameEventEnumSchema.enum.ItemStacked,
			GameEventEnumSchema.enum.ItemSplit,
			GameEventEnumSchema.enum.ItemConsumed,
			GameEventEnumSchema.enum.ItemDepleted,
		]);
	});

	it("extracts variants by stable member names", () => {
		expect(GameEventEnumSchema.extract(["ItemSpawned"]).options).toEqual([
			GameEventEnumSchema.enum.ItemSpawned,
		]);
	});

	it("rejects values outside the owned vocabulary", () => {
		expect(GameEventEnumSchema.safeParse("item:changed").success).toBe(false);
	});
});
