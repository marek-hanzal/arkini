import { Effect } from "effect";
import { GameConfigFx } from "~/config/GameConfigFx";
import { processWorldSnapshotFx } from "~/world/processWorldSnapshotFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace runGameTickFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

export const runGameTickFx = Effect.fn("runGameTickFx")(function* ({
	config,
	save,
	nowMs,
}: runGameTickFx.Props) {
	const result = yield* Effect.provideService(
		processWorldSnapshotFx({
			config,
			nowMs,
			save,
		}),
		GameConfigFx,
		{
			config,
		},
	);
	return result satisfies GameEngineResult;
});
