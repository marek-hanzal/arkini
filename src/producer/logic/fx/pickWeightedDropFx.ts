import { Effect } from "effect";
import type { ProducerWeightedEntry } from "~/manifest/data/producer";
import { GameActionError } from "~/play/logic/playTypes";

export namespace pickWeightedDropFx {
	export interface Props {
		entries: readonly ProducerWeightedEntry[];
	}
}

export const pickWeightedDropFx = Effect.fn("pickWeightedDropFx")(function* ({
	entries,
}: pickWeightedDropFx.Props) {
	const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
	let roll = Math.random() * total;

	for (const entry of entries) {
		roll -= entry.weight;
		if (roll <= 0) return entry;
	}

	const fallback = entries.at(-1);
	if (!fallback)
		return yield* Effect.fail(new GameActionError("Producer has no weighted entries."));
	return fallback;
});
