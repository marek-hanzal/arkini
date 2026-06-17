import { Effect } from "effect";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameRequirement } from "~/v0/game/engine/model/GameRequirement";

export namespace findStoredRequirementSlotFx {
	export interface Props {
		itemId: string;
		storedRequirements: readonly Extract<GameRequirement, { type: "stored" }>[];
	}
}

export const findStoredRequirementSlotFx = Effect.fn("findStoredRequirementSlotFx")(
	function* ({ itemId, storedRequirements }: findStoredRequirementSlotFx.Props) {
		const matching = storedRequirements.filter((requirement) => requirement.itemId === itemId);
		if (matching.length === 0) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"input_mismatch",
					`Item "${itemId}" is not accepted by this stored requirement target.`,
				),
			);
		}

		return {
			itemId,
			quantity: Math.max(...matching.map((requirement) => requirement.quantity)),
			capacity: Math.max(...matching.map((requirement) => requirement.capacity)),
			type: "stored" as const,
		};
	},
);
