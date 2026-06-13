import { Effect } from "effect";
import type { ProducerWeightedEntry } from "~/manifest/data/producer";
import { GameActionError } from "~/play/logic/playTypes";
import { RandomServiceFx } from "~/random/context/RandomServiceFx";

export namespace pickWeightedDropFx {
	export interface Props {
		entries: readonly ProducerWeightedEntry[];
	}
}

export const pickWeightedDropFx = Effect.fn("pickWeightedDropFx")(function* ({
	entries,
}: pickWeightedDropFx.Props) {
	const random = yield* RandomServiceFx;
	const picked = random.weighted(entries);

	if (!picked)
		return yield* Effect.fail(new GameActionError("Producer has no weighted entries."));
	return picked;
});
