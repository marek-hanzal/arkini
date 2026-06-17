import { Effect } from "effect";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { consumeActivationInputsFx } from "~/v0/game/engine/fx/consumeActivationInputsFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import { resolveInputRefsFx } from "~/v0/game/engine/fx/resolveInputRefsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionItemMerge } from "~/v0/game/engine/model/GameActionItemMerge";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace mergeItemFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionItemMerge;
		nowMs: number;
	}
}

export const mergeItemFx = Effect.fn("mergeItemFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: mergeItemFx.Props) {
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
	const merge = (sourceDefinition?.mergeIds ?? [])
		.map((mergeId) => config.merge[mergeId])
		.find((entry) => entry?.withItemId === target.itemId);
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

	const shouldConsumeSource = merge.consumeSource !== false;
	const consumed = shouldConsumeSource
		? yield* consumeActivationInputsFx({
				inputRefs: [
					action.sourceRef,
				],
				inputs: [
					{
						consume: true,
						itemId: source.itemId,
						quantity: 1,
					},
				],
				nowMs,
				reason: "merge-source",
				save,
			})
		: {
				events: [] satisfies GameEvent[],
				save,
			};
	const nextSave = yield* cloneGameSaveFx({
		save: consumed.save,
	});
	const liveTarget = nextSave.board.items[target.id];
	if (!liveTarget) {
		return yield* Effect.fail(
			GameEngineError.actionRejected("invalid_merge", "Merge target disappeared."),
		);
	}
	if (
		Object.values(nextSave.producerJobs).some((job) => job.producerItemInstanceId === target.id)
	) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"invalid_actor",
				"Merge target has a running producer job.",
			),
		);
	}

	liveTarget.itemId = merge.resultItemId;
	delete nextSave.stashes[target.id];
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			...consumed.events,
			{
				fromItemId: target.itemId,
				itemInstanceId: target.id,
				reason: "merge-result" as const,
				replacedAtMs: nowMs,
				toItemId: merge.resultItemId,
				type: "item.replaced" as const,
			},
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
