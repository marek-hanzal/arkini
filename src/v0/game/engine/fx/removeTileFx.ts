import { Effect } from "effect";
import { match } from "ts-pattern";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { consumeActivationInputsFx } from "~/v0/game/engine/fx/consumeActivationInputsFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import { resolveInputRefsFx } from "~/v0/game/engine/fx/resolveInputRefsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionTileRemove } from "~/v0/game/engine/model/GameActionTileRemove";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace removeTileFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		action: GameActionTileRemove;
		nowMs: number;
	}
}

export const removeTileFx = Effect.fn("removeTileFx")(function* ({
	config,
	save,
	action,
	nowMs,
}: removeTileFx.Props) {
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

	const consumed = yield* match(removal.mode)
		.with("consume", () =>
			consumeActivationInputsFx({
				inputRefs: [
					action.toolRef,
				],
				inputs: [
					{
						consume: true,
						itemId: tool.itemId,
						quantity: 1,
					},
				],
				nowMs,
				reason: "remove-tool",
				save,
			}),
		)
		.with("keep", () =>
			Effect.succeed({
				events: [] satisfies GameEvent[],
				save,
			}),
		)
		.exhaustive();

	const nextSave = yield* cloneGameSaveFx({
		save: consumed.save,
	});
	delete nextSave.board.items[target.id];
	delete nextSave.stashes[target.id];
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			...consumed.events,
			{
				itemId: target.itemId,
				itemInstanceId: target.id,
				reason: "tile-remove" as const,
				removedAtMs: nowMs,
				type: "item.removed" as const,
			},
		],
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
