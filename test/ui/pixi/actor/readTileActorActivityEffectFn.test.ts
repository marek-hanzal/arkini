import { describe, expect, it } from "vitest";

import { readTileActorActivityEffectFn } from "~/ui/pixi/actor/fn/readTileActorActivityEffectFn";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";

const readActivityEffect = (itemType: TypeSchema.Type, running: boolean) =>
	readTileActorActivityEffectFn({
		itemType,
		running,
	});

describe("tile actor activity-effect projection", () => {
	it.each([
		TypeSchema.enum.Blueprint,
		TypeSchema.enum.Craft,
		TypeSchema.enum.Deposit,
		TypeSchema.enum.Producer,
	])("enables running feedback for %s", (itemType) => {
		expect(readActivityEffect(itemType, true)).toBe(true);
		expect(readActivityEffect(itemType, false)).toBe(false);
	});

	it.each([
		TypeSchema.enum.Inventory,
		TypeSchema.enum.Simple,
		TypeSchema.enum.Stash,
		TypeSchema.enum.Temporary,
	])("keeps unrelated feedback off for %s", (itemType) => {
		expect(readActivityEffect(itemType, true)).toBe(false);
		expect(readActivityEffect(itemType, false)).toBe(false);
	});
});
