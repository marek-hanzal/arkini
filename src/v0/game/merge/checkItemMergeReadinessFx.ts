import { Effect } from "effect";
import { readBoardItemRuntimeStateStatus } from "~/v0/game/board/readBoardItemRuntimeStateStatus";
import { resolveInputRefsFx } from "~/v0/game/requirements/resolveInputRefsFx";
import { resolveExecutableItemMergeRule } from "~/v0/game/engine/logic/resolveExecutableItemMergeRule";
import { readBoardItemMaxCountCapacity } from "~/v0/game/board/readBoardItemMaxCountCapacity";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionItemMerge } from "~/v0/game/action/GameActionItemMerge";
import type { GameActionResolvedInputRef } from "~/v0/game/action/GameActionResolvedInputRef";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { checkItemCreateBlockedByEffectsFx } from "~/v0/game/effects/checkItemCreateBlockedByEffectsFx";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

const readMergeIgnoredEffectSourceIds = ({
	save,
	source,
	targetItemInstanceId,
}: {
	save: GameSave;
	source: GameActionResolvedInputRef;
	targetItemInstanceId: string;
}) => {
	const ignoredSourceIds = new Set<string>([
		targetItemInstanceId,
	]);

	if (source.kind === "board") {
		ignoredSourceIds.add(source.itemInstanceId);
		return ignoredSourceIds;
	}

	const slot = save.inventory.slots[source.slotIndex];
	if (!slot) return ignoredSourceIds;
	if ("kind" in slot && slot.kind === "instance") {
		ignoredSourceIds.add(slot.id);
		return ignoredSourceIds;
	}

	ignoredSourceIds.add(`inventory-slot:${source.slotIndex}:${source.itemId}:0`);
	return ignoredSourceIds;
};

export namespace checkItemMergeReadinessFx {
	export interface Props {
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
		action: GameActionItemMerge;
	}
}

export const checkItemMergeReadinessFx = Effect.fn("checkItemMergeReadinessFx")(function* ({
	config,
	nowMs,
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
	const ignoredEffectSourceIds = readMergeIgnoredEffectSourceIds({
		save,
		source,
		targetItemInstanceId: target.id,
	});
	yield* checkItemCreateBlockedByEffectsFx({
		config,
		ignoredSourceIds: ignoredEffectSourceIds,
		itemId: merge.resultItemId,
		nowMs,
		save,
		targetCell: target,
	});
	if (
		readBoardItemMaxCountCapacity({
			config,
			ignoredBoardItemInstanceIds: new Set([
				target.id,
			]),
			itemId: merge.resultItemId,
			save,
		}) <= 0
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

	return {
		ignoredEffectSourceIds,
		merge,
		source,
		target,
	};
});
