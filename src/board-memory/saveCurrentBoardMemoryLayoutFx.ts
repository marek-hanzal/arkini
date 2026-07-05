import { Effect } from "effect";
import type { BoardMemoryActivationScope } from "~/board-memory/BoardMemoryActivationTypes";
import { readBoardMemoryEngineResultFx } from "~/board-memory/readBoardMemoryEngineResultFx";
import { readBoardMemorySnapshotFx } from "~/board-memory/readBoardMemorySnapshotFx";
import { writeBoardMemoryLayoutToSaveFx } from "~/board-memory/writeBoardMemoryLayoutToSaveFx";

export const saveCurrentBoardMemoryLayoutFx = Effect.fn("saveCurrentBoardMemoryLayoutFx")(
	function* ({ boardItemId, scope }: { boardItemId: string; scope: BoardMemoryActivationScope }) {
		const { events, nextSave, nowMs } = scope;
		const items = yield* readBoardMemorySnapshotFx({
			scope,
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
			scope,
		});
	},
);
