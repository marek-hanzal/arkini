import { Effect } from "effect";
import { GameActionError } from "~/command/GameActionError";
import type { ActivationWeightedEntry } from "~/manifest/producer";
import { RandomServiceFx } from "~/random/context/RandomServiceFx";

export namespace pickWeightedActivationDropFx {
	export interface Props {
		entries: readonly ActivationWeightedEntry[];
	}
}

export const pickWeightedActivationDropFx = Effect.fn("pickWeightedActivationDropFx")(function* ({
	entries,
}: pickWeightedActivationDropFx.Props) {
	const random = yield* RandomServiceFx;
	const picked = random.weighted(entries);

	if (!picked)
		return yield* Effect.fail(new GameActionError("Activation has no weighted entries."));
	return picked;
});
