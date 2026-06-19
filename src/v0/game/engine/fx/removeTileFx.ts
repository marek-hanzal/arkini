import { Effect } from "effect";
import { match } from "ts-pattern";
import { checkTileRemoveReadinessFx } from "~/v0/game/engine/fx/checkTileRemoveReadinessFx";
import { cloneGameSaveFx } from "~/v0/game/engine/fx/cloneGameSaveFx";
import { removeBoardItemRuntimeState } from "~/v0/game/engine/fx/removeBoardItemRuntimeState";
import { consumeActivationInputsFx } from "~/v0/game/requirements/consumeActivationInputsFx";
import { readNextWakeAtMsFx } from "~/v0/game/job/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameActionTileRemove } from "~/v0/game/engine/model/GameActionTileRemove";
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
	const checked = yield* checkTileRemoveReadinessFx({
		action,
		config,
		save,
	});
	const consumed = yield* match(checked.removal.mode)
		.with("consume", () =>
			consumeActivationInputsFx({
				inputRefs: [
					action.toolRef,
				],
				inputs: [
					{
						consume: true,
						itemId: checked.tool.itemId,
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
	delete nextSave.board.items[checked.target.id];
	removeBoardItemRuntimeState({
		itemInstanceId: checked.target.id,
		save: nextSave,
	});
	nextSave.updatedAtMs = nowMs;

	return {
		events: [
			...consumed.events,
			{
				itemId: checked.target.itemId,
				itemInstanceId: checked.target.id,
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
