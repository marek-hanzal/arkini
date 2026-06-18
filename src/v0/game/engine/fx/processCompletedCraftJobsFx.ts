import { Effect } from "effect";
import { completeCraftJobFx } from "~/v0/game/engine/fx/completeCraftJobFx";
import { processScheduledGameEventsFx } from "~/v0/game/engine/fx/processScheduledGameEventsFx";
import { readCompletedCraftJobsFx } from "~/v0/game/engine/fx/readCompletedCraftJobsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace processCompletedCraftJobsFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

export const processCompletedCraftJobsFx = Effect.fn("processCompletedCraftJobsFx")(function* ({
	config,
	save,
	nowMs,
}: processCompletedCraftJobsFx.Props) {
	let nextSave = save;
	const events: GameEvent[] = [];
	const craftJobs = yield* readCompletedCraftJobsFx({
		nowMs,
		save: nextSave,
	});

	for (const job of craftJobs) {
		const result = yield* completeCraftJobFx({
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

		const scheduledAfterJob = yield* processScheduledGameEventsFx({
			config,
			nowMs,
			save: nextSave,
		});
		nextSave = scheduledAfterJob.save;
		events.push(...scheduledAfterJob.events);
	}

	return {
		events,
		save: nextSave,
	};
});
