import { Effect } from "effect";
import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import { assertResolvedInputRefIsNotBoardItemFx } from "~/activation/assertResolvedInputRefIsNotBoardItemFx";
import { assertResolvedInputRefQuantityFx } from "~/activation/assertResolvedInputRefQuantityFx";
import { resolveSingleInputRefFx } from "~/activation/resolveSingleInputRefFx";
import { resolveExecutableItemMergeRule } from "~/merge/resolveExecutableItemMergeRule";
import { readBoardItemMaxCountCapacityFx } from "~/board/logic/readBoardItemMaxCountCapacityFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameActionItemMergeSchema } from "~/action/GameActionItemMergeSchema";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace checkItemMergeReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionItemMergeSchema.Type;
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

	const source = yield* resolveSingleInputRefFx({
		inputRef: action.sourceRef,
		missingMessage: "Missing merge source.",
		save,
	});
	yield* assertResolvedInputRefIsNotBoardItemFx({
		inputRef: source,
		message: "Item cannot merge with itself.",
		targetItemInstanceId: target.id,
	});
	yield* assertResolvedInputRefQuantityFx({
		expectedQuantity: 1,
		inputRef: source,
		message: "Merge source quantity must be 1.",
	});

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
	if ("resultItemId" in merge) {
		if (!config.items[merge.resultItemId]) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(
					`Missing merge result "${merge.resultItemId}".`,
				),
			);
		}
		if (
			(yield* readBoardItemMaxCountCapacityFx({
				config,
				ignoredBoardItemInstanceIds: new Set([
					target.id,
				]),
				itemId: merge.resultItemId,
				save,
			})) <= 0
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"board:max-count",
					`Board already has the maximum allowed count for "${merge.resultItemId}".`,
				),
			);
		}
		const targetStateStatus = readBoardItemRuntimeStateStatus({
			itemInstanceId: target.id,
			save,
		});
		if (targetStateStatus.busy || targetStateStatus.preservable) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"item_busy",
					targetStateStatus.busy
						? "Merge target has a running job."
						: "Merge target has stored runtime state and cannot be replaced by merge.",
				),
			);
		}
	}

	return {
		merge,
		source,
		target,
	};
});
