import { Effect } from "effect";
import { completeProducerJobFx } from "~/v0/game/producer/completeProducerJobFx";
import { readCompletedProducerJobsFx } from "~/v0/game/producer/readCompletedProducerJobsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

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
		const producerJobs = yield* readCompletedProducerJobsFx({
			nowMs,
			save: nextSave,
		});

		for (const job of producerJobs) {
			const result = yield* completeProducerJobFx({
				config,
				job,
				nowMs,
				save: nextSave,
			});

			if (result.type === "blocked") {
				nextSave = result.save;
				events.push(...result.events);
				continue;
			}

			nextSave = result.save;
			events.push(...result.events);
		}

		return {
			events,
			save: nextSave,
		};
	},
);
