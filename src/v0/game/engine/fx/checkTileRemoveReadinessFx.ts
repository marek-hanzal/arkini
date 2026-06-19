import { Effect } from "effect";
import { resolveInputRefsFx } from "~/v0/game/requirements/resolveInputRefsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionTileRemove } from "~/v0/game/engine/model/GameActionTileRemove";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkTileRemoveReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionTileRemove;
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
	if (Object.values(save.producerJobs).some((job) => job.producerItemInstanceId === target.id)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				"Tile has a running producer job and cannot be removed.",
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
