import { Effect } from "effect";
import { readBoardItemMaxCountCapacity } from "~/v0/game/board/readBoardItemMaxCountCapacity";
import { removeBoardItemRuntimeState } from "~/v0/game/board/removeBoardItemRuntimeState";
import { isItemStorageAllowed } from "~/v0/game/config/isItemStorageAllowed";
import { checkItemCreateBlockedByEffectsFx } from "~/v0/game/effects/checkItemCreateBlockedByEffectsFx";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace applyStashDepletionFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		stashItemInstanceId: string;
		stashItemId: string;
		onDepleted:
			| "remove"
			| {
					replaceWithItemId: string;
			  };
		nowMs: number;
	}
}

export const applyStashDepletionFx = Effect.fn("applyStashDepletionFx")(function* ({
	config,
	save,
	stashItemInstanceId,
	stashItemId,
	onDepleted,
	nowMs,
}: applyStashDepletionFx.Props) {
	const liveItem = save.board.items[stashItemInstanceId];
	if (!liveItem) return [] satisfies GameEvent[];

	if (onDepleted === "remove") {
		delete save.board.items[stashItemInstanceId];
		removeBoardItemRuntimeState({
			itemInstanceId: stashItemInstanceId,
			save,
		});

		return [
			{
				itemId: liveItem.itemId,
				itemInstanceId: stashItemInstanceId,
				reason: "stash-depleted" as const,
				atMs: nowMs,
				type: "item.removed" as const,
			},
		] satisfies GameEvent[];
	}

	const replacementItemId = onDepleted.replaceWithItemId;
	if (!config.items[replacementItemId]) {
		return yield* Effect.fail(
			GameEngineError.configReferenceMissing(
				`Missing stash depletion replacement item "${replacementItemId}".`,
			),
		);
	}
	if (
		!isItemStorageAllowed({
			config,
			itemId: replacementItemId,
			location: "board",
		})
	) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"storage_restricted",
				`Stash depletion replacement "${replacementItemId}" cannot exist on board.`,
			),
		);
	}
	yield* checkItemCreateBlockedByEffectsFx({
		config,
		itemId: replacementItemId,
		nowMs,
		save,
		targetCell: {
			x: liveItem.x,
			y: liveItem.y,
		},
	});
	if (
		readBoardItemMaxCountCapacity({
			config,
			ignoredBoardItemInstanceIds: new Set([
				stashItemInstanceId,
			]),
			itemId: replacementItemId,
			save,
		}) <= 0
	) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"board:max-count",
				`Board already has the maximum allowed count for "${replacementItemId}".`,
			),
		);
	}

	if (config.items[replacementItemId]?.passiveEffectIds?.length) {
		liveItem.createdAtMs = nowMs;
	} else {
		delete liveItem.createdAtMs;
	}
	liveItem.itemId = replacementItemId;
	removeBoardItemRuntimeState({
		itemInstanceId: stashItemInstanceId,
		save,
	});

	return [
		{
			fromItemId: stashItemId,
			itemInstanceId: stashItemInstanceId,
			reason: "stash-depleted" as const,
			atMs: nowMs,
			toItemId: replacementItemId,
			type: "item.replaced" as const,
		},
	] satisfies GameEvent[];
});
