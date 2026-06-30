import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { syncRealtimeCraftJobsFx } from "~/v0/game/craft/syncRealtimeCraftJobsFx";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { syncRealtimeProducerJobsFx } from "~/v0/game/producer/syncRealtimeProducerJobsFx";

export namespace syncRealtimeWorldJobsFx {
	export interface Props {
		config: GameConfig;
		nowMs: number;
		save: GameSave;
	}
}

export const syncRealtimeWorldJobsFx = Effect.fn("syncRealtimeWorldJobsFx")(function* ({
	config,
	nowMs,
	save,
}: syncRealtimeWorldJobsFx.Props) {
	const producerSyncedSave = yield* syncRealtimeProducerJobsFx({
		config,
		nowMs,
		save,
	});

	return yield* syncRealtimeCraftJobsFx({
		config,
		nowMs,
		save: producerSyncedSave,
	});
});
