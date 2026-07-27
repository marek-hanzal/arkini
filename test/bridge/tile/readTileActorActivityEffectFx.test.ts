import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readTileActorActivityEffectFx } from "~/bridge/tile/readTileActorActivityEffectFx";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

const readActivityEffect = (itemType: ItemEnumSchema.Type, running: boolean) =>
	Effect.runSync(
		readTileActorActivityEffectFx({
			itemType,
			running,
		}),
	);

describe("tile actor activity-effect projection", () => {
	it.each([
		ItemEnumSchema.enum.Blueprint,
		ItemEnumSchema.enum.Craft,
		ItemEnumSchema.enum.Producer,
	])("enables running feedback for %s", (itemType) => {
		expect(readActivityEffect(itemType, true)).toBe(true);
		expect(readActivityEffect(itemType, false)).toBe(false);
	});

	it.each([
		ItemEnumSchema.enum.Deposit,
		ItemEnumSchema.enum.Inventory,
		ItemEnumSchema.enum.Simple,
		ItemEnumSchema.enum.Stash,
		ItemEnumSchema.enum.Temporary,
	])("keeps unrelated feedback off for %s", (itemType) => {
		expect(readActivityEffect(itemType, true)).toBe(false);
		expect(readActivityEffect(itemType, false)).toBe(false);
	});
});
