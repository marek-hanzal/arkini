import { Effect } from "effect";
import type { GameConfig } from "~/config/GameConfigTypes";
import { syncRealtimeCraftJobsFx } from "~/craft/syncRealtimeCraftJobsFx";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { syncRealtimeProducerJobsFx } from "~/producer/syncRealtimeProducerJobsFx";

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
