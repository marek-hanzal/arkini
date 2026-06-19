import { Effect } from "effect";
import { resolveInputRefsFx } from "~/v0/game/requirements/resolveInputRefsFx";
import { resolveExecutableItemMergeRule } from "~/v0/game/engine/logic/resolveExecutableItemMergeRule";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionItemMerge } from "~/v0/game/action/GameActionItemMerge";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkItemMergeReadinessFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionItemMerge;
	}
}

export const checkItemMergeReadinessFx = Effect.fn("checkItemMergeReadinessFx")(function* ({
	config,
	save,
	action,
}: checkItemMergeReadinessFx.Props) {
	const target = save.board.items[action.targetItemInstanceId];
	if (!target) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"unsupported_target",
				`Merge target "${action.targetItemInstanceId}" must be a board tile.`,
			),
		);
	}

	const [source] = yield* resolveInputRefsFx({
		inputRefs: [
			action.sourceRef,
		],
		save,
	});
	if (!source) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("input_unavailable", "Missing merge source."),
		);
	}
	if (source.kind === "board" && source.itemInstanceId === target.id) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_merge", "Item cannot merge with itself."),
		);
	}
	if (source.quantity !== 1) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("input_mismatch", "Merge source quantity must be 1."),
		);
	}

	const sourceDefinition = config.items[source.itemId];
	const merge = resolveExecutableItemMergeRule({
		config,
		sourceItemId: source.itemId,
		targetItemId: target.itemId,
	})?.merge;
	if (!sourceDefinition || !merge) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_merge",
				`Item "${source.itemId}" cannot merge with "${target.itemId}".`,
			),
		);
	}
	if (!config.items[merge.resultItemId]) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(`Missing merge result "${merge.resultItemId}".`),
		);
	}
	if (Object.values(save.producerJobs).some((job) => job.producerItemInstanceId === target.id)) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				"Merge target has a running producer job.",
			),
		);
	}

	return {
		merge,
		source,
		target,
	};
});
