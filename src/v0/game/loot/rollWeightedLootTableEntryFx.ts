import { Effect } from "effect";
import { RandomServiceFx } from "~/v0/random/context/RandomServiceFx";
import type { WeightedLootTableEntry } from "~/v0/game/loot/WeightedLootTableEntry";

export namespace rollWeightedLootTableEntryFx {
	export interface Props {
		entries: readonly WeightedLootTableEntry[];
	}
}

export const rollWeightedLootTableEntryFx = Effect.fn("rollWeightedLootTableEntryFx")(function* ({
	entries,
}: rollWeightedLootTableEntryFx.Props) {
	const random = yield* RandomServiceFx;
	const entry = random.weighted(entries);

	return entry ?? (entries[entries.length - 1] as WeightedLootTableEntry);
});
