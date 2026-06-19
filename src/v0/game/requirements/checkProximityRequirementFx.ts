import { Effect } from "effect";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readProximityRequirementMatch } from "~/v0/game/requirements/readProximityRequirementMatch";

export namespace checkProximityRequirementFx {
	export interface Props {
		distance: number;
		itemIds: readonly string[];
		save: GameSave;
		targetItemInstanceId?: string;
	}
}

export const checkProximityRequirementFx = Effect.fn("checkProximityRequirementFx")(function* ({
	distance,
	itemIds,
	save,
	targetItemInstanceId,
}: checkProximityRequirementFx.Props) {
	if (!targetItemInstanceId) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_requirement",
				"Proximity requirement needs a board target item.",
			),
		);
	}

	const target = save.board.items[targetItemInstanceId];
	if (!target) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_requirement",
				`Proximity requirement target "${targetItemInstanceId}" is not on the board.`,
			),
		);
	}

	const match = readProximityRequirementMatch({
		itemIds,
		save,
		targetItemInstanceId,
	});

	if (!match || match.distance > distance) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"missing_requirement",
				`Missing nearby requirement (${itemIds.join(" or ")}) within distance ${distance}.`,
			),
		);
	}

	return match;
});
