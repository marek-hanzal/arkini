import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import { readBoardMemoryEngineResultFx } from "~/board-memory/readBoardMemoryEngineResultFx";
import { readBoardMemorySnapshotFx } from "~/board-memory/readBoardMemorySnapshotFx";
import { writeBoardMemoryLayoutToSaveFx } from "~/board-memory/writeBoardMemoryLayoutToSaveFx";

export const saveCurrentBoardMemoryLayoutFx = Effect.fn("saveCurrentBoardMemoryLayoutFx")(
	function* ({
		boardItemId,
		config,
		events,
		nextSave,
		nowMs,
	}: {
		boardItemId: string;
		config: GameConfig;
		events: GameEvent[];
		nextSave: GameSave;
		nowMs: number;
	}) {
		const items = yield* readBoardMemorySnapshotFx({
			config,
			nextSave,
		});
		yield* writeBoardMemoryLayoutToSaveFx({
			boardItemId,
			layout: {
				items,
				savedAtMs: nowMs,
			},
			save: nextSave,
		});
		nextSave.updatedAtMs = nowMs;
		events.push({
			atMs: nowMs,
			boardItemId,
			itemCount: items.length,
			type: "board.memory.saved",
		});

		return yield* readBoardMemoryEngineResultFx({
			config,
			events,
			nextSave,
			nowMs,
		});
	},
);
