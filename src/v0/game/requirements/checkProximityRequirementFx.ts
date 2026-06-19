import { Effect } from "effect";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

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

	const acceptedItemIds = new Set(itemIds);
	const matched = Object.values(save.board.items).some((item) => {
		if (item.id === target.id || !acceptedItemIds.has(item.itemId)) {
			return false;
		}

		const gridDistance = Math.max(Math.abs(item.x - target.x), Math.abs(item.y - target.y));
		return gridDistance <= distance;
	});

	if (!matched) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"missing_requirement",
				`Missing nearby requirement (${itemIds.join(" or ")}) within distance ${distance}.`,
			),
		);
	}
});
