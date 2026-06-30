import { Effect } from "effect";
import type { GameActivationInput } from "~/v0/game/activation/GameActivationInput";
import type { GameActivationInputDemand } from "~/v0/game/activation/GameActivationInputDemand";

type GameActivationInputDemandIndex = Readonly<
	Record<string, GameActivationInputDemand | undefined>
>;

export namespace mergeActivationInputDemandsFx {
	export interface Props {
		inputs: readonly GameActivationInput[];
	}
}

export const mergeActivationInputDemandsFx = Effect.fn("mergeActivationInputDemandsFx")(function* ({
	inputs,
}: mergeActivationInputDemandsFx.Props) {
	const demands: Record<string, GameActivationInputDemand> = {};
	for (const input of inputs) {
		const previous = demands[input.itemId];
		demands[input.itemId] = {
			consume: (previous?.consume ?? false) || input.consume,
			mode: previous?.mode ?? input.mode,
			quantity: (previous?.quantity ?? 0) + input.quantity,
		};
	}
	return demands satisfies GameActivationInputDemandIndex;
});
