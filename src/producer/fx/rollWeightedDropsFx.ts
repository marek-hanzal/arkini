import { Effect } from "effect";
import type { ItemId } from "~/manifest/manifestId";
import { repeatItem } from "~/producer/logic/repeatItem";
import type { ActivationWeightedEntry } from "~/manifest/producer";
import { pickWeightedDropFx } from "./pickWeightedDropFx";
import { resolveQuantityFx } from "./resolveQuantityFx";

export namespace rollWeightedDropsFx {
	export interface Props {
		entries: readonly ActivationWeightedEntry[];
		rolls: number;
	}
}

export const rollWeightedDropsFx = Effect.fn("rollWeightedDropsFx")(function* ({
	entries,
	rolls,
}: rollWeightedDropsFx.Props) {
	const drops: ItemId[] = [];

	for (let index = 0; index < rolls; index++) {
		const entry = yield* pickWeightedDropFx({
			entries,
		});
		if (!entry.itemId) continue;
		const quantity = yield* resolveQuantityFx({
			quantity: entry.quantity ?? 1,
		});
		drops.push(...repeatItem(entry.itemId, quantity));
	}

	return drops;
});
