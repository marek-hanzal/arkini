import { Effect } from "effect";
import { processCompletedCraftJobsFx } from "~/v0/game/engine/fx/processCompletedCraftJobsFx";
import { processCompletedProducerJobsFx } from "~/v0/game/engine/fx/processCompletedProducerJobsFx";
import { processScheduledGameEventsFx } from "~/v0/game/engine/fx/processScheduledGameEventsFx";
import { readNextWakeAtMsFx } from "~/v0/game/engine/fx/readNextWakeAtMsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
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
	let nextSave = save;
	const events: GameEvent[] = [];

	const scheduledBeforeJobs = yield* processScheduledGameEventsFx({
		config,
		nowMs,
		save: nextSave,
	});
	nextSave = scheduledBeforeJobs.save;
	events.push(...scheduledBeforeJobs.events);

	const producerJobs = yield* processCompletedProducerJobsFx({
		config,
		nowMs,
		save: nextSave,
	});
	nextSave = producerJobs.save;
	events.push(...producerJobs.events);

	const craftJobs = yield* processCompletedCraftJobsFx({
		config,
		nowMs,
		save: nextSave,
	});
	nextSave = craftJobs.save;
	events.push(...craftJobs.events);

	const scheduledAfterJobs = yield* processScheduledGameEventsFx({
		config,
		nowMs,
		save: nextSave,
	});
	nextSave = scheduledAfterJobs.save;
	events.push(...scheduledAfterJobs.events);

	return {
		events,
		nextWakeAtMs: yield* readNextWakeAtMsFx({
			save: nextSave,
		}),
		save: nextSave,
	} satisfies GameEngineResult;
});
