import { Effect } from "effect";
import { assertResolvedInputRefIsNotBoardItemFx } from "~/activation/assertResolvedInputRefIsNotBoardItemFx";
import { assertResolvedInputRefQuantityFx } from "~/activation/assertResolvedInputRefQuantityFx";
import { resolveSingleInputRefFx } from "~/activation/resolveSingleInputRefFx";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import type { GameActionItemMergeSchema } from "~/action/GameActionItemMergeSchema";
import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import { readGameSaveBoardItemQuantity } from "~/board/readGameSaveBoardItemQuantity";
import { readBoardItemMaxCountCapacityFx } from "~/board/readBoardItemMaxCountCapacityFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameMergeRuleDefinition } from "~/config/GameItemCapabilities";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { resolveExecutableItemMergeRule } from "~/merge/resolveExecutableItemMergeRule";

export namespace checkItemMergeReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionItemMergeSchema.Type;
	}
}

type MergeReadinessTarget = NonNullable<GameSave["board"]["items"][string]>;

const readMergeReadinessTargetFx = Effect.fn(
	"checkItemMergeReadinessFx.readMergeReadinessTargetFx",
)(function* ({ action, save }: checkItemMergeReadinessFx.Props) {
	const target = save.board.items[action.targetItemInstanceId];
	if (target) return target;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"unsupported_target",
			`Merge target "${action.targetItemInstanceId}" must be a board tile.`,
		),
	);
});

const readMergeReadinessSourceFx = Effect.fn(
	"checkItemMergeReadinessFx.readMergeReadinessSourceFx",
)(function* ({
	action,
	save,
	target,
}: Pick<checkItemMergeReadinessFx.Props, "action" | "save"> & {
	target: MergeReadinessTarget;
}) {
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
	return source;
});

const readExecutableMergeRuleFx = Effect.fn("checkItemMergeReadinessFx.readExecutableMergeRuleFx")(
	function* ({
		config,
		source,
		target,
	}: {
		config: GameConfig;
		source: GameActionResolvedInputRef;
		target: MergeReadinessTarget;
	}) {
		const sourceDefinition = config.items[source.itemId];
		const merge = resolveExecutableItemMergeRule({
			config,
			sourceItemId: source.itemId,
			targetItemId: target.itemId,
		})?.merge;
		if (sourceDefinition && merge) return merge;

		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_merge",
				`Item "${source.itemId}" cannot merge with "${target.itemId}".`,
			),
		);
	},
);

const assertMergeResultItemDefinitionExistsFx = Effect.fn(
	"checkItemMergeReadinessFx.assertMergeResultItemDefinitionExistsFx",
)(function* ({ config, resultItemId }: { config: GameConfig; resultItemId: string }) {
	if (config.items[resultItemId]) return;

	return yield* Effect.fail(
		GameEngineError.configReferenceMissing(`Missing merge result "${resultItemId}".`),
	);
});

const assertMergeResultBoardCapacityFx = Effect.fn(
	"checkItemMergeReadinessFx.assertMergeResultBoardCapacityFx",
)(function* ({
	config,
	resultItemId,
	save,
	target,
}: {
	config: GameConfig;
	resultItemId: string;
	save: GameSave;
	target: MergeReadinessTarget;
}) {
	const capacity = yield* readBoardItemMaxCountCapacityFx({
		config,
		ignoredBoardItemInstanceIds: new Set([
			target.id,
		]),
		itemId: resultItemId,
		save,
	});
	if (capacity > 0) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"board:max-count",
			`Board already has the maximum allowed count for "${resultItemId}".`,
		),
	);
});

const assertMergeTargetSingleQuantityFx = Effect.fn(
	"checkItemMergeReadinessFx.assertMergeTargetSingleQuantityFx",
)(function* ({ target }: { target: MergeReadinessTarget }) {
	if (readGameSaveBoardItemQuantity(target) === 1) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"unsupported_target",
			"Stacked board targets cannot be replaced by merge.",
		),
	);
});

const assertMergeTargetReplaceableFx = Effect.fn(
	"checkItemMergeReadinessFx.assertMergeTargetReplaceableFx",
)(function* ({ save, target }: { save: GameSave; target: MergeReadinessTarget }) {
	const targetStateStatus = readBoardItemRuntimeStateStatus({
		itemInstanceId: target.id,
		save,
	});
	if (!targetStateStatus.busy && !targetStateStatus.preservable) return;

	return yield* Effect.fail(
		GameEngineError.actionRejected(
			"item_busy",
			targetStateStatus.busy
				? "Merge target has a running job."
				: "Merge target has stored runtime state and cannot be replaced by merge.",
		),
	);
});

const assertMergeResultReadinessFx = Effect.fn(
	"checkItemMergeReadinessFx.assertMergeResultReadinessFx",
)(function* ({
	config,
	merge,
	save,
	target,
}: {
	config: GameConfig;
	merge: GameMergeRuleDefinition;
	save: GameSave;
	target: MergeReadinessTarget;
}) {
	if (!("resultItemId" in merge)) return;

	yield* assertMergeResultItemDefinitionExistsFx({
		config,
		resultItemId: merge.resultItemId,
	});
	yield* assertMergeResultBoardCapacityFx({
		config,
		resultItemId: merge.resultItemId,
		save,
		target,
	});
	yield* assertMergeTargetSingleQuantityFx({
		target,
	});
	yield* assertMergeTargetReplaceableFx({
		save,
		target,
	});
});

export const checkItemMergeReadinessFx = Effect.fn("checkItemMergeReadinessFx")(function* (
	props: checkItemMergeReadinessFx.Props,
) {
	const target = yield* readMergeReadinessTargetFx(props);
	const source = yield* readMergeReadinessSourceFx({
		action: props.action,
		save: props.save,
		target,
	});
	const merge = yield* readExecutableMergeRuleFx({
		config: props.config,
		source,
		target,
	});
	yield* assertMergeResultReadinessFx({
		config: props.config,
		merge,
		save: props.save,
		target,
	});

	return {
		merge,
		source,
		target,
	};
});
