import { Effect } from "effect";
import { completeCraftJobFx } from "~/craft/completeCraftJobFx";
import { readCompletedCraftJobsFx } from "~/craft/readCompletedCraftJobsFx";
import { syncRealtimeCraftJobsFx } from "~/craft/syncRealtimeCraftJobsFx";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

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

	while (true) {
		nextSave = yield* syncRealtimeCraftJobsFx({
			config,
			nowMs,
			save: nextSave,
		});
		const [job] = yield* readCompletedCraftJobsFx({
			nowMs,
			save: nextSave,
		});

		if (!job) {
			return {
				events,
				save: nextSave,
			};
		}

		const result = yield* completeCraftJobFx({
			config,
			job,
			nowMs,
			save: nextSave,
		});

		nextSave = result.save;
		events.push(...result.events);
	}
});
