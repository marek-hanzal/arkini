import { Effect } from "effect";
import { completeProducerJobFx } from "~/producer/completeProducerJobFx";
import { readCompletedProducerJobsFx } from "~/producer/readCompletedProducerJobsFx";
import { syncRealtimeProducerJobsFx } from "~/producer/syncRealtimeProducerJobsFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

export namespace processCompletedProducerJobsFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

export const processCompletedProducerJobsFx = Effect.fn("processCompletedProducerJobsFx")(
	function* ({ config, save, nowMs }: processCompletedProducerJobsFx.Props) {
		let nextSave = save;
		const events: GameEvent[] = [];

		while (true) {
			nextSave = yield* syncRealtimeProducerJobsFx({
				config,
				nowMs,
				save: nextSave,
			});
			const [job] = yield* readCompletedProducerJobsFx({
				nowMs,
				save: nextSave,
			});

			if (!job) {
				return {
					events,
					save: nextSave,
				};
			}

			const result = yield* completeProducerJobFx({
				config,
				job,
				nowMs,
				save: nextSave,
			});

			nextSave = result.save;
			events.push(...result.events);
		}
	},
);
