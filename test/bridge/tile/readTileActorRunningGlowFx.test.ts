import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readTileActorRunningGlowFx } from "~/bridge/tile/readTileActorRunningGlowFx";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

const readGlow = (itemType: ItemEnumSchema.Type, running: boolean) =>
	Effect.runSync(
		readTileActorRunningGlowFx({
			itemType,
			running,
		}),
	);

describe("tile actor running glow projection", () => {
	it.each([
		ItemEnumSchema.enum.Blueprint,
		ItemEnumSchema.enum.Craft,
		ItemEnumSchema.enum.Producer,
	])("enables running feedback for %s", (itemType) => {
		expect(readGlow(itemType, true)).toBe(true);
		expect(readGlow(itemType, false)).toBe(false);
	});

	it.each([
		ItemEnumSchema.enum.Deposit,
		ItemEnumSchema.enum.Inventory,
		ItemEnumSchema.enum.Simple,
		ItemEnumSchema.enum.Stash,
		ItemEnumSchema.enum.Temporary,
	])("keeps unrelated feedback off for %s", (itemType) => {
		expect(readGlow(itemType, true)).toBe(false);
		expect(readGlow(itemType, false)).toBe(false);
	});
});
