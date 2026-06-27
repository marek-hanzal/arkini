import { Effect } from "effect";
import { GameConfigFx } from "~/v0/game/config/GameConfigFx";
import { processWorldSnapshotFx } from "~/v0/game/world/processWorldSnapshotFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

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
