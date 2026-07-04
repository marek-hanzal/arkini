import { Context, Effect } from "effect";
import { assertResolvedInputRefIsNotBoardItemFx } from "~/activation/assertResolvedInputRefIsNotBoardItemFx";
import { assertResolvedInputRefQuantityFx } from "~/activation/assertResolvedInputRefQuantityFx";
import { resolveSingleInputRefFx } from "~/activation/resolveSingleInputRefFx";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import type { GameActionItemMergeSchema } from "~/action/GameActionItemMergeSchema";
import { readBoardItemRuntimeStateStatus } from "~/board/readBoardItemRuntimeStateStatus";
import { readBoardItemMaxCountCapacityFx } from "~/board/logic/readBoardItemMaxCountCapacityFx";
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

class ItemMergeReadinessScopeFx extends Context.Tag("ItemMergeReadinessScopeFx")<
	ItemMergeReadinessScopeFx,
	checkItemMergeReadinessFx.Props & {
		readonly source: GameActionResolvedInputRef;
		readonly target: MergeReadinessTarget;
	}
>() {
	//
}

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
	function* () {
		const { config, source, target } = yield* ItemMergeReadinessScopeFx;
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
)(function* ({ resultItemId }: { resultItemId: string }) {
	const { config } = yield* ItemMergeReadinessScopeFx;
	if (config.items[resultItemId]) return;

	return yield* Effect.fail(
		GameEngineError.configReferenceMissing(`Missing merge result "${resultItemId}".`),
	);
});

const assertMergeResultBoardCapacityFx = Effect.fn(
	"checkItemMergeReadinessFx.assertMergeResultBoardCapacityFx",
)(function* ({ resultItemId }: { resultItemId: string }) {
	const { config, save, target } = yield* ItemMergeReadinessScopeFx;
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

const assertMergeTargetReplaceableFx = Effect.fn(
	"checkItemMergeReadinessFx.assertMergeTargetReplaceableFx",
)(function* () {
	const { save, target } = yield* ItemMergeReadinessScopeFx;
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
)(function* ({ merge }: { merge: GameMergeRuleDefinition }) {
	if (!("resultItemId" in merge)) return;

	yield* assertMergeResultItemDefinitionExistsFx({
		resultItemId: merge.resultItemId,
	});
	yield* assertMergeResultBoardCapacityFx({
		resultItemId: merge.resultItemId,
	});
	yield* assertMergeTargetReplaceableFx();
});

const checkItemMergeReadinessProgramFx = Effect.fn(
	"checkItemMergeReadinessFx.checkItemMergeReadinessProgramFx",
)(function* () {
	const { source, target } = yield* ItemMergeReadinessScopeFx;
	const merge = yield* readExecutableMergeRuleFx();
	yield* assertMergeResultReadinessFx({
		merge,
	});

	return {
		merge,
		source,
		target,
	};
});

export const checkItemMergeReadinessFx = Effect.fn("checkItemMergeReadinessFx")(function* (
	props: checkItemMergeReadinessFx.Props,
) {
	const target = yield* readMergeReadinessTargetFx(props);
	const source = yield* readMergeReadinessSourceFx({
		...props,
		target,
	});

	return yield* checkItemMergeReadinessProgramFx().pipe(
		Effect.provideService(ItemMergeReadinessScopeFx, {
			...props,
			source,
			target,
		}),
	);
});
