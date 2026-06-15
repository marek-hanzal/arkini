import { Effect } from "effect";
import type { ActivationWeightedEntry } from "~/manifest/producer";
import { GameActionError } from "~/command/GameActionError";
import { RandomServiceFx } from "~/random/context/RandomServiceFx";

export namespace pickWeightedDropFx {
	export interface Props {
		entries: readonly ActivationWeightedEntry[];
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
