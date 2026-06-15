import { Effect } from "effect";
import { repeatActivationItem } from "~/activation/logic/repeatActivationItem";
import type { ItemId } from "~/manifest/manifestId";
import type { ActivationWeightedEntry } from "~/manifest/producer";
import { pickWeightedActivationDropFx } from "./pickWeightedActivationDropFx";
import { resolveActivationQuantityFx } from "./resolveActivationQuantityFx";

export namespace rollWeightedActivationDropsFx {
	export interface Props {
		entries: readonly ActivationWeightedEntry[];
		rolls: number;
	}
}

export const rollWeightedActivationDropsFx = Effect.fn("rollWeightedActivationDropsFx")(function* ({
	entries,
	rolls,
}: rollWeightedActivationDropsFx.Props) {
	const drops: ItemId[] = [];

	for (let index = 0; index < rolls; index++) {
		const entry = yield* pickWeightedActivationDropFx({
			entries,
		});
		if (!entry.itemId) continue;
		const quantity = yield* resolveActivationQuantityFx({
			quantity: entry.quantity ?? 1,
		});
		drops.push(...repeatActivationItem(entry.itemId, quantity));
	}

	return drops;
});
