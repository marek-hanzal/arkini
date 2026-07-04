import { Effect } from "effect";
import { resolveInputRefsFx } from "~/activation/resolveInputRefsFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameActionTileRemoveSchema } from "~/action/GameActionTileRemoveSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace checkTileRemoveReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionTileRemoveSchema.Type;
	}
}

export const checkTileRemoveReadinessFx = Effect.fn("checkTileRemoveReadinessFx")(function* ({
	config,
	save,
	action,
}: checkTileRemoveReadinessFx.Props) {
	const target = save.board.items[action.targetItemInstanceId];
	if (!target) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Missing removable board tile "${action.targetItemInstanceId}".`,
			),
		);
	}

	const [tool] = yield* resolveInputRefsFx({
		inputRefs: [
			action.toolRef,
		],
		save,
	});
	if (!tool) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("input_unavailable", "Missing removal tool."),
		);
	}
	if (tool.kind === "board" && tool.itemInstanceId === target.id) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_actor", "Tile cannot remove itself."),
		);
	}
	if (tool.quantity !== 1) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_mismatch",
				"Tile removal tool quantity must be 1.",
			),
		);
	}
	if (Object.values(save.producerJobs).some((job) => job.itemInstanceId === target.id)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				"Tile has a running producer job and cannot be removed.",
			),
		);
	}
	if (Object.values(save.craftJobs).some((job) => job.targetItemInstanceId === target.id)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				"Tile has a running craft job and cannot be removed.",
			),
		);
	}

	const targetDefinition = config.items[target.itemId];
	const removal = targetDefinition?.removeBy?.find((entry) => entry.itemId === tool.itemId);
	if (!targetDefinition || !removal) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				`Item "${target.itemId}" cannot be removed by "${tool.itemId}".`,
			),
		);
	}

	return {
		removal,
		target,
		tool,
	};
});
